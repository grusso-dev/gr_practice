# Paso 9: Mini proyecto final (chat en tiempo real)

## 1) Objetivo del paso

Cerrar el aprendizaje con una version final, limpia y utilizable del chat:

- Chat publico por room.
- Mensajes privados.
- Auth simple por token.
- Validaciones y rate limit.
- Reconexion controlada.

## 2) Que cambia respecto al paso anterior

En el Paso 8 construimos una base robusta.

Ahora hacemos un cierre de proyecto para dejarlo "presentable":

- Consolidamos eventos y estructura.
- Agregamos historial simple por room (en memoria).
- Enviamos historial al entrar a una room.
- Ordenamos mejor responsabilidades y UX.

> Nota: sigue siendo demo local (memoria RAM). Si reinicias servidor, el historial se pierde.

## 3) Bloques de codigo que cambian vs Paso 8

### Bloque 1 (`server.js`) - historial por room + envio al entrar

```js
const roomHistory = new Map();

function pushRoomHistory(room, message) {
  const history = getRoomHistory(room);
  history.push(message);
  if (history.length > ROOM_HISTORY_LIMIT) {
    history.splice(0, history.length - ROOM_HISTORY_LIMIT);
  }
}

socket.emit("room_history", {
  room: nextRoom,
  messages: getRoomHistory(nextRoom),
});
```

### Bloque 2 (`index.html`) - render de historial al cambiar de room

```js
socket.on("room_history", (data) => {
  clearRoomMessages();

  data.messages.forEach((msg) => {
    const hora = new Date(msg.fecha).toLocaleTimeString();
    addRoomMessage(`[${hora}] (${msg.room}) ${msg.fromUsername}: ${msg.texto}`);
  });

  addRoomMessage(`Historial cargado de sala '${data.room}'.`, true);
});
```

## 4) Codigo completo de `server.js` (copiar y pegar)

