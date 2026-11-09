import { randomBytes, randomUUID } from 'node:crypto';
import { GameError, normalizeName, normalizeRoomCode, ROOM_TTL_MS } from './game-engine.mjs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const NUMBERS = Array.from({ length: 25 }, (_, i) => i + 1);
const LINES = [
  ...Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => row * 5 + col)),
  ...Array.from({ length: 5 }, (_, col) => Array.from({ length: 5 }, (_, row) => row * 5 + col)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];
export const BINGO_LINE_TARGET = 5;

export function validateBingoBoard(board) {
  if (!Array.isArray(board) || board.length !== 25 ||
    board.some((n) => !Number.isInteger(n) || n < 1 || n > 25) ||
    new Set(board).size !== 25) {
    throw new GameError('Fill all 25 cells manually with each number from 1 to 25 exactly once.');
  }
  return [...board];
}

export function bingoCompletedLines(board, calledNumbers) {
  if (!board) return [];
  const called = new Set(calledNumbers);
  return LINES.filter((positions) => positions.every((position) => called.has(board[position])))
    .map((positions) => [...positions]);
}

function roomCode() {
  return [...randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

function makePlayer(name, isHost) {
  return {
    id: randomUUID(), token: randomBytes(32).toString('hex'),
    name: normalizeName(name), isHost, socketId: null, board: null, ready: false,
  };
}

export function publicBingoRoom(room, viewerId) {
  const viewer = room.players.find((p) => p.id === viewerId);
  if (!viewer) throw new GameError('You do not belong to this room.');
  const finished = room.phase === 'finished';
  return {
    code: room.code, phase: room.phase, round: room.round,
    you: viewerId, hostId: room.players[0].id,
    turnPlayerId: room.phase === 'playing' ? room.players[room.turnIndex].id : null,
    winnerId: room.winnerId, draw: room.draw,
    yourBoard: viewer.board ? [...viewer.board] : null,
    players: room.players.map((p) => ({
      id: p.id, name: p.name, isHost: p.isHost, ready: p.ready,
      online: Boolean(p.socketId), lines: bingoCompletedLines(p.board, room.called).length,
      ...(finished ? { board: p.board ? [...p.board] : null } : {}),
    })),
    called: [...room.called],
    calls: room.calls.map((c) => ({ ...c })),
  };
}

export class BingoStore {
  constructor() { this.rooms = new Map(); }

  create(name) {
    if (this.rooms.size >= 1000) {
      this.cleanup();
      if (this.rooms.size >= 1000) throw new GameError('Bingo rooms are busy. Try again shortly.');
    }
    const player = makePlayer(name, true);
    let code;
    do { code = roomCode(); } while (this.rooms.has(code));
    const room = {
      code, phase: 'lobby', round: 1, players: [player], turnIndex: 0,
      called: [], calls: [], winnerId: null, draw: false, updatedAt: Date.now(),
    };
    this.rooms.set(code, room);
    return { room, player };
  }

  requireRoom(code) {
    const room = this.rooms.get(normalizeRoomCode(code));
    if (!room) throw new GameError('Bingo room not found. Check your invite code.');
    if (Date.now() - room.updatedAt > ROOM_TTL_MS) {
      this.rooms.delete(room.code);
      throw new GameError('This Bingo room has expired. Create a new room.');
    }
    return room;
  }

  join(code, name, token) {
    const room = this.requireRoom(code);
    const returning = token && room.players.find((p) => p.token === token);
    if (returning) { room.updatedAt = Date.now(); return { room, player: returning }; }
    if (room.players.length >= 2 || room.phase !== 'lobby') throw new GameError('This Bingo room is full or already started.');
    const player = makePlayer(name, false);
    room.players.push(player);
    room.phase = 'setup';
    room.updatedAt = Date.now();
    return { room, player };
  }

  authorize(code, token) {
    const room = this.requireRoom(code);
    const player = room.players.find((p) => p.token === token);
    if (!player) throw new GameError('You do not belong to this Bingo room.');
    return { room, player };
  }

  lockBoard(code, token, proposedBoard) {
    const { room, player } = this.authorize(code, token);
    if (room.phase !== 'setup') throw new GameError('Wait for both players to join.');
    if (player.ready) throw new GameError('Your board is already locked.');
    player.board = validateBingoBoard(proposedBoard);
    player.ready = true;
    if (room.players.length === 2 && room.players.every((p) => p.ready)) {
      room.phase = 'playing';
      room.turnIndex = (room.round - 1) % 2;
    }
    room.updatedAt = Date.now();
    return room;
  }

  callNumber(code, token, value) {
    const { room, player } = this.authorize(code, token);
    if (room.phase !== 'playing') throw new GameError('Bingo has not started.');
    if (room.players[room.turnIndex].id !== player.id) throw new GameError('Wait for your turn.');
    if (room.players.some((p) => !p.socketId)) throw new GameError('Wait for both players to reconnect.');
    if (!Number.isInteger(value) || value < 1 || value > 25) throw new GameError('Choose a number from 1 to 25.');
    if (room.called.includes(value)) throw new GameError('That number has already been called.');
    room.called.push(value);
    room.calls.push({ number: value, by: player.id });
    const counts = room.players.map((p) => bingoCompletedLines(p.board, room.called).length);
    const eligible = counts.map((n, i) => n >= BINGO_LINE_TARGET ? i : -1).filter((n) => n >= 0);
    if (eligible.length) {
      room.phase = 'finished';
      room.draw = eligible.length === 2;
      room.winnerId = room.draw ? null : room.players[eligible[0]].id;
    } else {
      room.turnIndex = (room.turnIndex + 1) % 2;
    }
    room.updatedAt = Date.now();
    return room;
  }

  rematch(code, token) {
    const { room, player } = this.authorize(code, token);
    if (!player.isHost) throw new GameError('Only the host can start a rematch.');
    if (room.phase !== 'finished') throw new GameError('Finish the current round first.');
    room.round++;
    room.phase = 'setup';
    room.winnerId = null;
    room.draw = false;
    room.called = [];
    room.calls = [];
    for (const p of room.players) { p.board = null; p.ready = false; }
    room.updatedAt = Date.now();
    return room;
  }

  cleanup() {
    for (const [code, room] of this.rooms) {
      if (Date.now() - room.updatedAt > ROOM_TTL_MS) this.rooms.delete(code);
    }
  }
}
