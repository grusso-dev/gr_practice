# Paso 7: Mensajes privados entre usuarios

## 1) Objetivo del paso

Agregar mensajes directos (privados) entre dos clientes conectados, sin que el resto de la room los vea.

## 2) Que cambia respecto al paso anterior

En el Paso 6 ya teniamos rooms y mensajes de sala (`chat_message`).

Ahora sumamos una segunda via de comunicacion:

- Seguimos teniendo mensajes publicos por room.
- Agregamos evento `private_message` para enviar solo a 1 destinatario.
- Registramos usuarios conectados en memoria para poder buscarlos por nombre.
- Mostramos en UI la lista de usuarios online para elegir destino.

## 3) Bloques de codigo que cambian vs Paso 6

### Bloque 1 (`server.js`) - mapa de usuarios online + evento privado

```js
const connectedUsers = new Map();

function broadcastUsers() {
  io.emit("users_update", { users: getUsersList() });
}

socket.on("private_message", (payload) => {
  const toSocketId = payload.toSocketId.trim();
  const target = connectedUsers.get(toSocketId);
  if (!target) return;

  const message = {
    fromUsername: socket.data.username,
    toUsername: target.username,
    texto: payload.texto.trim(),
    fecha: new Date().toISOString(),
  };

  io.to(toSocketId).emit("private_message", message);
  socket.emit("private_message", message);
});
```

### Bloque 2 (`index.html`) - selector de destinatario + formulario privado