```js
// Importa Express para servir HTML en la raiz.
const express = require("express");

// Importa HTTP nativo para montar Socket.IO encima.
const http = require("http");

// Importa Server de Socket.IO para eventos realtime.
const { Server } = require("socket.io");

// Crea app Express.
const app = express();

// Crea servidor HTTP con Express.
const server = http.createServer(app);

// Inicializa Socket.IO con opciones de transporte.
const io = new Server(server, {
  transports: ["websocket", "polling"],
});

// Configuracion base de demo.
const DEFAULT_ROOM = "general";
const VALID_TOKENS = new Set(["token-demo-123", "token-demo-abc"]);
const MAX_MESSAGE_LENGTH = 220;
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_MESSAGES = 10;
const ROOM_HISTORY_LIMIT = 30;

// Estado en memoria para usuarios online.
// Key: socket.id
// Value: { username: string, room: string }
const connectedUsers = new Map();

// Estado en memoria para rate limit por socket.
// Key: socket.id
// Value: { count: number, windowStart: number }
const rateState = new Map();

// Historial por room en memoria.
// Key: room
// Value: Array<message>
const roomHistory = new Map();

// Sirve el cliente principal.
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Middleware de auth por token en handshake.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token || !VALID_TOKENS.has(token)) {
    return next(new Error("Token invalido o ausente"));
  }

  socket.data.token = token;
  return next();
});

// Devuelve lista de usuarios online.
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

// Emite lista de usuarios a todos.
function broadcastUsers() {
  io.emit("users_update", {
    users: getUsersList(),
  });
}

// Valida y normaliza texto.
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

// Rate limit simple por ventana de tiempo.
function checkRateLimit(socketId) {
  const now = Date.now();
  const current = rateState.get(socketId);

  if (!current) {
    rateState.set(socketId, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (now - current.windowStart > RATE_WINDOW_MS) {
    rateState.set(socketId, { count: 1, windowStart: now });
    return { ok: true };
  }

  current.count += 1;
  rateState.set(socketId, current);

  if (current.count > RATE_MAX_MESSAGES) {
    return {
      ok: false,
      error: "Demasiados mensajes en poco tiempo. Espera unos segundos.",
    };
  }

  return { ok: true };
}

// Obtiene historial de una room; crea array si no existe.
function getRoomHistory(room) {
  if (!roomHistory.has(room)) {
    roomHistory.set(room, []);
  }

  return roomHistory.get(room);
}

// Agrega mensaje al historial con limite maximo.
function pushRoomHistory(room, message) {
  const history = getRoomHistory(room);
  history.push(message);

  // Recorta para mantener solo los ultimos N mensajes.
  if (history.length > ROOM_HISTORY_LIMIT) {
    history.splice(0, history.length - ROOM_HISTORY_LIMIT);
  }
}

// Maneja cada conexion.
io.on("connection", (socket) => {
  // Estado inicial del socket.
  socket.data.currentRoom = DEFAULT_ROOM;
  socket.data.username = `Anon-${socket.id.slice(0, 5)}`;

  // Se une a room default.
  socket.join(DEFAULT_ROOM);

  // Registra usuario conectado.
  connectedUsers.set(socket.id, {
    username: socket.data.username,
    room: socket.data.currentRoom,
  });

  console.log(
    `Cliente conectado: ${socket.id} (${socket.data.username}) token=${socket.data.token}`
  );

  // Informa sala actual y envia historial inicial.
  socket.emit("room_joined", {
    room: DEFAULT_ROOM,
    mensaje: `Te uniste a la sala '${DEFAULT_ROOM}'.`,
  });

  socket.emit("room_history", {
    room: DEFAULT_ROOM,
    messages: getRoomHistory(DEFAULT_ROOM),
  });

  // Mensaje de sistema para la sala.
  io.to(DEFAULT_ROOM).emit("system_message", {
    mensaje: `Un usuario entro a '${DEFAULT_ROOM}'.`,
    fecha: new Date().toISOString(),
  });

  // Publica usuarios online.
  broadcastUsers();

  // Registro/cambio de nombre.
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

  // Cambio de room + envio de historial.
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

    // Envia historial de la nueva room al usuario que acaba de entrar.
    socket.emit("room_history", {
      room: nextRoom,
      messages: getRoomHistory(nextRoom),
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

  // Mensaje publico de room.
  socket.on("chat_message", (payload) => {
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

    // Guarda historial y luego emite a la room.
    pushRoomHistory(room, message);
    io.to(room).emit("chat_message", message);
  });

  // Mensaje privado.
  socket.on("private_message", (payload) => {
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
    if (!toSocketId) {
      socket.emit("error_message", {
        mensaje: "Debes seleccionar un destinatario.",
      });
      return;
    }

    if (toSocketId === socket.id) {
      socket.emit("error_message", {
        mensaje: "No puedes enviarte un mensaje privado a ti mismo.",
      });
      return;
    }

    const target = connectedUsers.get(toSocketId);
    if (!target) {
      socket.emit("error_message", {
        mensaje: "El destinatario no esta conectado.",
      });
      return;
    }

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

    // Entrega al receptor y al emisor para ambos historiales locales.
    io.to(toSocketId).emit("private_message", message);
    socket.emit("private_message", message);
  });

  // Limpieza de estado al desconectar.
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

// Arranque de servidor.
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log("Tokens demo validos: token-demo-123, token-demo-abc");
});
```

