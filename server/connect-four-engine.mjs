import { randomBytes, randomUUID } from 'node:crypto';
import { GameError, normalizeName, normalizeRoomCode, ROOM_TTL_MS } from './game-engine.mjs';

export const CONNECT4_ROWS = 6;
export const CONNECT4_COLS = 7;
export const CONNECT4_CELLS = CONNECT4_ROWS * CONNECT4_COLS;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  return Array.from(randomBytes(6), byte => ALPHABET[byte % ALPHABET.length]).join('');
}

function createPlayer(name, isHost) {
  return {
    id: randomUUID(), token: randomBytes(32).toString('hex'),
    name: normalizeName(name), isHost, socketId: null, rematchReady: false,
  };
}

export function dropDisc(board, column, disc) {
  if (!Array.isArray(board) || board.length !== CONNECT4_CELLS || board.some(x => ![0, 1, 2].includes(x))) {
    throw new GameError('Invalid Connect Four board.');
  }
  if (!Number.isInteger(column) || column < 0 || column >= CONNECT4_COLS) {
    throw new GameError('Choose a column from 1 to 7.');
  }
  if (disc !== 1 && disc !== 2) throw new GameError('Invalid player disc.');
  for (let row = CONNECT4_ROWS - 1; row >= 0; row--) {
    const index = row * CONNECT4_COLS + column;
    if (board[index] === 0) {
      const next = [...board];
      next[index] = disc;
      return { board: next, row, column, index };
    }
  }
  throw new GameError('This column is full. Choose another column.');
}

export function winningConnectFour(board, index) {
  if (!Array.isArray(board) || board.length !== CONNECT4_CELLS || !Number.isInteger(index) || index < 0 || index >= CONNECT4_CELLS) return [];
  const player = board[index];
  if (player !== 1 && player !== 2) return [];
  const row = Math.floor(index / CONNECT4_COLS), col = index % CONNECT4_COLS;
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of directions) {
    const line = [index];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign, c = col + dc * sign;
      while (r >= 0 && r < CONNECT4_ROWS && c >= 0 && c < CONNECT4_COLS && board[r * CONNECT4_COLS + c] === player) {
        line.push(r * CONNECT4_COLS + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 4) return line.sort((a, b) => a - b);
  }
  return [];
}

export function publicConnectFourRoom(room, viewerId) {
  if (!room.players.some(p => p.id === viewerId)) throw new GameError('You do not belong to this room.');
  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    you: viewerId,
    board: [...room.board],
    turnPlayerId: room.phase === 'playing' ? room.players[room.turnIndex].id : null,
    winnerId: room.winnerId,
    draw: room.draw,
    winningCells: [...room.winningCells],
    lastMove: room.lastMove ? { ...room.lastMove } : null,
    players: room.players.map(p => ({
      id: p.id, name: p.name, isHost: p.isHost,
      online: Boolean(p.socketId), rematchReady: p.rematchReady,
    })),
  };
}

export class ConnectFourStore {
  constructor() { this.rooms = new Map(); }

  create(name) {
    if (this.rooms.size >= 1000) {
      this.cleanup();
      if (this.rooms.size >= 1000) throw new GameError('Connect Four rooms are busy. Try again shortly.');
    }
    const player = createPlayer(name, true);
    let code;
    do { code = generateCode(); } while (this.rooms.has(code));
    const room = {
      code, phase: 'lobby', round: 1, players: [player],
      board: Array(CONNECT4_CELLS).fill(0), turnIndex: 0, lastMove: null,
      winnerId: null, draw: false, winningCells: [], updatedAt: Date.now(),
    };
    this.rooms.set(code, room);
    return { room, player };
  }

  requireRoom(code) {
    const room = this.rooms.get(normalizeRoomCode(code));
    if (!room) throw new GameError('Connect Four room not found. Check your invite code.');
    if (Date.now() - room.updatedAt > ROOM_TTL_MS) {
      this.rooms.delete(room.code);
      throw new GameError('This room has expired. Create a new Connect Four room.');
    }
    return room;
  }

  join(code, name, token) {
    const room = this.requireRoom(code);
    const returning = token && room.players.find(p => p.token === token);
    if (returning) { room.updatedAt = Date.now(); return { room, player: returning }; }
    if (room.players.length >= 2 || room.phase !== 'lobby') throw new GameError('This Connect Four room is full or already started.');
    const player = createPlayer(name, false);
    room.players.push(player);
    room.phase = 'playing';
    room.turnIndex = 0;
    room.updatedAt = Date.now();
    return { room, player };
  }

  authorize(code, token) {
    const room = this.requireRoom(code);
    const player = room.players.find(p => p.token === token);
    if (!player) throw new GameError('You do not belong to this Connect Four room.');
    return { room, player };
  }

  play(code, token, column) {
    const { room, player } = this.authorize(code, token);
    if (room.phase !== 'playing') throw new GameError('This round is not active.');
    if (room.players.length !== 2 || room.players.some(p => !p.socketId)) throw new GameError('Wait for both players to reconnect.');
    if (room.players[room.turnIndex].id !== player.id) throw new GameError('Wait for your turn.');
    const disc = room.players.findIndex(p => p.id === player.id) + 1;
    const result = dropDisc(room.board, column, disc);
    room.board = result.board;
    room.lastMove = { row: result.row, column: result.column, index: result.index, by: player.id };
    const winning = winningConnectFour(room.board, result.index);
    if (winning.length) {
      room.phase = 'finished';
      room.winnerId = player.id;
      room.winningCells = winning;
      room.draw = false;
    } else if (room.board.every(cell => cell !== 0)) {
      room.phase = 'finished';
      room.winnerId = null;
      room.draw = true;
    } else {
      room.turnIndex = 1 - room.turnIndex;
    }
    room.updatedAt = Date.now();
    return room;
  }

  requestRematch(code, token) {
    const { room, player } = this.authorize(code, token);
    if (room.phase !== 'finished') throw new GameError('Finish the round before requesting a rematch.');
    if (room.players.some(p => !p.socketId)) throw new GameError('Wait for both players to reconnect.');
    if (player.rematchReady) throw new GameError('You already requested a rematch.');
    player.rematchReady = true;
    if (room.players.length === 2 && room.players.every(p => p.rematchReady)) {
      room.round += 1;
      room.board = Array(CONNECT4_CELLS).fill(0);
      room.turnIndex = (room.round - 1) % 2;
      room.phase = 'playing';
      room.winnerId = null;
      room.draw = false;
      room.winningCells = [];
      room.lastMove = null;
      for (const p of room.players) p.rematchReady = false;
    }
    room.updatedAt = Date.now();
    return room;
  }

  cleanup() {
    for (const [code, room] of this.rooms) {
      if (Date.now() - room.updatedAt > ROOM_TTL_MS) this.rooms.delete(code);
    }
  }
}
