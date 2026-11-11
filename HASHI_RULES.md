# Playgrove Game #8 — Hashi: Bridges

**Status:** approved for implementation; standalone single-player puzzle game. No accounts, server endpoints or database.

## Complete rules
- Every numbered circle is an island, whose number is the total bridges incident to it.
- Draw only horizontal or vertical bridges between the nearest islands in the same row or column.
- A pair of islands can be joined by zero, one or two parallel bridges.
- Bridges may not cross one another or pass through an intervening island.
- A win requires every island to have exactly the required bridge count **and** all islands to form one connected component.
- Islands may momentarily have too many bridges while experimenting. **Check** reports number overload and fully satisfied but disconnected groups without requiring the player's layout to match a hidden stored answer.
- Crossing connections are prevented, rather than accepted as an invalid move.

## Controls
- **Touch/mouse:** tap island A then island B; or tap the faint path between a pair to cycle 0 → 1 → 2 → 0 bridges.
- **Drag:** touch/mouse pointer down on island A and release over island B for an optional shortcut.
- **Reverse:** right-click a bridge path to cycle 0 → 2 → 1 → 0.
- **Keyboard:** Tab to focus a bridge path or island; Enter or Space activates the focused element.
- **No bridge:** toggle the marking mode and tap an unused path to mark that connection ruled out. The mark is not an actual bridge.
- **Undo/Redo:** reversible per-move history (last 80 actions); includes hint usage.
- **Hint:** up to three per puzzle. Corrects or reveals one bridge assignment from the uniquely validated solution. Counts toward the hint tally.
- **Check:** reports local constraint mismatches, numerical overload, and separated satisfied groups; never falsely claims the entire puzzle is solved on numbers alone.
- **Pause:** overlays the board and stops its visible timer; Resume restores it.
- **Restart:** requires confirmation. Replay, Next puzzle, and Back to library appear upon winning.
- **Zoom:** three scale levels. The board scrolls in its own panel on small mobile screens.
- Browser localStorage saves the current puzzle, bridge/mark state, timer, hints, undo/redo history, completion, and best personal time per puzzle; storage errors degrade gracefully to in-memory play.

## Puzzle library
45 **fixed authored records**, with unique IDs and individual titles, not a random puzzle shown on each visit:
- **Easy:** E01–E15; 7×7; 7–12 islands; basic forced deductions.
- **Medium:** M01–M15; 10×10; 16–22 islands; more constraints and connectivity.
- **Hard:** H01–H15; 15×15; 27–32 islands; larger connected networks and advanced linked deductions.

The supplied IDs/titles are defined in client/src/games/hashi/puzzle-library.mjs. The puzzle records store coordinates, numbered targets and the validated answer edge assignments (compact hexadecimal island triples and base-three bridge digits). Data is deterministic and remains locally playable; there is no API call to generate a puzzle.

## Solver-backed quality gate
The Node tests in tests/hashi-engine.test.mjs validate:
1. The exact 15/15/15 level distribution and unique IDs/titles.
2. Every puzzle's geometry, clue bounds, edge order, no crossed answer bridges, number sums and connected solution graph.
3. **Exactly one solution for all 45 puzzles** using the independent full constraint solver, including zero, one, and two bridges for each candidate edge, forbidden crossings, numerical constraints and network connectivity.
4. Crossing rejection, no-bridge marks, Undo/Redo, hints, corrupt-save fallbacks and disconnected fully matched groups.

The e2e/hashi.spec.ts file covers the actual browser UI, gallery, filtering, tap and keyboard controls, reload restoration, hints, pause, zoom, reset, solver-backed completion and mobile viewport overflow. The full preexisting seven-game Chromium suite must stay green.

## Technical integration
- Game route: /games/hashi.
- Separate React page, scoped CSS, pure .mjs engine and typed .d.mts declarations.
- Lazy-loaded alongside the other solo games.
- Playgrove homepage changes its count from 07 to 08, adds a searchable Solo card and retains all existing invitation links.
- No changes to Socket.IO multiplayer protocols, room storage, Render plan, Node server or dependencies.
- The Render Free service can sleep; local solo progress remains in the same browser even across server restarts.

## Release status
- [x] Design approved.
- [x] Code and 45-puzzle library authored in isolated feature branch.
- [x] Automated unique-solution verification implemented.
- [ ] Complete GitHub TypeScript/Node/build and all Chromium browser gates.
- [ ] PR merge after green checks.
- [ ] Release to existing Render Free service after verifying deployment status.
- [ ] Manual real-phone touch/drag and TalkBack/VoiceOver QA (do not claim these as tested by CI).
