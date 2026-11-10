import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import { GameError, GameStore, publicRoom } from './game-engine.mjs';
import { BingoStore, publicBingoRoom } from './bingo-engine.mjs';
import { ConnectFourStore, publicConnectFourRoom } from './connect-four-engine.mjs';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || true, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 32 * 1024,
  pingTimeout: 20000,
});
const games = new GameStore();
const bingos = new BingoStore();
const connectFours = new ConnectFourStore();
const here = dirname(fileURLToPath(import.meta.url));

app.get('/health', (_req, res) => res.json({ status: 'ok', activeRooms: games.rooms.size, activeBingoRooms: bingos.rooms.size, activeConnectFourRooms: connectFours.rooms.size }));
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

function broadcastBingo(room) {
  for (const player of room.players) {
    if (player.socketId) io.to(player.socketId).emit('bingo:update', publicBingoRoom(room, player.id));
  }
}

function broadcastConnectFour(room) {
  for (const player of room.players) {
    if (player.socketId) io.to(player.socketId).emit('connect4:update', publicConnectFourRoom(room, player.id));
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
    detachBingo();
    detachConnectFour();
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

  function attachBingo(room, player) {
    detach();
    detachConnectFour();
    if (socket.data.bingoCode && socket.data.bingoCode !== room.code) detachBingo();
    if (player.socketId && player.socketId !== socket.id) {
      const oldSocket = io.sockets.sockets.get(player.socketId);
      oldSocket?.leave(`bingo:${room.code}`);
      if (oldSocket) {
        oldSocket.data.bingoCode = null;
        oldSocket.data.bingoToken = null;
      }
    }
    player.socketId = socket.id;
    socket.data.bingoCode = room.code;
    socket.data.bingoToken = player.token;
    socket.join(`bingo:${room.code}`);
    room.updatedAt = Date.now();
  }

  function detachBingo() {
    const code = socket.data.bingoCode;
    const token = socket.data.bingoToken;
    if (!code || !token) return;
    try {
      const { room, player } = bingos.authorize(code, token);
      if (player.socketId === socket.id) {
        player.socketId = null;
        room.updatedAt = Date.now();
        broadcastBingo(room);
      }
    } catch { /* expired room */ }
    socket.leave(`bingo:${code}`);
    socket.data.bingoCode = null;
    socket.data.bingoToken = null;
  }

  function ownBingoRoom() {
    if (!socket.data.bingoCode || !socket.data.bingoToken) throw new GameError('Join a Bingo room first.');
    const result = bingos.authorize(socket.data.bingoCode, socket.data.bingoToken);
    if (result.player.socketId !== socket.id) throw new GameError('Your session moved to another device.');
    return result;
  }

  socket.on('bingo:create', safely(({ name }) => {
    detachBingo();
    const { room, player } = bingos.create(name);
    attachBingo(room, player);
    broadcastBingo(room);
    return { code: room.code, token: player.token, room: publicBingoRoom(room, player.id) };
  }));

  socket.on('bingo:join', safely(({ code, name }) => {
    detachBingo();
    const { room, player } = bingos.join(code, name);
    attachBingo(room, player);
    broadcastBingo(room);
    return { code: room.code, token: player.token, room: publicBingoRoom(room, player.id) };
  }));

  socket.on('bingo:resume', safely(({ code, token }) => {
    const { room, player } = bingos.join(code, null, token);
    attachBingo(room, player);
    broadcastBingo(room);
    return { code: room.code, token: player.token, room: publicBingoRoom(room, player.id) };
  }));

  socket.on('bingo:board', safely(({ board }) => {
    const { room } = ownBingoRoom();
    bingos.lockBoard(room.code, socket.data.bingoToken, board);
    broadcastBingo(room);
    return {};
  }));

  socket.on('bingo:call', safely(({ number }) => {
    const { room } = ownBingoRoom();
    bingos.callNumber(room.code, socket.data.bingoToken, number);
    broadcastBingo(room);
    return {};
  }));

  socket.on('bingo:rematch', safely(() => {
    const { room } = ownBingoRoom();
    bingos.rematch(room.code, socket.data.bingoToken);
    broadcastBingo(room);
    return {};
  }));

  socket.on('bingo:leave', safely(() => { detachBingo(); return {}; }));

  function attachConnectFour(room, player) {
    detach();
    detachBingo();
    if (socket.data.connectFourCode && socket.data.connectFourCode !== room.code) detachConnectFour();
    if (player.socketId && player.socketId !== socket.id) {
      const previous = io.sockets.sockets.get(player.socketId);
      previous?.leave(`connect4:${room.code}`);
      if (previous) {
        previous.data.connectFourCode = null;
        previous.data.connectFourToken = null;
      }
    }
    player.socketId = socket.id;
    socket.data.connectFourCode = room.code;
    socket.data.connectFourToken = player.token;
    socket.join(`connect4:${room.code}`);
    room.updatedAt = Date.now();
  }

  function detachConnectFour() {
    const code = socket.data.connectFourCode;
    const token = socket.data.connectFourToken;
    if (!code || !token) return;
    try {
      const { room, player } = connectFours.authorize(code, token);
      if (player.socketId === socket.id) {
        player.socketId = null;
        room.updatedAt = Date.now();
        broadcastConnectFour(room);
      }
    } catch { /* expired room */ }
    socket.leave(`connect4:${code}`);
    socket.data.connectFourCode = null;
    socket.data.connectFourToken = null;
  }

  function ownConnectFourRoom() {
    if (!socket.data.connectFourCode || !socket.data.connectFourToken) throw new GameError('Join a Connect Four room first.');
    const result = connectFours.authorize(socket.data.connectFourCode, socket.data.connectFourToken);
    if (result.player.socketId !== socket.id) throw new GameError('Your session moved to another device.');
    return result;
  }

  socket.on('connect4:create', safely(({ name }) => {
    detachConnectFour();
    const { room, player } = connectFours.create(name);
    attachConnectFour(room, player);
    broadcastConnectFour(room);
    return { code: room.code, token: player.token, room: publicConnectFourRoom(room, player.id) };
  }));

  socket.on('connect4:join', safely(({ code, name }) => {
    detachConnectFour();
    const { room, player } = connectFours.join(code, name);
    attachConnectFour(room, player);
    broadcastConnectFour(room);
    return { code: room.code, token: player.token, room: publicConnectFourRoom(room, player.id) };
  }));

  socket.on('connect4:resume', safely(({ code, token }) => {
    const { room, player } = connectFours.join(code, null, token);
    attachConnectFour(room, player);
    broadcastConnectFour(room);
    return { code: room.code, token: player.token, room: publicConnectFourRoom(room, player.id) };
  }));

  socket.on('connect4:drop', safely(({ column }) => {
    const { room } = ownConnectFourRoom();
    connectFours.play(room.code, socket.data.connectFourToken, column);
    broadcastConnectFour(room);
    return {};
  }));

  socket.on('connect4:rematch', safely(() => {
    const { room } = ownConnectFourRoom();
    connectFours.requestRematch(room.code, socket.data.connectFourToken);
    broadcastConnectFour(room);
    return {};
  }));

  socket.on('connect4:leave', safely(() => { detachConnectFour(); return {}; }));

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
  socket.on('disconnect', () => { detach(); detachBingo(); detachConnectFour(); });
});

const interval = setInterval(() => { games.cleanup(); bingos.cleanup(); connectFours.cleanup(); }, 10 * 60 * 1000);
interval.unref();

const port = Number(process.env.PORT || 3001);
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Fourcast listening on http://0.0.0.0:${port}`);
});
