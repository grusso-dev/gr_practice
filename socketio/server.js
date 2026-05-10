// Importa Express para rutas HTTP.
const express = require("express");

// Importa HTTP nativo para crear servidor.
const http = require("http");

// Importa Server de Socket.IO para tiempo real.
const { Server } = require("socket.io");

// Crea app Express.
const app = express();

// Crea servidor HTTP sobre Express.
const server = http.createServer(app);

// Inicializa Socket.IO con opciones utiles de transporte.
const io = new Server(server, {
  // Permite fallback de transporte cuando aplica.
  transports: ["websocket", "polling"],
});

// Sala por defecto al conectar.
const DEFAULT_ROOM = "general";

// Tokens validos de demo (en produccion esto vendria de BD/JWT).
const VALID_TOKENS = new Set(["token-demo-123", "token-demo-abc"]);

// Reglas de negocio basicas.
const MAX_MESSAGE_LENGTH = 200;
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_MESSAGES = 8;

// Mapa en memoria para usuarios conectados.
// Key: socket.id
// Value: { username: string, room: string }
const connectedUsers = new Map();

// Mapa en memoria para rate limit por socket.
// Key: socket.id
// Value: { count: number, windowStart: number }
const rateState = new Map();

// Entrega index.html en la raiz.
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Middleware de autenticacion para handshake de Socket.IO.
io.use((socket, next) => {
  // Toma token desde auth del cliente.
  const token = socket.handshake.auth?.token;

  // Rechaza conexion si token no es valido.
  if (!token || !VALID_TOKENS.has(token)) {
    return next(new Error("Token invalido o ausente"));
  }

  // Guarda token validado en estado del socket.
  socket.data.token = token;
  return next();
});

// Construye una lista simple de usuarios para enviar al cliente.
function getUsersList() {
  const list = [];

  for (const [socketId, data] of connectedUsers.entries()) {
    list.push({
      socketId,
      username: data.username,
      room: data.room,
    });
  }

  return list;
}

// Emite la lista de usuarios online a todos.
function broadcastUsers() {
  io.emit("users_update", {
    users: getUsersList(),
  });
}

// Valida y normaliza texto de mensaje.
function normalizeMessageText(text) {
  if (typeof text !== "string") {
    return { ok: false, error: "El texto debe ser string." };
  }

  const normalized = text.trim();

  if (!normalized) {
    return { ok: false, error: "El mensaje no puede estar vacio." };
  }

  if (normalized.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `El mensaje excede ${MAX_MESSAGE_LENGTH} caracteres.`,
    };
  }

  return { ok: true, value: normalized };
}

// Control simple de frecuencia por socket.
function checkRateLimit(socketId) {
  const now = Date.now();
  const current = rateState.get(socketId);

  // Si no existe estado, se inicializa.
  if (!current) {
    rateState.set(socketId, { count: 1, windowStart: now });
    return { ok: true };
  }

  // Si vencio ventana, se reinicia contador.
  if (now - current.windowStart > RATE_WINDOW_MS) {
    rateState.set(socketId, { count: 1, windowStart: now });
    return { ok: true };
  }

  // Dentro de la misma ventana, incrementa contador.
  current.count += 1;
  rateState.set(socketId, current);

  // Si supera maximo, bloquea temporalmente.
  if (current.count > RATE_MAX_MESSAGES) {
    return {
      ok: false,
      error: "Demasiados mensajes en poco tiempo. Intenta en unos segundos.",
    };
  }

  return { ok: true };
}

