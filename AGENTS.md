# Agent Notes

## Repo shape
- This repo is currently a single Node project under `websocket/` (root `README` has no runnable instructions).
- Main runnable app files are `websocket/server.js` and `websocket/index.html`.
- Learning docs are in `websocket/pasos-websocket/` with index at `websocket/pasos-websocket/README.md`.

## Runtime and commands (verified)
- Install deps: `npm install` (run inside `websocket/`).
- Run app: `node server.js` (inside `websocket/`).
- Open client: `http://localhost:3000`.
- `npm test` is a placeholder that exits with error (`"Error: no test specified"`); do not treat it as a real test suite.

## WebSocket contract used by current app
- Server expects handshake query params: `token`, optional `user`, optional `room`.
- Demo valid tokens in `websocket/server.js`: `token-demo-123`, `token-demo-abc`.
- Message format is JSON with `type` + `payload`.
- Implemented incoming message types: `chat_message`, `join_room`.
- Implemented outgoing types include: `system_message`, `presence`, `chat_message`, `error`.

## Gotchas that are easy to miss
- Static hosting is `express.static(__dirname)`: `index.html` must stay in `websocket/` unless server static path changes.
- `websocket/server.js` already includes payload limits, auth check, room routing, and heartbeat cleanup; preserve these behaviors when editing.
- `websocket/package.json` `main` is `index.js`, but actual entrypoint in use is `server.js`.
