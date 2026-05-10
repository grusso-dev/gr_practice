# Paso 6: Broadcast selectivo y rooms

## 1) Objetivo del paso

Separar conversaciones por salas (rooms) para que no todos reciban todos los mensajes.

## 2) Que cambia respecto al paso anterior

En el Paso 5 usamos `io.emit("chat_message", ...)`, que envia a todos los clientes conectados.

Ahora cambiamos a un modelo por sala:

- Cada cliente se une a una room (por ejemplo `general`, `soporte`, `dev`).
- Los mensajes se emiten con `io.to(room).emit(...)`.
- Solo reciben el mensaje los clientes de esa room.
- Agregamos evento `join_room` para cambiar de sala en caliente.

## 3) Bloques de codigo que cambian vs Paso 5

### Bloque 1 (`server.js`) - room actual por socket + join_room + emision por room

```js
socket.data.currentRoom = DEFAULT_ROOM;
socket.join(DEFAULT_ROOM);

socket.on("join_room", (payload) => {
  const prevRoom = socket.data.currentRoom;
  const nextRoom = payload.room.trim().toLowerCase();

  socket.leave(prevRoom);
  socket.join(nextRoom);
  socket.data.currentRoom = nextRoom;
});

socket.on("chat_message", (payload) => {
  const room = socket.data.currentRoom;
  io.to(room).emit("chat_message", { room, texto: payload.texto });
});
```

### Bloque 2 (`index.html`) - form de room + estado visual de sala

```html
<div id="estadoRoom">Sala actual: (cargando...)</div>

<form id="roomForm">
  <input id="room" type="text" value="general" />
  <button type="submit">Cambiar sala</button>
</form>

<script>
  roomForm.addEventListener("submit", (event) => {
    event.preventDefault();
    socket.emit("join_room", { room: roomInput.value });
  });

  socket.on("room_joined", (data) => {
    estadoRoom.textContent = `Sala actual: ${data.room}`;
  });
</script>
```

## 4) Codigo completo de `server.js` (copiar y pegar)

