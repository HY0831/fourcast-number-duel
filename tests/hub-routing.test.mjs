import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHubRoute } from '../client/src/playgrove/routing.mjs';

test('Playgrove homepage is the default root route', () => {
  assert.deepEqual(resolveHubRoute('/', ''), { page: 'hub', redirect: null });
  assert.deepEqual(resolveHubRoute('/', '?source=friend'), { page: 'hub', redirect: null });
});

test('Fourcast game route is independent of Playgrove homepage', () => {
  assert.deepEqual(resolveHubRoute('/games/fourcast', ''), { page: 'fourcast', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/fourcast/', '?room=ABC123'), { page: 'fourcast', redirect: null });
});

test('legacy Fourcast room invites at the root are redirected without losing the code', () => {
  assert.deepEqual(resolveHubRoute('/', '?room=ABC123'), { page: 'fourcast', redirect: '/games/fourcast?room=ABC123' });
  assert.deepEqual(resolveHubRoute('/', '?utm=test&room=abc123'), { page: 'fourcast', redirect: '/games/fourcast?room=ABC123' });
});

test('room invite sanitization does not accept injected path components', () => {
  assert.deepEqual(resolveHubRoute('/', '?room=ab-c+12%20zz'), { page: 'fourcast', redirect: '/games/fourcast?room=ABC12Z' });
});

test('unknown and trailing-slash routes have a safe canonical destination', () => {
  assert.deepEqual(resolveHubRoute('/random-page', ''), { page: 'hub', redirect: '/' });
  assert.deepEqual(resolveHubRoute('/games/fourcast///', ''), { page: 'fourcast', redirect: null });
});


test('Sudoku has its own route without changing legacy Fourcast invites', () => {
  assert.deepEqual(resolveHubRoute('/games/sudoku'), { page: 'sudoku', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/sudoku/'), { page: 'sudoku', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/fourcast?room=ABC123', ''), { page: 'hub', redirect: '/' });
  assert.deepEqual(resolveHubRoute('/', '?room=ABC123'), { page: 'fourcast', redirect: '/games/fourcast?room=ABC123' });
});
test('Bingo has a standalone route without overriding Fourcast or Sudoku invitations', () => {
  assert.deepEqual(resolveHubRoute('/games/bingo'), { page: 'bingo', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/bingo/', '?room=XY2345'), { page: 'bingo', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/sudoku'), { page: 'sudoku', redirect: null });
  assert.deepEqual(resolveHubRoute('/', '?room=AB2345'), { page: 'fourcast', redirect: '/games/fourcast?room=AB2345' });
});

test('Minesweeper is standalone and keeps Fourcast and Bingo invitation routes', () => {
  assert.deepEqual(resolveHubRoute('/games/minesweeper'), { page: 'minesweeper', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/minesweeper/'), { page: 'minesweeper', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/bingo','?room=XY2345'), { page: 'bingo', redirect: null });
  assert.deepEqual(resolveHubRoute('/', '?room=AB2345'), { page: 'fourcast', redirect: '/games/fourcast?room=AB2345' });
});

test('Connect Four has its own route without changing existing game rooms', () => {
  assert.deepEqual(resolveHubRoute('/games/connect-four'), { page: 'connect-four', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/connect-four/','?room=AB2345'), { page: 'connect-four', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/bingo','?room=XY2345'), { page: 'bingo', redirect: null });
  assert.deepEqual(resolveHubRoute('/', '?room=AB2345'), { page: 'fourcast', redirect: '/games/fourcast?room=AB2345' });
});

test('2048 has a standalone route without breaking any multiplayer invitations', () => {
  assert.deepEqual(resolveHubRoute('/games/2048'), { page: '2048', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/2048/'), { page: '2048', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/connect-four', '?room=ABC123'), { page: 'connect-four', redirect: null });
  assert.deepEqual(resolveHubRoute('/', '?room=ABC123'), { page: 'fourcast', redirect: '/games/fourcast?room=ABC123' });
});

test('Nonogram uses an independent route without changing any existing game invitations', () => {
  assert.deepEqual(resolveHubRoute('/games/nonogram'), { page: 'nonogram', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/nonogram/'), { page: 'nonogram', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/2048'), { page: '2048', redirect: null });
  assert.deepEqual(resolveHubRoute('/games/bingo','?room=XY2345'), { page: 'bingo', redirect: null });
  assert.deepEqual(resolveHubRoute('/', '?room=AB2345'), { page: 'fourcast', redirect: '/games/fourcast?room=AB2345' });
});


test('Hashi is the eighth standalone route and does not affect existing invitations',()=>{
  assert.deepEqual(resolveHubRoute('/games/hashi'),{page:'hashi',redirect:null});
  assert.deepEqual(resolveHubRoute('/games/hashi/'),{page:'hashi',redirect:null});
  assert.deepEqual(resolveHubRoute('/', '?room=AB2345'),{page:'fourcast',redirect:'/games/fourcast?room=AB2345'});
});

test('Reversi route is independent and preserves all multiplayer invite redirects',()=>{
  assert.deepEqual(resolveHubRoute('/games/reversi'),{page:'reversi',redirect:null});
  assert.deepEqual(resolveHubRoute('/games/reversi/','?room=ABC123'),{page:'reversi',redirect:null});
  assert.deepEqual(resolveHubRoute('/games/connect-four','?room=AB2345'),{page:'connect-four',redirect:null});
  assert.deepEqual(resolveHubRoute('/','?room=AB2345'),{page:'fourcast',redirect:'/games/fourcast?room=AB2345'});
});
