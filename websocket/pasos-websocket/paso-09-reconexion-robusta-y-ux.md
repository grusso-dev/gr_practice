# Paso 9: reconexión más robusta y mejora de UX

Perfecto. En este paso mejoramos la reconexión automática para que sea más estable en escenarios reales:

- backoff progresivo (no reconectar siempre cada 2s),
- límite de intentos,
- botón manual de reconexión,
- cola de mensajes mientras no hay conexión.

Objetivo: que la app siga siendo usable aunque haya cortes de red intermitentes.

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

const app = express();
const PORT = 3000;

// Límites básicos para endurecer entrada de datos.
const MAX_MESSAGE_BYTES = 2 * 1024; // 2 KB por mensaje entrante.
const MAX_TEXT_LENGTH = 300; // 300 caracteres de texto visible.
const MAX_USER_LENGTH = 24; // 24 caracteres para nombre de usuario.

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

// Se ejecuta cuando un nuevo cliente se conecta por WebSocket.
wss.on('connection', (ws) => {
  console.log('Cliente WebSocket conectado');

  // Enviamos un mensaje de bienvenida solo al cliente recién conectado.
  sendJson(ws, {
    type: 'system_message',
    payload: { text: 'Bienvenido! Conexión WebSocket establecida.' },
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

    // 4) Enrutamos solo tipos soportados.
    if (incoming.type !== 'chat_message') {
      sendJson(ws, {
        type: 'error',
        payload: { message: `Tipo no soportado: ${incoming.type}` },
      });
      return;
    }

    // 5) Validamos/sanitizamos payload.
    const user = normalizeString(incoming.payload.user || 'anonimo', MAX_USER_LENGTH);
    const chatText = normalizeString(incoming.payload.text, MAX_TEXT_LENGTH);

    // Evitamos mensajes vacíos después de normalizar.
    if (!chatText) {
      sendJson(ws, {
        type: 'error',
        payload: { message: 'Mensaje inválido: text vacío' },
      });
      return;
    }

    // 6) Construimos evento de salida seguro y consistente.
    const outgoing = {
      type: 'chat_message',
      payload: {
        user: user || 'anonimo',
        text: chatText,
        sentAt: new Date().toISOString(),
      },
    };

    // 7) Broadcast a todos los clientes conectados.
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(outgoing));
      }
    });
  });

  // Se ejecuta cuando el cliente actual se desconecta.
  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
  });

  // Registramos errores de socket para diagnóstico.
  ws.on('error', (err) => {
    console.error('Error en cliente WebSocket:', err.message);
  });
});

