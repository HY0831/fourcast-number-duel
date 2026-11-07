import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import { GameError, GameStore, publicRoom } from './game-engine.mjs';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || true, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 32 * 1024,
  pingTimeout: 20000,
});
const games = new GameStore();
const here = dirname(fileURLToPath(import.meta.url));

app.get('/health', (_req, res) => res.json({ status: 'ok', activeRooms: games.rooms.size }));
if (process.env.NODE_ENV === 'production') {
  const dist = join(here, '..', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

function broadcast(room) {
  for (const player of room.players) {
    if (player.socketId) io.to(player.socketId).emit('room:update', publicRoom(room, player.id));
  }
}

io.on('connection', (socket) => {
  let actionCount = 0;
  let windowStart = Date.now();
  function safely(run) {
    return (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (Date.now() - windowStart > 10000) { windowStart = Date.now(); actionCount = 0; }
        actionCount++;
        if (actionCount > 55) throw new GameError('Too many requests. Try again shortly.');
        const result = run(payload || {});
        reply({ ok: true, ...result });
      } catch (err) {
        reply({ ok: false, error: err instanceof GameError ? err.message : 'Something went wrong.' });
        if (!(err instanceof GameError)) console.error('Game error:', err);
      }
    };
  }

  function attach(room, player) {
    if (socket.data.code && socket.data.code !== room.code) detach();
    if (player.socketId && player.socketId !== socket.id) {
      const previousSocket = io.sockets.sockets.get(player.socketId);
      previousSocket?.leave(room.code);
      if (previousSocket) previousSocket.data.code = null;
    }
    player.socketId = socket.id;
    socket.data.code = room.code;
    socket.data.token = player.token;
    socket.join(room.code);
    room.updatedAt = Date.now();
  }

  function detach() {
    const code = socket.data.code;
    const token = socket.data.token;
    if (!code || !token) return;
    try {
      const { room, player } = games.authorize(code, token);
      if (player.socketId === socket.id) {
        player.socketId = null;
        room.updatedAt = Date.now();
        broadcast(room);
      }
    } catch { /* expired room */ }
    socket.leave(code);
    socket.data.code = null;
    socket.data.token = null;
  }

  function ownRoom() {
    if (!socket.data.code || !socket.data.token) throw new GameError('Join a room first.');
    const result = games.authorize(socket.data.code, socket.data.token);
    if (result.player.socketId !== socket.id) throw new GameError('Your session moved to another device.');
    return result;
  }

  socket.on('room:create', safely(({ name, mode }) => {
    detach();
    const { room, player } = games.create(name, mode);
    attach(room, player);
    broadcast(room);
    return { code: room.code, token: player.token, room: publicRoom(room, player.id) };
  }));

  socket.on('room:join', safely(({ code, name }) => {
    detach();
    const { room, player } = games.join(code, name);
    attach(room, player);
    broadcast(room);
    return { code: room.code, token: player.token, room: publicRoom(room, player.id) };
  }));

  socket.on('room:resume', safely(({ code, token }) => {
    const { room, player } = games.join(code, null, token);
    attach(room, player);
    broadcast(room);
    return { code: room.code, token: player.token, room: publicRoom(room, player.id) };
  }));

  socket.on('room:mode', safely(({ mode }) => {
    const { room } = ownRoom();
    games.setMode(room.code, socket.data.token, mode);
    broadcast(room);
    return {};
  }));

  socket.on('room:secret', safely(({ code }) => {
    const { room } = ownRoom();
    games.setSecret(room.code, socket.data.token, code);
    broadcast(room);
    return {};
  }));

  socket.on('room:guess', safely(({ guess }) => {
    const { room } = ownRoom();
    games.guess(room.code, socket.data.token, guess);
    broadcast(room);
    return {};
  }));

  socket.on('room:rematch', safely(() => {
    const { room } = ownRoom();
    games.rematch(room.code, socket.data.token);
    broadcast(room);
    return {};
  }));

  socket.on('room:leave', safely(() => { detach(); return {}; }));
  socket.on('disconnect', detach);
});

const interval = setInterval(() => games.cleanup(), 10 * 60 * 1000);
interval.unref();

const port = Number(process.env.PORT || 3001);
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Fourcast listening on http://0.0.0.0:${port}`);
});
