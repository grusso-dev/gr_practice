// Importa Express para exponer endpoint HTTP de publicacion.
const express = require("express");

// Importa cliente Socket.IO para conectarse al servidor de chat existente.
const { io } = require("socket.io-client");

// Configuracion del bridge externo.
const BRIDGE_PORT = 4100;
const BRIDGE_API_KEY = "bridge-key-demo-123";
const SOCKET_SERVER_URL = "http://localhost:3000";
const SOCKET_TOKEN = "token-demo-123";
const DEFAULT_ROOM = "general";

// Crea app HTTP.
const app = express();
app.use(express.json());

// Conecta este servidor externo como cliente al Socket.IO principal.
const socket = io(SOCKET_SERVER_URL, {
  auth: { token: SOCKET_TOKEN },
  reconnection: true,
});

// Logs de estado para diagnostico rapido.
socket.on("connect", () => {
  console.log(`[server_ext] conectado a Socket.IO como ${socket.id}`);
});

socket.on("connect_error", (err) => {
  console.error(`[server_ext] error de conexion: ${err.message}`);
});

// Endpoint que recibe mensajes externos y los publica al chat.
app.post("/publish", (req, res) => {
  // Valida API key del emisor externo.
  const apiKey = req.header("x-api-key");
  if (apiKey !== BRIDGE_API_KEY) {
    return res.status(401).json({ ok: false, error: "API key invalida" });
  }

  // Valida payload minimo.
  const room = typeof req.body.room === "string" ? req.body.room.trim().toLowerCase() : DEFAULT_ROOM;
  const texto = typeof req.body.texto === "string" ? req.body.texto.trim() : "";
  const usuario = typeof req.body.usuario === "string" ? req.body.usuario.trim() : "externo";

  if (!texto) {
    return res.status(400).json({ ok: false, error: "texto requerido" });
  }

  // El servidor principal enruta por room actual del socket.
  // Primero cambiamos room/usuario y luego emitimos chat_message.
  socket.emit("join_room", { room });
  socket.emit("register_user", { username: usuario });
  socket.emit("chat_message", { texto });

  return res.json({ ok: true, room, usuario, texto });
});

// Arranca servidor externo.
app.listen(BRIDGE_PORT, () => {
  console.log(`[server_ext] HTTP listo en http://localhost:${BRIDGE_PORT}`);
});