```html
<select id="targetUser">
  <option value="">Selecciona destinatario</option>
</select>
<input id="textoPrivado" type="text" placeholder="Mensaje privado" />

<script>
  socket.on("users_update", (data) => updateTargetUsers(data.users));

  privateForm.addEventListener("submit", (event) => {
    event.preventDefault();
    socket.emit("private_message", {
      toSocketId: targetUserSelect.value,
      texto: textoPrivadoInput.value,
    });
  });
</script>
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

// Inicializa Socket.IO sobre el servidor HTTP.
const io = new Server(server);

// Sala por defecto al conectar.
const DEFAULT_ROOM = "general";

// Mapa en memoria para usuarios conectados.
// Key: socket.id
// Value: { username: string, room: string }
const connectedUsers = new Map();

// Entrega index.html en la raiz.
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
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

// Se ejecuta por cada cliente conectado.
io.on("connection", (socket) => {
  // Configura room inicial del socket.
  socket.data.currentRoom = DEFAULT_ROOM;
  socket.join(DEFAULT_ROOM);

  // Configura username temporal hasta que el cliente se registre.
  socket.data.username = `Anon-${socket.id.slice(0, 5)}`;

  // Guarda el usuario en el mapa en memoria.
  connectedUsers.set(socket.id, {
    username: socket.data.username,
    room: socket.data.currentRoom,
  });

  // Log de conexion.
  console.log(`Cliente conectado: ${socket.id} (${socket.data.username})`);

  // Informa room inicial solo al cliente emisor.
  socket.emit("room_joined", {
    room: DEFAULT_ROOM,
    mensaje: `Te uniste a la sala '${DEFAULT_ROOM}'.`,
  });

  // Notifica mensaje de sistema en la sala.
  io.to(DEFAULT_ROOM).emit("system_message", {
    mensaje: `Un usuario entro a '${DEFAULT_ROOM}'.`,
    fecha: new Date().toISOString(),
  });

  // Publica lista de usuarios al conectar uno nuevo.
  broadcastUsers();

  // Permite que el cliente registre/actualice su nombre visible.
  socket.on("register_user", (payload) => {
    // Valida que llegue username string.
    if (!payload || typeof payload.username !== "string") {
      socket.emit("error_message", {
        mensaje: "Debes enviar un nombre de usuario valido.",
      });
      return;
    }

    // Limpia espacios del username.
    const username = payload.username.trim();

    // Valida que no quede vacio.
    if (!username) {
      socket.emit("error_message", {
        mensaje: "El nombre de usuario no puede estar vacio.",
      });
      return;
    }

    // Actualiza username en memoria del socket.
    socket.data.username = username;

    // Actualiza registro del usuario en el mapa global.
    connectedUsers.set(socket.id, {
      username,
      room: socket.data.currentRoom,
    });

    // Confirma al cliente que su nombre fue actualizado.
    socket.emit("system_message", {
      mensaje: `Tu nombre ahora es '${username}'.`,
      fecha: new Date().toISOString(),
    });

    // Publica la lista actualizada a todos.
    broadcastUsers();
  });

  // Cambia de room igual que en el paso anterior.
  socket.on("join_room", (payload) => {
    // Valida payload.
    if (!payload || typeof payload.room !== "string") {
      socket.emit("error_message", {
        mensaje: "Debes enviar una room valida.",
      });
      return;
    }

    // Normaliza room.
    const nextRoom = payload.room.trim().toLowerCase();
    if (!nextRoom) {
      socket.emit("error_message", {
        mensaje: "El nombre de la room no puede estar vacio.",
      });
      return;
    }

    // Obtiene room previa.
    const prevRoom = socket.data.currentRoom;
    if (prevRoom === nextRoom) {
      socket.emit("system_message", {
        mensaje: `Ya estas en la sala '${nextRoom}'.`,
        fecha: new Date().toISOString(),
      });
      return;
    }

    // Cambia de room.
    socket.leave(prevRoom);
    socket.join(nextRoom);
    socket.data.currentRoom = nextRoom;

    // Actualiza room del usuario en mapa global.
    connectedUsers.set(socket.id, {
      username: socket.data.username,
      room: nextRoom,
    });

    // Confirma room al emisor.
    socket.emit("room_joined", {
      room: nextRoom,
      mensaje: `Ahora estas en la sala '${nextRoom}'.`,
    });

    // Mensajes de sistema en room vieja y nueva.
    io.to(prevRoom).emit("system_message", {
      mensaje: `Un usuario salio de '${prevRoom}'.`,
      fecha: new Date().toISOString(),
    });

    io.to(nextRoom).emit("system_message", {
      mensaje: `Un usuario entro a '${nextRoom}'.`,
      fecha: new Date().toISOString(),
    });

    // Publica cambios de room en listado de usuarios.
    broadcastUsers();
  });

  // Mensaje publico de room (igual idea del paso 6).
  socket.on("chat_message", (payload) => {
    // Valida payload minimo.
    if (!payload || typeof payload.texto !== "string") {
      socket.emit("error_message", {
        mensaje: "Formato de mensaje invalido.",
      });
      return;
    }

    // Limpia y valida texto.
    const textoLimpio = payload.texto.trim();
    if (!textoLimpio) {
      socket.emit("error_message", {
        mensaje: "El mensaje no puede estar vacio.",
      });
      return;
    }

    // Room actual del emisor.
    const room = socket.data.currentRoom;

    // Mensaje de sala final.
    const message = {
      type: "room",
      room,
      fromSocketId: socket.id,
      fromUsername: socket.data.username,
      texto: textoLimpio,
      fecha: new Date().toISOString(),
    };

    // Emite solo a la room actual.
    io.to(room).emit("chat_message", message);
  });

  // Nuevo: mensaje privado entre dos sockets.
  socket.on("private_message", (payload) => {
    // Valida estructura requerida.
    if (!payload || typeof payload.toSocketId !== "string" || typeof payload.texto !== "string") {
      socket.emit("error_message", {
        mensaje: "Formato invalido para mensaje privado.",
      });
      return;
    }

    // Limpia datos.
    const toSocketId = payload.toSocketId.trim();
    const textoLimpio = payload.texto.trim();

    // Valida texto no vacio.
    if (!textoLimpio) {
      socket.emit("error_message", {
        mensaje: "El mensaje privado no puede estar vacio.",
      });
      return;
    }

    // Evita enviarse privado a si mismo.
    if (toSocketId === socket.id) {
      socket.emit("error_message", {
        mensaje: "No puedes enviarte un mensaje privado a ti mismo.",
      });
      return;
    }

    // Verifica que el destinatario exista conectado.
    const target = connectedUsers.get(toSocketId);
    if (!target) {
      socket.emit("error_message", {
        mensaje: "El destinatario no esta conectado.",
      });
      return;
    }

    // Crea objeto final de mensaje privado.
    const message = {
      type: "private",
      fromSocketId: socket.id,
      fromUsername: socket.data.username,
      toSocketId,
      toUsername: target.username,
      texto: textoLimpio,
      fecha: new Date().toISOString(),
    };

    // Envia al destinatario especifico.
    io.to(toSocketId).emit("private_message", message);

    // Envia tambien al emisor para que vea su propio historial privado.
    socket.emit("private_message", message);
  });

  // Maneja desconexion de cliente.
  socket.on("disconnect", () => {
    const room = socket.data.currentRoom;
    console.log(`Cliente desconectado: ${socket.id} (${socket.data.username})`);

    // Elimina del mapa de conectados.
    connectedUsers.delete(socket.id);

    // Mensaje de sistema para la room que deja.
    io.to(room).emit("system_message", {
      mensaje: `Un usuario se desconecto de '${room}'.`,
      fecha: new Date().toISOString(),
    });

    // Publica lista actualizada.
    broadcastUsers();
  });
});

// Puerto del servidor.
const PORT = 3000;

// Inicia servidor HTTP + Socket.IO.
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
```

