# Paso 8: Buenas practicas (validacion, auth simple, reconexion)

## 1) Objetivo del paso

Fortalecer el chat para acercarlo a un escenario real:

- Validaciones mas estrictas de entrada.
- Autenticacion simple por token en handshake.
- Manejo de reconexion en el cliente.
- Limites basicos anti abuso (tamanio y frecuencia de mensajes).

## 2) Que cambia respecto al paso anterior

En el Paso 7 ya teniamos rooms + privados.

Ahora mejoramos robustez y seguridad basica:

- El cliente envia `token` al conectar: `io({ auth: { token } })`.
- El servidor valida token en middleware `io.use(...)`.
- Se agrega rate limit por socket (mensajes por ventana de tiempo).
- Se agrega limite de longitud de mensaje.
- El cliente escucha `reconnect`, `reconnect_attempt` y `connect_error`.

## 3) Bloques de codigo que cambian vs Paso 7

### Bloque 1 (`server.js`) - middleware de auth + validacion/rate limit

```js
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token || !VALID_TOKENS.has(token)) {
    return next(new Error("Token invalido o ausente"));
  }
  socket.data.token = token;
  return next();
});

function checkRateLimit(socketId) {
  // contador por ventana de tiempo
}

socket.on("chat_message", (payload) => {
  const rate = checkRateLimit(socket.id);
  if (!rate.ok) {
    socket.emit("error_message", { mensaje: rate.error });
    return;
  }
});
```

### Bloque 2 (`index.html`) - token en handshake + eventos de reconexion

```js
const socket = io({
  autoConnect: false,
  auth: { token: currentToken },
  reconnection: true,
});

socket.on("connect_error", (err) => {
  connInfo.textContent = `Error de conexion: ${err.message}`;
});

socket.io.on("reconnect_attempt", (attempt) => {
  connInfo.textContent = `Reintentando conexion... intento ${attempt}`;
});
```

## 4) Codigo completo de `server.js` (copiar y pegar)

```js
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
```

