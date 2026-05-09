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