```js
// Importa Express para rutas HTTP.
const express = require("express");

// Importa el servidor HTTP nativo de Node.
const http = require("http");

// Importa Socket.IO para la comunicacion en tiempo real.
const { Server } = require("socket.io");

// Crea la app de Express.
const app = express();

// Crea servidor HTTP con la app.
const server = http.createServer(app);

// Monta Socket.IO sobre el servidor HTTP.
const io = new Server(server);

// Define una sala por defecto para nuevos clientes.
const DEFAULT_ROOM = "general";

// Entrega el cliente HTML principal.
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Se ejecuta por cada conexion Socket.IO nueva.
io.on("connection", (socket) => {
  // Guarda la room actual del cliente en una propiedad del socket.
  socket.data.currentRoom = DEFAULT_ROOM;

  // Une automaticamente al cliente a la room por defecto.
  socket.join(DEFAULT_ROOM);

  // Log de conexion.
  console.log(`Cliente conectado: ${socket.id} (room: ${DEFAULT_ROOM})`);

  // Informa solo al cliente su room inicial.
  socket.emit("room_joined", {
    room: DEFAULT_ROOM,
    mensaje: `Te uniste a la sala '${DEFAULT_ROOM}'.`,
  });

  // Notifica a la sala que alguien entro.
  io.to(DEFAULT_ROOM).emit("system_message", {
    mensaje: `Un nuevo usuario entro a '${DEFAULT_ROOM}'.`,
    fecha: new Date().toISOString(),
  });

  // Permite cambiar de room en tiempo real.
  socket.on("join_room", (payload) => {
    // Valida que llegue un nombre de sala string.
    if (!payload || typeof payload.room !== "string") {
      socket.emit("error_message", {
        mensaje: "Debes enviar una room valida.",
      });
      return;
    }

    // Normaliza y limpia el nombre de sala.
    const nextRoom = payload.room.trim().toLowerCase();

    // Valida que no quede vacio.
    if (!nextRoom) {
      socket.emit("error_message", {
        mensaje: "El nombre de la room no puede estar vacio.",
      });
      return;
    }

    // Obtiene la room actual antes de cambiar.
    const prevRoom = socket.data.currentRoom;

    // Si ya esta en la misma room, no hace falta cambiar.
    if (prevRoom === nextRoom) {
      socket.emit("system_message", {
        mensaje: `Ya estas en la sala '${nextRoom}'.`,
        fecha: new Date().toISOString(),
      });
      return;
    }

    // Sale de la room anterior.
    socket.leave(prevRoom);

    // Entra en la nueva room.
    socket.join(nextRoom);

    // Actualiza el estado interno de room actual.
    socket.data.currentRoom = nextRoom;

    // Notifica al cliente que cambio correctamente.
    socket.emit("room_joined", {
      room: nextRoom,
      mensaje: `Ahora estas en la sala '${nextRoom}'.`,
    });

    // Mensaje de sistema en room anterior.
    io.to(prevRoom).emit("system_message", {
      mensaje: `Un usuario salio de '${prevRoom}'.`,
      fecha: new Date().toISOString(),
    });

    // Mensaje de sistema en room nueva.
    io.to(nextRoom).emit("system_message", {
      mensaje: `Un usuario entro a '${nextRoom}'.`,
      fecha: new Date().toISOString(),
    });
  });

  // Recibe mensajes de chat y los envia SOLO a la room actual.
  socket.on("chat_message", (payload) => {
    // Valida estructura minima del payload.
    if (!payload || typeof payload.texto !== "string") {
      socket.emit("error_message", {
        mensaje: "Formato de mensaje invalido.",
      });
      return;
    }

    // Limpia el texto para evitar mensajes vacios.
    const textoLimpio = payload.texto.trim();
    if (!textoLimpio) {
      socket.emit("error_message", {
        mensaje: "El mensaje no puede estar vacio.",
      });
      return;
    }

    // Toma la room actual del cliente.
    const room = socket.data.currentRoom;

    // Construye el mensaje final de chat.
    const mensaje = {
      room,
      usuario: payload.usuario?.trim() || "Anonimo",
      texto: textoLimpio,
      socketId: socket.id,
      fecha: new Date().toISOString(),
    };

    // Emite el chat solo para la room actual.
    io.to(room).emit("chat_message", mensaje);
  });

  // Maneja desconexion del cliente.
  socket.on("disconnect", () => {
    const room = socket.data.currentRoom;
    console.log(`Cliente desconectado: ${socket.id} (room: ${room})`);

    // Informa a la room de la desconexion.
    io.to(room).emit("system_message", {
      mensaje: `Un usuario se desconecto de '${room}'.`,
      fecha: new Date().toISOString(),
    });
  });
});

// Define puerto de escucha.
const PORT = 3000;

// Levanta el servidor.
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
    <title>Socket.IO - Paso 6</title>
    <style>
      /* Base visual simple para la demo. */
      body {
        font-family: sans-serif;
        margin: 2rem;
        max-width: 900px;
      }

      h1 {
        margin-bottom: 1rem;
      }

      .fila {
        display: grid;
        grid-template-columns: 180px 1fr auto;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }

      input,
      button {
        padding: 0.6rem;
        font-size: 1rem;
      }

      #estadoRoom {
        margin-bottom: 1rem;
        font-weight: 700;
      }

      #mensajes {
        list-style: none;
        padding: 0;
        margin: 0;
        border: 1px solid #ddd;
        border-radius: 8px;
        min-height: 240px;
      }

      #mensajes li {
        padding: 0.75rem;
        border-bottom: 1px solid #eee;
      }

      #mensajes li:last-child {
        border-bottom: none;
      }

      .system {
        color: #555;
        font-style: italic;
      }

      #error {
        color: #b00020;
        margin-top: 0.75rem;
        min-height: 1.2rem;
      }
    </style>
  </head>
  <body>
    <h1>Paso 6 - Chat por rooms</h1>

    <!-- Muestra la sala actual en la que esta el cliente. -->
    <div id="estadoRoom">Sala actual: (cargando...)</div>

    <!-- Form para cambiar de room. -->
    <form id="roomForm" class="fila">
      <input id="room" type="text" placeholder="Room (general, soporte, dev)" value="general" />
      <div></div>
      <button type="submit">Cambiar sala</button>
    </form>

    <!-- Form para enviar mensajes de chat. -->
    <form id="chatForm" class="fila">
      <input id="usuario" type="text" placeholder="Tu nombre" value="ClienteDemo" />
      <input id="texto" type="text" placeholder="Escribe un mensaje" />
      <button type="submit">Enviar</button>
    </form>

    <!-- Lista donde se muestran mensajes del chat y del sistema. -->
    <ul id="mensajes"></ul>

    <!-- Zona de errores de validacion. -->
    <div id="error"></div>

    <!-- Cliente Socket.IO servido automaticamente por el servidor. -->
    <script src="/socket.io/socket.io.js"></script>
    <script>
      // Crea conexion cliente-servidor.
      const socket = io();

      // Referencias del DOM.
      const roomForm = document.getElementById("roomForm");
      const roomInput = document.getElementById("room");
      const chatForm = document.getElementById("chatForm");
      const usuarioInput = document.getElementById("usuario");
      const textoInput = document.getElementById("texto");
      const estadoRoom = document.getElementById("estadoRoom");
      const mensajes = document.getElementById("mensajes");
      const errorBox = document.getElementById("error");

      // Lleva control local de la room actual para mostrar UI.
      let currentRoom = "general";

      // Utilidad para pintar una linea de mensaje en la lista.
      function agregarMensaje(texto, esSistema = false) {
        const li = document.createElement("li");
        if (esSistema) {
          li.classList.add("system");
        }
        li.textContent = texto;
        mensajes.appendChild(li);
      }

      // Se ejecuta al conectar el socket.
      socket.on("connect", () => {
        console.log("Conectado con id:", socket.id);
      });

      // Confirma visualmente cuando el servidor asigna o cambia room.
      socket.on("room_joined", (data) => {
        currentRoom = data.room;
        estadoRoom.textContent = `Sala actual: ${currentRoom}`;
        agregarMensaje(data.mensaje, true);
      });

      // Renderiza mensajes de sistema (entradas/salidas/cambios de room).
      socket.on("system_message", (data) => {
        const hora = new Date(data.fecha).toLocaleTimeString();
        agregarMensaje(`[${hora}] ${data.mensaje}`, true);
      });

      // Renderiza mensajes de chat normales.
      socket.on("chat_message", (data) => {
        const hora = new Date(data.fecha).toLocaleTimeString();
        agregarMensaje(`[${hora}] (${data.room}) ${data.usuario}: ${data.texto}`);
      });

      // Muestra errores enviados por el servidor.
      socket.on("error_message", (data) => {
        errorBox.textContent = data.mensaje;
      });

      // Envia solicitud para cambiar de room.
      roomForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        socket.emit("join_room", {
          room: roomInput.value,
        });
      });

      // Envia mensaje de chat a la room actual.
      chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";

        socket.emit("chat_message", {
          usuario: usuarioInput.value,
          texto: textoInput.value,
        });

        textoInput.value = "";
        textoInput.focus();
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

1. Abre dos pestañas en `http://localhost:3000`.
2. En pestaña A entra a `general`, en pestaña B entra a `dev`.
3. Envia mensajes desde A y verifica que B no los reciba.
4. Cambia B a `general` y verifica que ahora si reciba.

## 7) Errores comunes en este paso

- Si todos reciben todos los mensajes, revisa que uses `io.to(room).emit(...)` y no `io.emit(...)`.
- Si no cambia de room, valida que emitas `join_room` con `{ room: "nombre" }`.
- Si la sala aparece vacia, revisa el `trim()` y el guardado en `socket.data.currentRoom`.

## 8) Resultado de este paso

Ya tienes segmentacion de conversaciones por rooms, que es base para chats por canales y soporte por grupos.

En el Paso 7 agregaremos mensajes privados basicos entre usuarios conectados.