## 5) Codigo completo de `index.html` (copiar y pegar)

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Socket.IO - Paso 7</title>
    <style>
      /* Estilos base para demo de room + privados. */
      body {
        font-family: sans-serif;
        margin: 2rem;
        max-width: 1100px;
      }

      h1 {
        margin-bottom: 1rem;
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
    <h1>Paso 7 - Chat con mensajes privados</h1>

    <!-- Estado principal del cliente. -->
    <div id="estado">Conectando...</div>

    <!-- Form para registrar nombre de usuario visible. -->
    <form id="userForm" class="fila">
      <input id="username" type="text" placeholder="Tu nombre" value="ClienteDemo" />
      <div></div>
      <button type="submit">Guardar nombre</button>
    </form>

    <!-- Form para cambio de room. -->
    <form id="roomForm" class="fila">
      <input id="room" type="text" placeholder="Room (general, dev, soporte)" value="general" />
      <div></div>
      <button type="submit">Cambiar sala</button>
    </form>

    <!-- Form para chat publico por room. -->
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

    <!-- Zona de errores de validacion. -->
    <div id="error"></div>

    <!-- Cliente Socket.IO servido automaticamente. -->
    <script src="/socket.io/socket.io.js"></script>
    <script>
      // Crea conexion con servidor.
      const socket = io();

      // Referencias del DOM.
      const estado = document.getElementById("estado");
      const errorBox = document.getElementById("error");

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

      // Agrega un item en la lista de mensajes de sala.
      function addRoomMessage(texto, isSystem = false) {
        const li = document.createElement("li");
        if (isSystem) {
          li.classList.add("system");
        }
        li.textContent = texto;
        mensajesSala.appendChild(li);
      }

      // Agrega un item en la lista de mensajes privados.
      function addPrivateMessage(texto) {
        const li = document.createElement("li");
        li.classList.add("private");
        li.textContent = texto;
        mensajesPrivados.appendChild(li);
      }

      // Refresca el selector de destinatarios con usuarios online.
      function updateTargetUsers(users) {
        // Limpia opciones actuales.
        targetUserSelect.innerHTML = '<option value="">Selecciona destinatario</option>';

        // Agrega solo usuarios distintos al socket actual.
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

      // Evento al conectar el cliente.
      socket.on("connect", () => {
        estado.textContent = `Conectado: ${socket.id} | Sala: ${currentRoom}`;

        // Registra nombre inicial automaticamente.
        socket.emit("register_user", {
          username: usernameInput.value,
        });
      });

      // Actualiza estado de room actual.
      socket.on("room_joined", (data) => {
        currentRoom = data.room;
        estado.textContent = `Conectado: ${socket.id} | Sala: ${currentRoom}`;
        addRoomMessage(data.mensaje, true);
      });

      // Muestra mensajes de sistema en panel de sala.
      socket.on("system_message", (data) => {
        const hora = new Date(data.fecha).toLocaleTimeString();
        addRoomMessage(`[${hora}] ${data.mensaje}`, true);
      });

      // Muestra mensajes publicos en panel de sala.
      socket.on("chat_message", (data) => {
        const hora = new Date(data.fecha).toLocaleTimeString();
        addRoomMessage(`[${hora}] (${data.room}) ${data.fromUsername}: ${data.texto}`);
      });

      // Muestra mensajes privados en panel de privados.
      socket.on("private_message", (data) => {
        const hora = new Date(data.fecha).toLocaleTimeString();
        addPrivateMessage(`[${hora}] ${data.fromUsername} -> ${data.toUsername}: ${data.texto}`);
      });

      // Refresca lista de usuarios online para mensajes privados.
      socket.on("users_update", (data) => {
        updateTargetUsers(data.users);
      });

      // Muestra errores de validacion.
      socket.on("error_message", (data) => {
        errorBox.textContent = data.mensaje;
      });

      // Envía nombre de usuario al servidor.
      userForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        socket.emit("register_user", {
          username: usernameInput.value,
        });
      });

      // Solicita cambio de room.
      roomForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        socket.emit("join_room", {
          room: roomInput.value,
        });
      });

      // Envia mensaje publico de sala.
      chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        socket.emit("chat_message", {
          texto: textoRoomInput.value,
        });

        textoRoomInput.value = "";
        textoRoomInput.focus();
      });

      // Envia mensaje privado al usuario seleccionado.
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

Validacion recomendada:

1. Abre 2 o 3 pestañas en `http://localhost:3000`.
2. En cada pestaña guarda un nombre distinto.
3. Envia mensajes de sala para validar que room sigue funcionando.
4. Elige un destinatario en el selector y envia mensaje privado.
5. Verifica que el privado solo aparece en emisor y destinatario.

## 7) Errores comunes en este paso

- Si el selector de destinatarios esta vacio, revisa el evento `users_update`.
- Si el privado lo reciben todos, revisa que uses `io.to(toSocketId).emit(...)`.
- Si no puedes enviar privado, valida que `toSocketId` no este vacio.

## 8) Resultado de este paso

Ya tienes chat de sala + mensajes privados, una base solida para apps de mensajeria en tiempo real.

En el Paso 8 vamos a reforzar buenas practicas: validaciones mas fuertes, auth simple y reconexion.
