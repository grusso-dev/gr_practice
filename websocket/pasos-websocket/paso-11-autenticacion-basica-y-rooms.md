# Paso 11: autenticación básica y rooms

Perfecto. En este paso llevamos el chat a un esquema más real:

- autenticación básica al conectar,
- rooms (salas) para separar conversaciones,
- broadcast solo dentro de la sala.

Nota: aquí usamos un token simple para aprender la mecánica. En producción se suele usar JWT real + validación robusta.

## 1) Código completo de `server.js` (copiar y pegar)

```js
// Importamos Express para servidor y rutas HTTP.
const express = require('express');
// Importamos http para compartir el mismo servidor con WebSocket.
const http = require('http');
// Importamos ws para habilitar conexiones WebSocket.
const WebSocket = require('ws');
// Importamos path para servir archivos estáticos.
const path = require('path');
// Importamos URL para leer query params del handshake.
const { URL } = require('url');

const app = express();
const PORT = 3000;

// Límites básicos para endurecer entrada de datos.
const MAX_MESSAGE_BYTES = 2 * 1024; // 2 KB por mensaje entrante.
const MAX_TEXT_LENGTH = 300; // 300 caracteres de texto visible.
const MAX_USER_LENGTH = 24; // 24 caracteres para nombre de usuario.
const MAX_ROOM_LENGTH = 24; // 24 caracteres para nombre de sala.

// Configuración de heartbeat del servidor.
const HEARTBEAT_INTERVAL_MS = 30000; // Cada 30s revisamos conexiones.

// Token demo para autenticación básica.
const VALID_TOKENS = new Set(['token-demo-123', 'token-demo-abc']);

// Mapa de salas -> Set de clientes.
const rooms = new Map();

// Servimos los archivos estáticos (por ejemplo index.html) desde la carpeta actual.
app.use(express.static(path.join(__dirname)));

// Creamos un único servidor HTTP para Express y WebSocket.
const server = http.createServer(app);

// Asociamos WebSocket al servidor HTTP y configuramos límite de payload.
const wss = new WebSocket.Server({
  server,
  maxPayload: MAX_MESSAGE_BYTES,
});

// Utilidad para enviar mensajes JSON de forma segura.
function sendJson(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// Sanitiza string: convierte a string, recorta espacios y limita longitud.
function normalizeString(value, maxLen) {
  return String(value || '')
    .trim()
    .slice(0, maxLen);
}

// Agrega un cliente a una sala.
function addClientToRoom(ws, roomName) {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }

  rooms.get(roomName).add(ws);
  ws.roomName = roomName;
}

// Quita un cliente de su sala actual.
function removeClientFromRoom(ws) {
  const roomName = ws.roomName;
  if (!roomName || !rooms.has(roomName)) {
    return;
  }

  const roomClients = rooms.get(roomName);
  roomClients.delete(ws);

  // Si la sala quedó vacía, la eliminamos del mapa.
  if (roomClients.size === 0) {
    rooms.delete(roomName);
  }

  ws.roomName = null;
}

// Broadcast solo a clientes de una sala.
function broadcastToRoom(roomName, event) {
  const roomClients = rooms.get(roomName);
  if (!roomClients) {
    return;
  }

  roomClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(event));
    }
  });
}

// Se ejecuta cuando un nuevo cliente se conecta por WebSocket.
wss.on('connection', (ws, req) => {
  console.log('Cliente WebSocket conectado (handshake iniciado)');

  // Bandera de vida usada por heartbeat.
  ws.isAlive = true;

  // Cada vez que llega pong, marcamos cliente como vivo.
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Leemos token y room desde query params del handshake.
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const token = requestUrl.searchParams.get('token');
  const room = normalizeString(requestUrl.searchParams.get('room') || 'general', MAX_ROOM_LENGTH);

  // Validamos token simple.
  if (!token || !VALID_TOKENS.has(token)) {
    sendJson(ws, {
      type: 'error',
      payload: { message: 'No autorizado: token inválido o ausente' },
    });

    // Cerramos conexión con código 1008 (Policy Violation).
    ws.close(1008, 'Unauthorized');
    return;
  }

  // Datos de sesión del cliente autenticado.
  ws.userName = normalizeString(requestUrl.searchParams.get('user') || 'anonimo', MAX_USER_LENGTH);

  // Lo agregamos a su sala inicial.
  addClientToRoom(ws, room || 'general');

  console.log(`Cliente autenticado: user=${ws.userName}, room=${ws.roomName}`);

  // Confirmamos autenticación/sala al cliente.
  sendJson(ws, {
    type: 'system_message',
    payload: {
      text: `Autenticado como ${ws.userName}. Sala actual: ${ws.roomName}`,
      room: ws.roomName,
    },
  });

  // Avisamos a la sala que entró un usuario.
  broadcastToRoom(ws.roomName, {
    type: 'presence',
    payload: {
      action: 'join',
      user: ws.userName,
      room: ws.roomName,
    },
  });

  // Se ejecuta cada vez que este cliente envía un mensaje.
  ws.on('message', (rawMessage, isBinary) => {
    // 1) Rechazamos mensajes binarios para este protocolo de texto/JSON.
    if (isBinary) {
      sendJson(ws, {
        type: 'error',
        payload: { message: 'Mensaje inválido: solo se acepta texto JSON' },
      });
      return;
    }

    // Convertimos Buffer a string para parsear JSON.
    const text = rawMessage.toString();

    let incoming;

    // 2) Validamos formato JSON.
    try {
      incoming = JSON.parse(text);
    } catch {
      sendJson(ws, {
        type: 'error',
        payload: { message: 'Formato inválido: se esperaba JSON' },
      });
      return;
    }

    // 3) Validamos estructura mínima del contrato.
    if (!incoming.type || typeof incoming.payload === 'undefined') {
      sendJson(ws, {
        type: 'error',
        payload: { message: 'Mensaje inválido: faltan type/payload' },
      });
      return;
    }

    // 4) Evento para cambiar de sala.
    if (incoming.type === 'join_room') {
      const nextRoom = normalizeString(incoming.payload.room, MAX_ROOM_LENGTH);

      if (!nextRoom) {
        sendJson(ws, {
          type: 'error',
          payload: { message: 'join_room inválido: room vacío' },
        });
        return;
      }

      const previousRoom = ws.roomName;
      if (nextRoom === previousRoom) {
        sendJson(ws, {
          type: 'system_message',
          payload: { text: `Ya estás en la sala ${nextRoom}`, room: nextRoom },
        });
        return;
      }

      removeClientFromRoom(ws);
      addClientToRoom(ws, nextRoom);

      // Avisamos salida a sala anterior.
      if (previousRoom) {
        broadcastToRoom(previousRoom, {
          type: 'presence',
          payload: {
            action: 'leave',
            user: ws.userName,
            room: previousRoom,
          },
        });
      }

      // Avisamos entrada a nueva sala.
      broadcastToRoom(nextRoom, {
        type: 'presence',
        payload: {
          action: 'join',
          user: ws.userName,
          room: nextRoom,
        },
      });

      sendJson(ws, {
        type: 'system_message',
        payload: { text: `Te moviste a la sala ${nextRoom}`, room: nextRoom },
      });
      return;
    }

    // 5) Evento normal de chat (solo se emite a la sala actual).
    if (incoming.type === 'chat_message') {
      const chatText = normalizeString(incoming.payload.text, MAX_TEXT_LENGTH);

      if (!chatText) {
        sendJson(ws, {
          type: 'error',
          payload: { message: 'Mensaje inválido: text vacío' },
        });
        return;
      }

      const outgoing = {
        type: 'chat_message',
        payload: {
          user: ws.userName,
          room: ws.roomName,
          text: chatText,
          sentAt: new Date().toISOString(),
        },
      };

      broadcastToRoom(ws.roomName, outgoing);
      return;
    }

    // 6) Tipo no soportado.
    sendJson(ws, {
      type: 'error',
      payload: { message: `Tipo no soportado: ${incoming.type}` },
    });
  });

  // Se ejecuta cuando el cliente actual se desconecta.
  ws.on('close', () => {
    const roomName = ws.roomName;
    const userName = ws.userName || 'anonimo';

    removeClientFromRoom(ws);
    console.log(`Cliente WebSocket desconectado: user=${userName}`);

    // Avisamos a la sala (si aplica) que el usuario salió.
    if (roomName) {
      broadcastToRoom(roomName, {
        type: 'presence',
        payload: {
          action: 'leave',
          user: userName,
          room: roomName,
        },
      });
    }
  });

  // Registramos errores de socket para diagnóstico.
  ws.on('error', (err) => {
    console.error('Error en cliente WebSocket:', err.message);
  });
});

// Heartbeat global: detecta clientes muertos y limpia conexiones.
const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws) => {
    // Si no respondió al ping anterior, terminamos la conexión.
    if (ws.isAlive === false) {
      console.log('Terminando cliente inactivo por heartbeat');
      ws.terminate();
      return;
    }

    // Marcamos como no-vivo hasta recibir pong.
    ws.isAlive = false;

    // Enviamos ping de bajo nivel del protocolo WebSocket.
    ws.ping();
  });
}, HEARTBEAT_INTERVAL_MS);

// Limpiamos timer al cerrar el servidor para evitar fugas.
wss.on('close', () => {
  clearInterval(heartbeatTimer);
});

// Iniciamos el servidor en el puerto definido.
server.listen(PORT, () => {
  console.log(`Servidor HTTP en http://localhost:${PORT}`);
  console.log(`WebSocket activo en ws://localhost:${PORT}`);
  console.log('Tokens demo válidos: token-demo-123, token-demo-abc');
});
```

## 2) Código completo de `index.html` (copiar y pegar)

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cliente WebSocket - Paso 11</title>
    <style>
      /* Estilos simples para visualizar estado y mensajes. */
      body {
        font-family: sans-serif;
        max-width: 860px;
        margin: 2rem auto;
        padding: 0 1rem;
      }

      .status {
        margin-bottom: 0.75rem;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        background: #f2f2f2;
      }

      #log {
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 1rem;
        min-height: 220px;
        margin-bottom: 1rem;
        white-space: pre-wrap;
      }

      .row {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      input {
        flex: 1;
        padding: 0.5rem;
      }

      button {
        padding: 0.5rem 1rem;
      }

      #reconnectButton {
        margin-bottom: 1rem;
      }
    </style>
  </head>
  <body>
    <h1>WebSocket: auth básica + rooms</h1>

    <!-- Config de conexión para user/token/sala inicial. -->
    <div class="row">
      <input id="userInput" type="text" maxlength="24" placeholder="Usuario (ej: gabriel)" value="browser" />
      <input id="tokenInput" type="text" placeholder="Token (ej: token-demo-123)" value="token-demo-123" />
      <input id="initialRoomInput" type="text" maxlength="24" placeholder="Sala inicial" value="general" />
    </div>

    <!-- Indicador visual del estado actual de conexión. -->
    <div class="status" id="status">Estado: desconectado</div>

    <!-- Log de eventos y mensajes. -->
    <div id="log"></div>

    <div class="row">
      <!-- Campo para escribir mensajes de chat. -->
      <input id="messageInput" type="text" maxlength="300" placeholder="Escribe un mensaje" />
      <!-- Botón de envío de chat. -->
      <button id="sendButton">Enviar</button>
    </div>

    <div class="row">
      <!-- Campo para cambiar de sala durante la sesión. -->
      <input id="roomInput" type="text" maxlength="24" placeholder="Nueva sala (ej: deportes)" />
      <!-- Botón para enviar evento join_room. -->
      <button id="joinRoomButton">Cambiar sala</button>
    </div>

    <!-- Botón para reconectar manualmente en cualquier momento. -->
    <button id="reconnectButton">Reconectar ahora</button>

    <script>
      // Referencias del DOM.
      const userInput = document.getElementById('userInput');
      const tokenInput = document.getElementById('tokenInput');
      const initialRoomInput = document.getElementById('initialRoomInput');
      const statusEl = document.getElementById('status');
      const log = document.getElementById('log');
      const messageInput = document.getElementById('messageInput');
      const sendButton = document.getElementById('sendButton');
      const roomInput = document.getElementById('roomInput');
      const joinRoomButton = document.getElementById('joinRoomButton');
      const reconnectButton = document.getElementById('reconnectButton');

      // Estado de conexión actual.
      let socket = null;
      let reconnectTimer = null;

      // Estado local de identidad/sala.
      let currentUser = 'browser';
      let currentRoom = 'general';

      // Cola de mensajes para retener envíos cuando no hay conexión.
      const offlineQueue = [];
      const MAX_QUEUE_SIZE = 20;

      // Configuración de reconexión con backoff.
      const RECONNECT_BASE_MS = 1000;
      const RECONNECT_MAX_MS = 10000;
      const MAX_RECONNECT_ATTEMPTS = 10;
      let reconnectAttempts = 0;

      function appendLog(text) {
        log.textContent += `${text}\n`;
      }

      function setStatus(text) {
        statusEl.textContent = `Estado: ${text}`;
      }

      function normalize(value, maxLen) {
        return String(value || '')
          .trim()
          .slice(0, maxLen);
      }

      function getReconnectDelayMs() {
        const delay = RECONNECT_BASE_MS * 2 ** Math.max(0, reconnectAttempts - 1);
        return Math.min(delay, RECONNECT_MAX_MS);
      }

      // Construye URL de conexión con query params de auth/sala.
      function buildWsUrl() {
        currentUser = normalize(userInput.value || 'browser', 24) || 'browser';
        currentRoom = normalize(initialRoomInput.value || 'general', 24) || 'general';
        const token = encodeURIComponent(tokenInput.value.trim());
        const user = encodeURIComponent(currentUser);
        const room = encodeURIComponent(currentRoom);
        return `ws://localhost:3000?token=${token}&user=${user}&room=${room}`;
      }

      function flushQueue() {
        while (offlineQueue.length > 0 && socket && socket.readyState === WebSocket.OPEN) {
          const queued = offlineQueue.shift();
          socket.send(JSON.stringify(queued));
          appendLog(`(cola) Tú: ${queued.payload.text}`);
        }
      }

      function scheduleReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          setStatus('desconectado (sin reintentos automáticos)');
          appendLog('Se alcanzó el máximo de reintentos automáticos. Usa "Reconectar ahora".');
          return;
        }

        reconnectAttempts += 1;
        const delay = getReconnectDelayMs();
        setStatus(`desconectado (reintento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        appendLog(`Conexión cerrada. Reintentando en ${Math.round(delay / 1000)}s...`);

        reconnectTimer = setTimeout(() => {
          connect();
        }, delay);
      }

      function connect() {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
          return;
        }

        setStatus('conectando...');
        appendLog('Intentando conectar...');

        // Creamos conexión usando token/user/room del formulario.
        socket = new WebSocket(buildWsUrl());

        socket.addEventListener('open', () => {
          reconnectAttempts = 0;
          setStatus(`conectado (${currentUser} @ ${currentRoom})`);
          appendLog('Conexión abierta');
          flushQueue();
        });

        socket.addEventListener('message', (event) => {
          let data;

          try {
            data = JSON.parse(event.data);
          } catch {
            appendLog(`Servidor (texto): ${event.data}`);
            return;
          }

          if (data.type === 'chat_message') {
            const user = data.payload?.user || 'anonimo';
            const text = data.payload?.text || '';
            const room = data.payload?.room || '?';
            appendLog(`[${room}] ${user}: ${text}`);
            return;
          }

          if (data.type === 'presence') {
            const action = data.payload?.action || 'unknown';
            const user = data.payload?.user || 'anonimo';
            const room = data.payload?.room || '?';
            appendLog(`[${room}] presencia: ${user} ${action}`);
            return;
          }

          if (data.type === 'system_message') {
            const room = data.payload?.room;
            if (room) {
              currentRoom = room;
              initialRoomInput.value = room;
              setStatus(`conectado (${currentUser} @ ${currentRoom})`);
            }
            appendLog(`Sistema: ${data.payload?.text || ''}`);
            return;
          }

          if (data.type === 'error') {
            appendLog(`Error servidor: ${data.payload?.message || 'desconocido'}`);
            return;
          }

          appendLog(`Evento no manejado: ${data.type}`);
        });

        socket.addEventListener('error', () => {
          setStatus('error');
          appendLog('Ocurrió un error en WebSocket');
        });

        socket.addEventListener('close', (event) => {
          // Si cierra por 1008, normalmente fue auth inválida.
          if (event.code === 1008) {
            setStatus('desconectado (no autorizado)');
            appendLog('Conexión rechazada por autorización. Revisa token.');
            return;
          }

          scheduleReconnect();
        });
      }

      function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) {
          return;
        }

        const outgoing = {
          type: 'chat_message',
          payload: {
            text,
          },
        };

        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(outgoing));
          appendLog(`Tú: ${text}`);
        } else if (offlineQueue.length >= MAX_QUEUE_SIZE) {
          appendLog('Cola llena: no se guardó el mensaje offline');
        } else {
          offlineQueue.push(outgoing);
          appendLog(`Sin conexión: mensaje en cola (${offlineQueue.length}/${MAX_QUEUE_SIZE})`);
        }

        messageInput.value = '';
        messageInput.focus();
      }

      // Envía evento join_room para cambiar de sala sin reconectar.
      function joinRoom() {
        const targetRoom = normalize(roomInput.value, 24);
        if (!targetRoom) {
          return;
        }

        if (!socket || socket.readyState !== WebSocket.OPEN) {
          appendLog('No se puede cambiar sala: sin conexión');
          return;
        }

        socket.send(
          JSON.stringify({
            type: 'join_room',
            payload: {
              room: targetRoom,
            },
          })
        );

        roomInput.value = '';
      }

      function reconnectNow() {
        reconnectAttempts = 0;

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }

        connect();
      }

      sendButton.addEventListener('click', sendMessage);

      messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          sendMessage();
        }
      });

      joinRoomButton.addEventListener('click', joinRoom);

      roomInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          joinRoom();
        }
      });

      reconnectButton.addEventListener('click', reconnectNow);

      connect();
    </script>
  </body>
</html>
```

## 3) Código que cambió vs paso anterior

### 3.1 `server.js`: auth básica en handshake

```js
const requestUrl = new URL(req.url, `http://${req.headers.host}`);
const token = requestUrl.searchParams.get('token');

if (!token || !VALID_TOKENS.has(token)) {
  sendJson(ws, {
    type: 'error',
    payload: { message: 'No autorizado: token inválido o ausente' },
  });
  ws.close(1008, 'Unauthorized');
  return;
}
```

Explicación:

- Leemos token de la URL de conexión WebSocket.
- Si no es válido, cerramos con `1008` (policy violation).

### 3.2 `server.js`: rooms con `Map<string, Set<ws>>`

```js
const rooms = new Map();

function addClientToRoom(ws, roomName) { ... }
function removeClientFromRoom(ws) { ... }
function broadcastToRoom(roomName, event) { ... }
```

Explicación:

- `rooms` guarda qué clientes están en cada sala.
- Broadcast deja de ser global y pasa a ser por sala.

### 3.3 `server.js`: evento `join_room`

```js
if (incoming.type === 'join_room') {
  const nextRoom = normalizeString(incoming.payload.room, MAX_ROOM_LENGTH);
  // remover de sala anterior, agregar a nueva y emitir presence
}
```

Explicación:

- Permite cambiar de sala durante la misma conexión.
- Emitimos eventos de presencia (`join`/`leave`) para visibilidad.

### 3.4 `index.html`: conexión con token/user/room

```js
function buildWsUrl() {
  const token = encodeURIComponent(tokenInput.value.trim());
  const user = encodeURIComponent(currentUser);
  const room = encodeURIComponent(currentRoom);
  return `ws://localhost:3000?token=${token}&user=${user}&room=${room}`;
}
```

Explicación:

- El cliente arma la URL de conexión con datos de autenticación y sala.

### 3.5 `index.html`: manejo de `presence` y `join_room`

```js
if (data.type === 'presence') {
  appendLog(`[${room}] presencia: ${user} ${action}`);
}

socket.send(JSON.stringify({
  type: 'join_room',
  payload: { room: targetRoom },
}));
```

Explicación:

- El cliente visualiza quién entra/sale de sala.
- Puede cambiar de sala sin cerrar la pestaña.

## 4) Resultado esperado

- Si usas token válido, conectas y chateas normal.
- Si token es inválido, el servidor rechaza la conexión.
- Los mensajes se ven solo dentro de la sala actual.
- Puedes cambiar de sala en caliente con `join_room`.

## 5) Prueba rápida

1. Levanta servidor: `node server.js`.
2. Abre dos navegadores con token válido (`token-demo-123`).
3. Pon ambos en `general` y verifica que se vean.
4. Cambia uno a `deportes` y confirma aislamiento de mensajes.
5. Prueba token inválido y verifica rechazo con estado no autorizado.