// Se ejecuta por cada cliente conectado.
io.on("connection", (socket) => {
  // Configura room inicial.
  socket.data.currentRoom = DEFAULT_ROOM;
  socket.join(DEFAULT_ROOM);

  // Username temporal hasta registro explicito.
  socket.data.username = `Anon-${socket.id.slice(0, 5)}`;

  // Guarda usuario en memoria global.
  connectedUsers.set(socket.id, {
    username: socket.data.username,
    room: socket.data.currentRoom,
  });

  // Log de conexion autenticada.
  console.log(
    `Cliente conectado: ${socket.id} (${socket.data.username}) token=${socket.data.token}`
  );

  // Confirma room inicial al cliente.
  socket.emit("room_joined", {
    room: DEFAULT_ROOM,
    mensaje: `Te uniste a la sala '${DEFAULT_ROOM}'.`,
  });

  // Notifica entrada de usuario en la room.
  io.to(DEFAULT_ROOM).emit("system_message", {
    mensaje: `Un usuario entro a '${DEFAULT_ROOM}'.`,
    fecha: new Date().toISOString(),
  });

  // Publica lista de usuarios conectados.
  broadcastUsers();

  // Registro o cambio de username.
  socket.on("register_user", (payload) => {
    if (!payload || typeof payload.username !== "string") {
      socket.emit("error_message", {
        mensaje: "Debes enviar un nombre de usuario valido.",
      });
      return;
    }

    const username = payload.username.trim();
    if (!username) {
      socket.emit("error_message", {
        mensaje: "El nombre de usuario no puede estar vacio.",
      });
      return;
    }

    if (username.length > 30) {
      socket.emit("error_message", {
        mensaje: "El nombre de usuario no puede superar 30 caracteres.",
      });
      return;
    }

    socket.data.username = username;
    connectedUsers.set(socket.id, {
      username,
      room: socket.data.currentRoom,
    });

    socket.emit("system_message", {
      mensaje: `Tu nombre ahora es '${username}'.`,
      fecha: new Date().toISOString(),
    });

    broadcastUsers();
  });

  // Cambio de room.
  socket.on("join_room", (payload) => {
    if (!payload || typeof payload.room !== "string") {
      socket.emit("error_message", {
        mensaje: "Debes enviar una room valida.",
      });
      return;
    }

    const nextRoom = payload.room.trim().toLowerCase();
    if (!nextRoom) {
      socket.emit("error_message", {
        mensaje: "El nombre de la room no puede estar vacio.",
      });
      return;
    }

    if (nextRoom.length > 30) {
      socket.emit("error_message", {
        mensaje: "El nombre de room no puede superar 30 caracteres.",
      });
      return;
    }

    const prevRoom = socket.data.currentRoom;
    if (prevRoom === nextRoom) {
      socket.emit("system_message", {
        mensaje: `Ya estas en la sala '${nextRoom}'.`,
        fecha: new Date().toISOString(),
      });
      return;
    }

    socket.leave(prevRoom);
    socket.join(nextRoom);
    socket.data.currentRoom = nextRoom;

    connectedUsers.set(socket.id, {
      username: socket.data.username,
      room: nextRoom,
    });

    socket.emit("room_joined", {
      room: nextRoom,
      mensaje: `Ahora estas en la sala '${nextRoom}'.`,
    });

    io.to(prevRoom).emit("system_message", {
      mensaje: `Un usuario salio de '${prevRoom}'.`,
      fecha: new Date().toISOString(),
    });

    io.to(nextRoom).emit("system_message", {
      mensaje: `Un usuario entro a '${nextRoom}'.`,
      fecha: new Date().toISOString(),
    });

    broadcastUsers();
  });

  // Mensaje publico por room.
  socket.on("chat_message", (payload) => {
    // Aplica rate limit.
    const rate = checkRateLimit(socket.id);
    if (!rate.ok) {
      socket.emit("error_message", { mensaje: rate.error });
      return;
    }

    if (!payload) {
      socket.emit("error_message", {
        mensaje: "Formato de mensaje invalido.",
      });
      return;
    }

    // Valida texto del mensaje.
    const textValidation = normalizeMessageText(payload.texto);
    if (!textValidation.ok) {
      socket.emit("error_message", {
        mensaje: textValidation.error,
      });
      return;
    }

    const room = socket.data.currentRoom;

    const message = {
      type: "room",
      room,
      fromSocketId: socket.id,
      fromUsername: socket.data.username,
      texto: textValidation.value,
      fecha: new Date().toISOString(),
    };

    io.to(room).emit("chat_message", message);
  });

  // Mensaje privado.
  socket.on("private_message", (payload) => {
    // Aplica rate limit.
    const rate = checkRateLimit(socket.id);
    if (!rate.ok) {
      socket.emit("error_message", { mensaje: rate.error });
      return;
    }

    if (!payload || typeof payload.toSocketId !== "string") {
      socket.emit("error_message", {
        mensaje: "Formato invalido para mensaje privado.",
      });
      return;
    }

    const toSocketId = payload.toSocketId.trim();
    const target = connectedUsers.get(toSocketId);

    if (!target) {
      socket.emit("error_message", {
        mensaje: "El destinatario no esta conectado.",
      });
      return;
    }

    if (toSocketId === socket.id) {
      socket.emit("error_message", {
        mensaje: "No puedes enviarte un mensaje privado a ti mismo.",
      });
      return;
    }

    // Valida texto privado.
    const textValidation = normalizeMessageText(payload.texto);
    if (!textValidation.ok) {
      socket.emit("error_message", {
        mensaje: textValidation.error,
      });
      return;
    }

    const message = {
      type: "private",
      fromSocketId: socket.id,
      fromUsername: socket.data.username,
      toSocketId,
      toUsername: target.username,
      texto: textValidation.value,
      fecha: new Date().toISOString(),
    };

    io.to(toSocketId).emit("private_message", message);
    socket.emit("private_message", message);
  });

  // Desconexion.
  socket.on("disconnect", (reason) => {
    const room = socket.data.currentRoom;

    console.log(`Cliente desconectado: ${socket.id} reason=${reason}`);

    connectedUsers.delete(socket.id);
    rateState.delete(socket.id);

    io.to(room).emit("system_message", {
      mensaje: `Un usuario se desconecto de '${room}'.`,
      fecha: new Date().toISOString(),
    });

    broadcastUsers();
  });
});

// Puerto de escucha.
const PORT = 3000;

// Levanta servidor.
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log("Tokens demo validos: token-demo-123, token-demo-abc");
});