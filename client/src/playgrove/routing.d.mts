export type PlaygrovePage = 'hub' | 'fourcast' | 'sudoku' | 'bingo' | 'minesweeper' | 'connect-four';
export type RouteResolution = { page: PlaygrovePage; redirect: string | null };
export function resolveHubRoute(pathname: string, search?: string): RouteResolution;