// Iniciamos el servidor en el puerto definido.
server.listen(PORT, () => {
  console.log(`Servidor HTTP en http://localhost:${PORT}`);
  console.log(`WebSocket activo en ws://localhost:${PORT}`);
});
```

## 2) Código completo de `index.html` (copiar y pegar)

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cliente WebSocket - Paso 9</title>
    <style>
      /* Estilos simples para visualizar estado y mensajes. */
      body {
        font-family: sans-serif;
        max-width: 760px;
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
        min-height: 180px;
        margin-bottom: 1rem;
        white-space: pre-wrap;
      }

      .row {
        display: flex;
        gap: 0.5rem;
      }

      input {
        flex: 1;
        padding: 0.5rem;
      }

      button {
        padding: 0.5rem 1rem;
      }

      #reconnectButton {
        margin-top: 0.75rem;
      }
    </style>
  </head>
  <body>
    <h1>WebSocket: reconexión robusta</h1>

    <!-- Indicador visual del estado actual de conexión. -->
    <div class="status" id="status">Estado: desconectado</div>

    <!-- Log de eventos y mensajes. -->
    <div id="log"></div>

    <div class="row">
      <!-- Campo para escribir mensajes. -->
      <input id="messageInput" type="text" maxlength="300" placeholder="Escribe un mensaje" />
      <!-- Botón de envío. -->
      <button id="sendButton">Enviar</button>
    </div>

    <!-- Botón para reconectar manualmente en cualquier momento. -->
    <button id="reconnectButton">Reconectar ahora</button>

    <script>
      // Referencias del DOM.
      const statusEl = document.getElementById('status');
      const log = document.getElementById('log');
      const messageInput = document.getElementById('messageInput');
      const sendButton = document.getElementById('sendButton');
      const reconnectButton = document.getElementById('reconnectButton');

      // Variable que guarda la conexión WebSocket actual.
      let socket = null;
      // Timer para reconectar luego de una caída.
      let reconnectTimer = null;

      // Cola de mensajes para retener envíos cuando no hay conexión.
      const offlineQueue = [];
      // Límite de cola para no crecer indefinidamente.
      const MAX_QUEUE_SIZE = 20;

      // Configuración de reconexión con backoff.
      const RECONNECT_BASE_MS = 1000; // 1s
      const RECONNECT_MAX_MS = 10000; // 10s
      const MAX_RECONNECT_ATTEMPTS = 10;
      let reconnectAttempts = 0;

      // Imprime una línea en el log visual.
      function appendLog(text) {
        log.textContent += `${text}\n`;
      }

      // Actualiza texto de estado en pantalla.
      function setStatus(text) {
        statusEl.textContent = `Estado: ${text}`;
      }

      // Calcula delay de reconexión con backoff exponencial.
      function getReconnectDelayMs() {
        // 1s, 2s, 4s, 8s... con tope en 10s.
        const delay = RECONNECT_BASE_MS * 2 ** Math.max(0, reconnectAttempts - 1);
        return Math.min(delay, RECONNECT_MAX_MS);
      }

      // Envía mensajes pendientes en cola cuando vuelve la conexión.
      function flushQueue() {
        // Procesamos FIFO: el primer mensaje en entrar es el primero en salir.
        while (offlineQueue.length > 0 && socket && socket.readyState === WebSocket.OPEN) {
          const queued = offlineQueue.shift();
          socket.send(JSON.stringify(queued));
          appendLog(`(cola) Tú: ${queued.payload.text}`);
        }
      }

      // Programa reconexión automática respetando límite de intentos.
      function scheduleReconnect() {
        // Si agotamos intentos, frenamos reconexión automática.
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          setStatus('desconectado (sin reintentos automáticos)');
          appendLog('Se alcanzó el máximo de reintentos automáticos. Usa "Reconectar ahora".');
          return;
        }

        // Sumamos intento y calculamos espera con backoff.
        reconnectAttempts += 1;
        const delay = getReconnectDelayMs();
        setStatus(`desconectado (reintento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        appendLog(`Conexión cerrada. Reintentando en ${Math.round(delay / 1000)}s...`);

        reconnectTimer = setTimeout(() => {
          connect();
        }, delay);
      }

      // Intenta abrir (o reabrir) la conexión WebSocket.
      function connect() {
        // Si existe un timer pendiente, lo limpiamos para no duplicar reconexiones.
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        // Si ya hay un socket conectando/conectado, no abrimos otro.
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
          return;
        }

        setStatus('conectando...');
        appendLog('Intentando conectar...');

        // Creamos la conexión al servidor WebSocket.
        socket = new WebSocket('ws://localhost:3000');

        // Evento OPEN: conexión lista para enviar/recibir.
        socket.addEventListener('open', () => {
          // Reset de intentos al reconectar exitosamente.
          reconnectAttempts = 0;
          setStatus('conectado');
          appendLog('Conexión abierta');

          // Si había mensajes pendientes, los enviamos ahora.
          flushQueue();
        });

        // Evento MESSAGE: llega un mensaje desde servidor.
        socket.addEventListener('message', (event) => {
          let data;

          try {
            // Parseamos lo recibido como JSON.
            data = JSON.parse(event.data);
          } catch {
            appendLog(`Servidor (texto): ${event.data}`);
            return;
          }

          // Mensaje de chat normal.
          if (data.type === 'chat_message') {
            const user = data.payload?.user || 'anonimo';
            const text = data.payload?.text || '';
            appendLog(`${user}: ${text}`);
            return;
          }

          // Mensaje del sistema (ejemplo: bienvenida).
          if (data.type === 'system_message') {
            appendLog(`Sistema: ${data.payload?.text || ''}`);
            return;
          }

          // Mensaje de error enviado por servidor.
          if (data.type === 'error') {
            appendLog(`Error servidor: ${data.payload?.message || 'desconocido'}`);
            return;
          }

          appendLog(`Evento no manejado: ${data.type}`);
        });

        // Evento ERROR: error de red/protocolo durante la comunicación.
        socket.addEventListener('error', () => {
          setStatus('error');
          appendLog('Ocurrió un error en WebSocket');
        });

        // Evento CLOSE: conexión cerrada; programamos reconexión automática.
        socket.addEventListener('close', () => {
          scheduleReconnect();
        });
      }

      // Envía el texto del input al servidor.
      function sendMessage() {
        const text = messageInput.value.trim();

        // Evitamos mensajes vacíos.
        if (!text) {
          return;
        }

        // Construimos mensaje estructurado con type + payload.
        const outgoing = {
          type: 'chat_message',
          payload: {
            user: 'browser',
            text,
          },
        };

        // Si hay conexión abierta, enviamos inmediato.
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(outgoing));
          appendLog(`Tú: ${text}`);
        } else {
          // Si no hay conexión, guardamos en cola (con límite) y avisamos.
          if (offlineQueue.length >= MAX_QUEUE_SIZE) {
            appendLog('Cola llena: no se guardó el mensaje offline');
          } else {
            offlineQueue.push(outgoing);
            appendLog(`Sin conexión: mensaje en cola (${offlineQueue.length}/${MAX_QUEUE_SIZE})`);
          }
        }

        messageInput.value = '';
        messageInput.focus();
      }

      // Reconexión manual: reinicia contador y fuerza intento inmediato.
      function reconnectNow() {
        reconnectAttempts = 0;

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        // Si hay socket abierto, lo cerramos para recrearlo limpio.
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }

        connect();
      }

      // Click en botón => enviar mensaje.
      sendButton.addEventListener('click', sendMessage);

      // Enter en input => enviar mensaje.
      messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          sendMessage();
        }
      });

      // Click en botón de reconexión manual.
      reconnectButton.addEventListener('click', reconnectNow);

      // Arrancamos conexión inicial al cargar la página.
      connect();
    </script>
  </body>