## 5) Codigo completo de `index.html` (copiar y pegar)

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Socket.IO - Paso 8</title>
    <style>
      /* Estilos base para demo con auth + reconexion. */
      body {
        font-family: sans-serif;
        margin: 2rem;
        max-width: 1100px;
      }

      .fila {
        display: grid;
        grid-template-columns: 220px 1fr auto;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }

      input,
      select,
      button {
        padding: 0.6rem;
        font-size: 1rem;
      }

      #estado {
        margin-bottom: 1rem;
        font-weight: 700;
      }

      #connInfo {
        margin-bottom: 1rem;
        color: #444;
      }

      .paneles {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .panel {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 0.75rem;
      }

      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        min-height: 220px;
      }

      li {
        padding: 0.6rem;
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

      @media (max-width: 900px) {
        .paneles {
          grid-template-columns: 1fr;
        }

        .fila {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <h1>Paso 8 - Buenas practicas</h1>

    <!-- Estado principal de conexion/sala. -->
    <div id="estado">Conectando...</div>

    <!-- Estado de reconexion y errores de handshake. -->
    <div id="connInfo">Estado de red: iniciando...</div>

    <!-- Form para token de autenticacion del handshake. -->
    <form id="tokenForm" class="fila">
      <input id="token" type="text" value="token-demo-123" placeholder="Token de acceso" />
      <div></div>
      <button type="submit">Reconectar con token</button>
    </form>

    <!-- Form para registrar nombre visible. -->
    <form id="userForm" class="fila">
      <input id="username" type="text" value="ClienteDemo" placeholder="Tu nombre" />
      <div></div>
      <button type="submit">Guardar nombre</button>
    </form>

    <!-- Form para cambio de room. -->
    <form id="roomForm" class="fila">
      <input id="room" type="text" value="general" placeholder="Room" />
      <div></div>
      <button type="submit">Cambiar sala</button>
    </form>

    <!-- Form para mensaje publico. -->
    <form id="chatForm" class="fila">
      <input id="textoRoom" type="text" placeholder="Mensaje publico de sala" />
      <div></div>
      <button type="submit">Enviar a sala</button>
    </form>

    <!-- Form para mensaje privado. -->
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

    <!-- Errores funcionales del servidor. -->
    <div id="error"></div>

    <!-- Cliente Socket.IO servido automaticamente por el servidor. -->
    <script src="/socket.io/socket.io.js"></script>
    <script>
      // Referencias DOM basicas.
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

      // Estado local minimo.
      let currentRoom = "general";
      let currentToken = tokenInput.value.trim();

      // Crea socket con token via auth en handshake.
      // Importante: autoConnect=false para controlar cuando conectar.
      const socket = io({
        autoConnect: false,
        auth: {
          token: currentToken,
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 800,
      });

      // Utilidad para mostrar mensaje de sala.
      function addRoomMessage(texto, isSystem = false) {
        const li = document.createElement("li");
        if (isSystem) {
          li.classList.add("system");
        }
        li.textContent = texto;
        mensajesSala.appendChild(li);
      }

      // Utilidad para mostrar mensaje privado.
      function addPrivateMessage(texto) {
        const li = document.createElement("li");
        li.classList.add("private");
        li.textContent = texto;
        mensajesPrivados.appendChild(li);
      }

      // Refresca selector de destinatarios con usuarios online.
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

      // Conecta manualmente el socket al iniciar.
      socket.connect();

      // Conexion exitosa.
      socket.on("connect", () => {
        estado.textContent = `Conectado: ${socket.id} | Sala: ${currentRoom}`;
        connInfo.textContent = "Estado de red: conectado";

        // Registra nombre apenas conecta correctamente.
        socket.emit("register_user", {
          username: usernameInput.value,
        });
      });

      // Captura errores de autenticacion/handshake.
      socket.on("connect_error", (err) => {
        connInfo.textContent = `Error de conexion: ${err.message}`;
      });

      // Evento cuando intenta reconectar.
      socket.io.on("reconnect_attempt", (attempt) => {
        connInfo.textContent = `Reintentando conexion... intento ${attempt}`;
      });

      // Evento al reconectar exitosamente.
      socket.io.on("reconnect", (attempt) => {
        connInfo.textContent = `Reconectado correctamente en intento ${attempt}`;
      });

      // Room confirmada por servidor.
      socket.on("room_joined", (data) => {
        currentRoom = data.room;
        estado.textContent = `Conectado: ${socket.id} | Sala: ${currentRoom}`;
        addRoomMessage(data.mensaje, true);
      });

      // Mensajes de sistema.
      socket.on("system_message", (data) => {
        const hora = new Date(data.fecha).toLocaleTimeString();
        addRoomMessage(`[${hora}] ${data.mensaje}`, true);
      });

      // Mensajes publicos.
      socket.on("chat_message", (data) => {
        const hora = new Date(data.fecha).toLocaleTimeString();
        addRoomMessage(`[${hora}] (${data.room}) ${data.fromUsername}: ${data.texto}`);
      });

      // Mensajes privados.
      socket.on("private_message", (data) => {
        const hora = new Date(data.fecha).toLocaleTimeString();
        addPrivateMessage(`[${hora}] ${data.fromUsername} -> ${data.toUsername}: ${data.texto}`);
      });

      // Actualizacion de usuarios online.
      socket.on("users_update", (data) => {
        updateTargetUsers(data.users);
      });

      // Errores funcionales del servidor.
      socket.on("error_message", (data) => {
        errorBox.textContent = data.mensaje;
      });

      // Reconecta manualmente con un token nuevo.
      tokenForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        currentToken = tokenInput.value.trim();

        // Actualiza token en auth para siguiente handshake.
        socket.auth = { token: currentToken };

        // Fuerza nueva conexion con credencial actualizada.
        if (socket.connected) {
          socket.disconnect();
        }
        socket.connect();
      });

      // Guarda nombre de usuario.
      userForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        socket.emit("register_user", {
          username: usernameInput.value,
        });
      });

      // Cambio de room.
      roomForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        socket.emit("join_room", {
          room: roomInput.value,
        });
      });

      // Mensaje publico.
      chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        socket.emit("chat_message", {
          texto: textoRoomInput.value,
        });

        textoRoomInput.value = "";
        textoRoomInput.focus();
      });

      // Mensaje privado.
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

Pruebas clave:

1. Con token valido (`token-demo-123`) debe conectar normal.
2. Cambia a token invalido en el form y reconecta: debe fallar con `connect_error`.
3. Vuelve a token valido y reconecta: debe recuperar sesion.
4. Envia muchos mensajes rapido (>8 en 10s): debe activar rate limit.
5. Envia un mensaje muy largo (>200 chars): debe rechazarlo.

## 7) Errores comunes en este paso

- Si nunca conecta, revisa que el token enviado exista en `VALID_TOKENS`.
- Si no se aplica rate limit, revisa que `checkRateLimit` se llame en chat publico y privado.
- Si reconecta pero sin token nuevo, revisa `socket.auth = { token: ... }` antes de `connect()`.

## 8) Resultado de este paso

Ya tienes una base bastante realista con validaciones, autenticacion simple y tolerancia a cortes de red.

En el Paso 9 cerramos con mini proyecto final y estructura recomendada para escalar.
