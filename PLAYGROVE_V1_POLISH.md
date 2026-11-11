# Playgrove V1 — Senior Game Developer Quality Pass

Date: 2026-11-11
Branch: `polish/playgrove-v1-quality-20261111`

## Goals and constraints

Playgrove has seven released games (Fourcast, Sudoku, Bingo Duel, Minesweeper, Connect Four, 2048, Nonogram). Keep the established earthy aesthetic, existing links, seven game engines, multiplayer Socket.IO events, saved-game schema, and rooms unmodified. Favor safe, testable quality improvements over cosmetic redesigns or new game features.

## Findings and implemented improvements

| Finding | User impact | Response |
| --- | --- | --- |
| All seven cards appear together with no discovery controls | Players scroll through games unrelated to their preferred mode | Add three functional All / Solo / Multiplayer filters, live keyword search and a clearable empty state |
| Choosing a game unmounts the homepage | Search and filter state would disappear on return | Persist discovery controls in per-tab `sessionStorage`, fail open if browser storage is blocked |
| Homepage eagerly imports code for all seven games | Initial JavaScript grows with each new game | Convert the six non-Fourcast game screens to React lazy imports; preserve Fourcast and homepage base bundle |
| Waiting for game code offers no visible indication | On slow networks, an empty area can be confusing | Accessible, responsive and reduced-motion-aware loading fallback |
| Repeated saved multiplayer banners have oversized separation | When multiple sessions are saved, the page becomes unnecessarily long | Reduce repeated banner gaps without removing any resume action |
| Growing list needs stronger keyboard and mobile QA | Filter discoverability must work on small screens, with keyboard accessibility | 44px filter targets, visible focus, pressed states, labelled search/results, no-overflow tests on 320px to 1440px |

## Deliberately unchanged

- Fourcast: secret codes, turns, client rooms, server events and guesses.
- Bingo Duel: board randomization, room lifecycle and five-line victory.
- Connect Four: gravity, turn validation, disconnected-room behavior and rematches.
- Sudoku: solution generation, notes, hints and completion scoring.
- Minesweeper: first-click safety, flag logic, field generation and victories.
- 2048: tile spawning, movement rules, one-step undo, save schema and high scores.
- Nonogram: all 30 authored picture matrices, clue computation, difficulty, hint limits and stored progress.
- No database changes; no restart of running servers merely to merge GitHub code.

## Quality gates

1. `npm run check`: TypeScript, all pure Node tests and Vite production build.
2. `npx playwright test`: complete Chromium regression suite for all seven games, including multi-browser-session multiplayer flows.
3. New homepage tests: Solo/Multiplayer visibility, search/no-results, filter persistence after navigation and 320/390/768/1440px overflow.
4. Merge the branch only after checks pass.
5. Deploy on Render only as a separate release action, knowing an in-memory room restart can interrupt active online games.

## Follow-up roadmap (proposed, not included)

**High:** persisted multiplayer room state across Render restarts, and reconnection testing under unstable networks.

**Medium:** optional cross-device solo save synchronisation and a full game-by-game accessibility audit with screen readers.

**Low:** additional game sorting/recommendation categories and richer completion stats, subject to player feedback.