## 5) Codigo completo de `index.html` (copiar y pegar)

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Socket.IO - Paso 9</title>
    <style>
      /* Layout final de la demo (desktop y mobile). */
      body {
        font-family: sans-serif;
        margin: 2rem;
        max-width: 1150px;
      }

      h1 {
        margin-bottom: 0.5rem;
      }

      #estado {
        margin-bottom: 0.5rem;
        font-weight: 700;
      }

      #connInfo {
        margin-bottom: 1rem;
        color: #444;
      }

      .fila {
        display: grid;
        grid-template-columns: 240px 1fr auto;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }

      input,
      select,
      button {
        padding: 0.6rem;
        font-size: 1rem;
      }

      .paneles {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-top: 0.5rem;
      }

      .panel {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 0.75rem;
      }

      .panel h2 {
        margin-top: 0;
      }

      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        min-height: 250px;
      }

      li {
        padding: 0.55rem;
        border-bottom: 1px solid #eee;
      }

      li:last-child {
        border-bottom: none;
      }

      .system {
        color: #555;
        font-style: italic;
      }

      .private {
        background: #f7fbff;
      }

      #error {
        color: #b00020;
        margin-top: 0.75rem;
        min-height: 1.2rem;
      }

      @media (max-width: 920px) {
        .fila {
          grid-template-columns: 1fr;
        }

        .paneles {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <h1>Paso 9 - Mini proyecto final</h1>
    <div id="estado">Conectando...</div>
    <div id="connInfo">Estado de red: iniciando...</div>

    <!-- Token para handshake autenticado. -->
    <form id="tokenForm" class="fila">
      <input id="token" type="text" value="token-demo-123" placeholder="Token" />
      <div></div>
      <button type="submit">Reconectar con token</button>
    </form>

    <!-- Nombre de usuario visible. -->
    <form id="userForm" class="fila">
      <input id="username" type="text" value="ClienteDemo" placeholder="Tu nombre" />
      <div></div>
      <button type="submit">Guardar nombre</button>
    </form>

    <!-- Cambio de sala. -->
    <form id="roomForm" class="fila">
      <input id="room" type="text" value="general" placeholder="Room" />
      <div></div>
      <button type="submit">Cambiar sala</button>
    </form>

    <!-- Mensaje publico por sala. -->
    <form id="chatForm" class="fila">
      <input id="textoRoom" type="text" placeholder="Mensaje publico" />
      <div></div>
      <button type="submit">Enviar a sala</button>
    </form>

    <!-- Mensaje privado. -->
    <form id="privateForm" class="fila">
      <select id="targetUser">
        <option value="">Selecciona destinatario</option>
      </select>
      <input id="textoPrivado" type="text" placeholder="Mensaje privado" />
      <button type="submit">Enviar privado</button>
    </form>

    <div class="paneles">
      <section class="panel">
        <h2>Mensajes de sala</h2>
        <ul id="mensajesSala"></ul>
      </section>

      <section class="panel">
        <h2>Mensajes privados</h2>
        <ul id="mensajesPrivados"></ul>
      </section>
    </div>

    <div id="error"></div>

    <!-- Cliente Socket.IO servido por el backend. -->
    <script src="/socket.io/socket.io.js"></script>
    <script>
      // Referencias DOM.
      const estado = document.getElementById("estado");
      const connInfo = document.getElementById("connInfo");
      const errorBox = document.getElementById("error");

      const tokenForm = document.getElementById("tokenForm");
      const tokenInput = document.getElementById("token");

      const userForm = document.getElementById("userForm");
      const usernameInput = document.getElementById("username");

      const roomForm = document.getElementById("roomForm");
      const roomInput = document.getElementById("room");

      const chatForm = document.getElementById("chatForm");
      const textoRoomInput = document.getElementById("textoRoom");

      const privateForm = document.getElementById("privateForm");
      const targetUserSelect = document.getElementById("targetUser");
      const textoPrivadoInput = document.getElementById("textoPrivado");

      const mensajesSala = document.getElementById("mensajesSala");
      const mensajesPrivados = document.getElementById("mensajesPrivados");

      // Estado local.
      let currentRoom = "general";
      let currentToken = tokenInput.value.trim();

      // Socket con auth por token y reconexion activa.
      const socket = io({
        autoConnect: false,
        auth: { token: currentToken },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 800,
      });

      // Utilidad para agregar mensaje en panel de sala.
      function addRoomMessage(texto, isSystem = false) {
        const li = document.createElement("li");
        if (isSystem) {
          li.classList.add("system");
        }
        li.textContent = texto;
        mensajesSala.appendChild(li);
      }

      // Utilidad para agregar mensaje privado.
      function addPrivateMessage(texto) {
        const li = document.createElement("li");
        li.classList.add("private");
        li.textContent = texto;
        mensajesPrivados.appendChild(li);
      }

      // Limpia panel de mensajes de sala (al cargar historial de otra room).
      function clearRoomMessages() {
        mensajesSala.innerHTML = "";
      }

      // Actualiza lista de destinatarios privados.
      function updateTargetUsers(users) {
        targetUserSelect.innerHTML = '<option value="">Selecciona destinatario</option>';

        users.forEach((user) => {
          if (user.socketId === socket.id) {
            return;
          }

          const option = document.createElement("option");
          option.value = user.socketId;
          option.textContent = `${user.username} (${user.room})`;
          targetUserSelect.appendChild(option);
        });
      }

      // Inicia conexion manual.
      socket.connect();

      // Conexion exitosa.
      socket.on("connect", () => {
        estado.textContent = `Conectado: ${socket.id} | Sala: ${currentRoom}`;
        connInfo.textContent = "Estado de red: conectado";

        // Registra nombre inicial al conectar.
        socket.emit("register_user", {
          username: usernameInput.value,
        });
      });

      // Error de handshake o auth.
      socket.on("connect_error", (err) => {
        connInfo.textContent = `Error de conexion: ${err.message}`;
      });

      // Eventos de reconexion.
      socket.io.on("reconnect_attempt", (attempt) => {
        connInfo.textContent = `Reintentando conexion... intento ${attempt}`;
      });

      socket.io.on("reconnect", (attempt) => {
        connInfo.textContent = `Reconectado correctamente en intento ${attempt}`;
      });

      // Confirmacion de room activa.
      socket.on("room_joined", (data) => {
        currentRoom = data.room;
        estado.textContent = `Conectado: ${socket.id} | Sala: ${currentRoom}`;
        addRoomMessage(data.mensaje, true);
      });

      // Historial de room recibido al entrar.
      socket.on("room_history", (data) => {
        // Limpia para reemplazar por historial de la room activa.
        clearRoomMessages();

        // Renderiza historial completo recibido.
        data.messages.forEach((msg) => {
          const hora = new Date(msg.fecha).toLocaleTimeString();
          addRoomMessage(`[${hora}] (${msg.room}) ${msg.fromUsername}: ${msg.texto}`);
        });

        // Marca visual de historial cargado.
        addRoomMessage(`Historial cargado de sala '${data.room}'.`, true);
      });

      // Mensajes de sistema.
      socket.on("system_message", (data) => {
        const hora = new Date(data.fecha).toLocaleTimeString();
        addRoomMessage(`[${hora}] ${data.mensaje}`, true);
      });

      // Mensajes publicos en vivo.
      socket.on("chat_message", (data) => {
        const hora = new Date(data.fecha).toLocaleTimeString();
        addRoomMessage(`[${hora}] (${data.room}) ${data.fromUsername}: ${data.texto}`);
      });

      // Mensajes privados en vivo.
      socket.on("private_message", (data) => {
        const hora = new Date(data.fecha).toLocaleTimeString();
        addPrivateMessage(`[${hora}] ${data.fromUsername} -> ${data.toUsername}: ${data.texto}`);
      });

      // Usuarios online para selector de privados.
      socket.on("users_update", (data) => {
        updateTargetUsers(data.users);
      });

      // Errores funcionales del backend.
      socket.on("error_message", (data) => {
        errorBox.textContent = data.mensaje;
      });

      // Reconexion manual con nuevo token.
      tokenForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        currentToken = tokenInput.value.trim();
        socket.auth = { token: currentToken };

        if (socket.connected) {
          socket.disconnect();
        }
        socket.connect();
      });

      // Cambia nombre de usuario.
      userForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        socket.emit("register_user", {
          username: usernameInput.value,
        });
      });

      // Cambia de room.
      roomForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        socket.emit("join_room", {
          room: roomInput.value,
        });
      });

      // Envia mensaje publico.
      chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        socket.emit("chat_message", {
          texto: textoRoomInput.value,
        });

        textoRoomInput.value = "";
        textoRoomInput.focus();
      });

      // Envia mensaje privado.
      privateForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        socket.emit("private_message", {
          toSocketId: targetUserSelect.value,
          texto: textoPrivadoInput.value,
        });

        textoPrivadoInput.value = "";
        textoPrivadoInput.focus();
      });
    </script>
  </body>
</html>
```

## 6) Como probar

```bash
npm start
```

Prueba integral sugerida:

1. Abre 2 o 3 pestañas y define nombre distinto en cada una.
2. Deja 2 usuarios en `general` y otro en `dev`.
3. Envia mensajes publicos y valida aislamiento por room.
4. Cambia un usuario de room y confirma que recibe historial al entrar.
5. Envia privados y valida que solo lleguen a emisor + receptor.
6. Prueba token invalido y reconexion con token valido.

## 7) Errores comunes en el mini proyecto

- Si no carga historial, valida eventos `room_history` en cliente y servidor.
- Si historial mezcla rooms, revisa que guardes con `pushRoomHistory(room, message)`.
- Si el selector de privados se vacia, revisa `users_update` despues de reconectar.

## 8) Cierre del aprendizaje

Con este paso ya cubriste el flujo completo de Socket.IO en Node.js + Express con una app realista:

- Conexion y eventos.
- Broadcast y rooms.
- Mensajeria privada.
- Auth de handshake.
- Validacion y control de abuso.
- Reconexion y UX minima de produccion.

Siguiente evolucion natural: persistencia real (PostgreSQL/Mongo), JWT real, y despliegue (Render/Fly/EC2).