</html>
```

## 3) Código que cambió vs paso anterior

### 3.1 `index.html`: reconexión con backoff exponencial

```js
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 10000;
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectAttempts = 0;

function getReconnectDelayMs() {
  const delay = RECONNECT_BASE_MS * 2 ** Math.max(0, reconnectAttempts - 1);
  return Math.min(delay, RECONNECT_MAX_MS);
}
```

Explicación:

- Antes reconectábamos siempre cada 2s.
- Ahora aumenta el tiempo de espera en cada fallo (1s, 2s, 4s, 8s...) hasta un máximo.
- Esto evita sobrecargar cliente y servidor cuando hay caída prolongada.

### 3.2 `index.html`: límite de reintentos automáticos

```js
function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    setStatus('desconectado (sin reintentos automáticos)');
    appendLog('Se alcanzó el máximo de reintentos automáticos. Usa "Reconectar ahora".');
    return;
  }

  reconnectAttempts += 1;
  const delay = getReconnectDelayMs();
  reconnectTimer = setTimeout(() => {
    connect();
  }, delay);
}
```

Explicación:

- La reconexión automática se detiene después de N intentos.
- Evita bucles infinitos de reconexión en redes caídas por mucho tiempo.

### 3.3 `index.html`: cola de mensajes offline

```js
const offlineQueue = [];
const MAX_QUEUE_SIZE = 20;

function flushQueue() {
  while (offlineQueue.length > 0 && socket && socket.readyState === WebSocket.OPEN) {
    const queued = offlineQueue.shift();
    socket.send(JSON.stringify(queued));
    appendLog(`(cola) Tú: ${queued.payload.text}`);
  }
}
```

Explicación:

- Si no hay conexión al enviar, guardamos mensajes en memoria.
- Cuando vuelve la conexión, se envían automáticamente en orden FIFO.

### 3.4 `index.html`: botón de reconexión manual

```js
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
```

Explicación:

- Permite al usuario forzar reconexión inmediata sin esperar el timer.
- También reinicia contador de intentos.

## 4) Resultado esperado

- El chat sigue funcionando como antes cuando hay conexión estable.
- Ante cortes de red, reconecta con backoff y límite de intentos.
- Los mensajes enviados offline pueden quedar en cola y salir al reconectar.

## 5) Prueba rápida

1. Levanta servidor: `node server.js`.
2. Abre `http://localhost:3000` en dos navegadores.
3. Apaga servidor, envía 2-3 mensajes y verifica que van a cola.
4. Enciende servidor y confirma reconexión + envío automático de cola.
