import { randomBytes, randomUUID } from 'node:crypto';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_PLAYERS = 2;
export const ROOM_TTL_MS = 3 * 60 * 60 * 1000;

export class GameError extends Error {}

export function normalizeName(value) {
  const result = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (result.length < 2 || result.length > 20) throw new GameError('Use a name between 2 and 20 characters.');
  return result;
}

export function normalizeRoomCode(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function validateCode(value, mode) {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) {
    throw new GameError('Enter exactly four digits (0–9).');
  }
  if (mode === 'unique' && new Set(value).size !== 4) {
    throw new GameError('All four digits must be different in Unique mode.');
  }
  if (mode !== 'repeat' && mode !== 'unique') throw new GameError('Invalid game mode.');
  return value;
}

export function countExact(secret, guess) {
  return [...secret].reduce((total, digit, index) => total + Number(digit === guess[index]), 0);
}

function newInviteCode() {
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join('');
}

function newPlayer(name, isHost) {
  return {
    id: randomUUID(),
    token: randomBytes(32).toString('hex'),
    name: normalizeName(name),
    isHost,
    socketId: null,
    secret: null,
    ready: false,
  };
}

export function publicRoom(room, viewerId) {
  return {
    code: room.code,
    mode: room.mode,
    phase: room.phase,
    round: room.round,
    you: viewerId,
    hostId: room.players[0].id,
    turnPlayerId: room.phase === 'playing' ? room.players[room.turnIndex].id : null,
    winnerId: room.winnerId,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      online: Boolean(p.socketId),
      ready: p.ready,
      guesses: room.guesses.filter((g) => g.by === p.id).length,
    })),
    guesses: room.guesses,
    // Secret values MUST NOT be included before a round finishes.
    revealedSecrets: room.phase === 'finished'
      ? Object.fromEntries(room.players.map((p) => [p.id, p.secret]))
      : null,
  };
}

export class GameStore {
  constructor() { this.rooms = new Map(); }

  create(name, mode = 'unique') {
    if (this.rooms.size >= 1000) {
      this.cleanup();
      if (this.rooms.size >= 1000) throw new GameError('All rooms are busy. Please try again later.');
    }
    if (!['unique', 'repeat'].includes(mode)) throw new GameError('Choose a valid game mode.');
    const player = newPlayer(name, true);
    let code;
    do { code = newInviteCode(); } while (this.rooms.has(code));
    const room = {
      code, mode, phase: 'lobby', round: 1,
      players: [player], turnIndex: 0, winnerId: null,
      guesses: [], updatedAt: Date.now(),
    };
    this.rooms.set(code, room);
    return { room, player };
  }

  requireRoom(code) {
    const room = this.rooms.get(normalizeRoomCode(code));
    if (!room) throw new GameError('Room not found. Check the invite code.');
    if (Date.now() - room.updatedAt > ROOM_TTL_MS) {
      this.rooms.delete(room.code);
      throw new GameError('This room has expired. Create a new room.');
    }
    return room;
  }

  join(code, name, token) {
    const room = this.requireRoom(code);
    const returning = token && room.players.find((p) => p.token === token);
    if (returning) {
      room.updatedAt = Date.now();
      return { room, player: returning, rejoined: true };
    }
    if (room.phase !== 'lobby' || room.players.length >= MAX_PLAYERS) {
      throw new GameError('This room is already full or the game has started.');
    }
    const player = newPlayer(name, false);
    room.players.push(player);
    room.phase = 'setup';
    room.updatedAt = Date.now();
    return { room, player, rejoined: false };
  }

  authorize(code, token) {
    const room = this.requireRoom(code);
    const player = room.players.find((p) => p.token === token);
    if (!player) throw new GameError('You do not belong to this room.');
    return { room, player };
  }

  setMode(code, token, mode) {
    const { room, player } = this.authorize(code, token);
    if (!player.isHost) throw new GameError('Only the room host can change the mode.');
    if (!['unique', 'repeat'].includes(mode)) throw new GameError('Invalid mode.');
    if (!['lobby', 'setup'].includes(room.phase) || room.players.some((p) => p.ready)) {
      throw new GameError('Mode can only change before either player locks a code.');
    }
    room.mode = mode;
    room.updatedAt = Date.now();
    return room;
  }

  setSecret(code, token, secret) {
    const { room, player } = this.authorize(code, token);
    if (room.phase !== 'setup') throw new GameError('Wait until both players have joined.');
    if (player.ready) throw new GameError('Your number is already locked for this round.');
    player.secret = validateCode(secret, room.mode);
    player.ready = true;
    if (room.players.length === MAX_PLAYERS && room.players.every((p) => p.ready)) {
      room.phase = 'playing';
      room.turnIndex = (room.round - 1) % MAX_PLAYERS;
    }
    room.updatedAt = Date.now();
    return room;
  }

  guess(code, token, proposedGuess) {
    const { room, player } = this.authorize(code, token);
    if (room.phase !== 'playing') throw new GameError('The game has not started.');
    if (room.players[room.turnIndex].id !== player.id) throw new GameError('Wait for your turn.');
    if (room.players.some((p) => !p.socketId)) throw new GameError('Wait for both players to reconnect.');
    const guess = validateCode(proposedGuess, room.mode);
    const opponent = room.players.find((p) => p.id !== player.id);
    if (!opponent || !opponent.secret) throw new GameError('Opponent has not chosen a number.');
    const exact = countExact(opponent.secret, guess);
    const attempt = {
      id: randomUUID(),
      round: room.round,
      by: player.id,
      against: opponent.id,
      guess,
      exact,
      at: new Date().toISOString(),
    };
    room.guesses.push(attempt);
    if (exact === 4) {
      room.phase = 'finished';
      room.winnerId = player.id;
    } else {
      room.turnIndex = (room.turnIndex + 1) % MAX_PLAYERS;
    }
    room.updatedAt = Date.now();
    return room;
  }

  rematch(code, token) {
    const { room, player } = this.authorize(code, token);
    if (!player.isHost) throw new GameError('Only the host can start a rematch.');
    if (room.phase !== 'finished') throw new GameError('Finish this round first.');
    room.round += 1;
    room.phase = 'setup';
    room.winnerId = null;
    room.guesses = [];
    room.players.forEach((p) => { p.secret = null; p.ready = false; });
    room.updatedAt = Date.now();
    return room;
  }

  cleanup() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.updatedAt > ROOM_TTL_MS) this.rooms.delete(code);
    }
  }
}
