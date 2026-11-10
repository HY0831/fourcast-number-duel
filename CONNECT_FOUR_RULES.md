# Playgrove — Connect Four v1

## Rules

- Exactly two online players in a private 6-character room, on a 7-column × 6-row board.
- Player 1 (the creator) uses terracotta; Player 2 uses lime. A visible `1` or `2` also distinguishes discs without relying on colour alone.
- The room starts automatically when the second player joins. No setup/board arrangement and no turn timer.
- Player 1 moves first in Round 1. Players alternate. Tap any cell in a column to drop a disc into the **lowest available position**. Full columns are disabled.
- First player to form four connected discs horizontally, vertically, or diagonally wins. Four winning cells receive a high-contrast outline. A full 42-cell board with no winner is a draw.
- Server is authoritative about moves, gravity, turns, game outcomes, and rematch consent; the client cannot submit a winning result.
- If either player disconnects, no new moves are permitted until they return. Each player's room code and private token are locally retained, enabling reconnection while the room remains active in server memory.
- Rematches require **both players** to request. After both agree, the board resets and the first player alternates each round.
- Server restarts or Render redeployments reset in-memory multiplayer rooms, as with Fourcast and Bingo.

## UI / UX

- Mobile-first Playgrove earthy colours: deep terracotta discs vs lime discs, soft cream board cut-outs, blue-grey board background.
- Large single 7×6 board (seven column-sized hit areas); no separate number keypad or confirmation tap. Last move subtly outlined; winning line strongly emphasized.
- Private-room create/join screens, 6-character invitation, Copy/Share, online/offline indicators, player status, leave warning, both-confirm rematch screen.
- Responsive design at 320, 390, 768, and 1440px. No global style overrides to the other games.

## Implementation

- `server/connect-four-engine.mjs` — pure room store + authoritative move, win/draw, turn and rematch validation.
- `server/index.mjs` — isolated `connect4:*` Socket.IO handlers and disconnect/reconnection handling.
- `client/src/games/connect-four/ConnectFourPage.tsx` and `connect-four.css` — game UI, room invitation, reconnect, and mobile board.
- Homepage fifth game card and `/games/connect-four` route. Existing room/invite paths for Fourcast and Bingo are unchanged.
- Automated unit and browser tests cover gravity, invalid moves, win directions, disconnect/reconnect, rematches and navigation across all five games.

## Release

Build on a separate branch, verify TypeScript/unit/build and the full browser suite before merging. Render publishing is a separate step and needs an explicit deployment check.
