export type PlaygrovePage = 'hub' | 'fourcast' | 'sudoku' | 'bingo' | 'minesweeper' | 'connect-four' | '2048' | 'nonogram';
export type RouteResolution = { page: PlaygrovePage; redirect: string | null };
export function resolveHubRoute(pathname: string, search?: string): RouteResolution;