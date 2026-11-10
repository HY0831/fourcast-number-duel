/**
 * Tiny, dependency-free router for Playgrove's first game.
 * Keeping the legacy invite path intact avoids invalidating old Fourcast shares.
 */
export function resolveHubRoute(pathname, search = '') {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/games/fourcast') return { page: 'fourcast', redirect: null };
  if (path === '/games/sudoku') return { page: 'sudoku', redirect: null };
  if (path === '/games/bingo') return { page: 'bingo', redirect: null };
  if (path === '/games/minesweeper') return { page: 'minesweeper', redirect: null };
  if (path === '/games/connect-four') return { page: 'connect-four', redirect: null };
  if (path === '/') {
    const code = new URLSearchParams(search).get('room')?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || '';
    if (code) return { page: 'fourcast', redirect: `/games/fourcast?room=${code}` };
    return { page: 'hub', redirect: null };
  }
  return { page: 'hub', redirect: '/' };
}