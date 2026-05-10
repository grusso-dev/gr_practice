# Agent Notes

## Repo layout (important)
- This repo has **two separate Node apps**: `websocket/` (raw `ws`) and `socketio/` (Socket.IO).
- Both default to port `3000`; run only one at a time unless you change ports.
- Root `README` has no runnable instructions; rely on per-folder files/scripts.

## `websocket/` app (raw `ws`)
- Install/run from `websocket/`: `npm install` then `node server.js`.
- No real tests: `npm test` is a placeholder that always fails by design.
- Entrypoint in practice is `websocket/server.js` (even though `package.json` `main` is `index.js`).
- Static hosting is `express.static(__dirname)`: keep `websocket/index.html` in that folder unless you update static config.
- Handshake contract: query param `token` required, optional `user` and `room`.
- Demo tokens: `token-demo-123`, `token-demo-abc`.
- Message contract: JSON with `type` + `payload`; incoming types implemented are `chat_message` and `join_room`.
- Preserve existing safeguards in `websocket/server.js` (payload limit, auth check, room routing, heartbeat cleanup).

## `socketio/` app
- Install/run from `socketio/`: `npm install`, then `npm start` (`server.js`).
- Dev script: `npm run dev` (nodemon).
- External bridge server is separate: `npm run start:ext` (`server_ext.js`, listens on `4100`).
- `server.js` enforces handshake auth via `socket.handshake.auth.token`; demo tokens are `token-demo-123`, `token-demo-abc`.
- External publish endpoint is `POST /publish` on `server_ext.js` with header `x-api-key`.
- Learning docs index: `socketio/GUIA_SOCKETIO_NODE_EXPRESS.md`.

## Cross-project gotchas
- `websocket/` and `socketio/` are independent implementations; do not mix protocol assumptions (`ws` message schema vs Socket.IO events).
- There is no CI/workflow config in this repo; verify changes by running the relevant server(s) and manual browser checks.
