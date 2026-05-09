# Paso 8: validación y seguridad básica

Perfecto. En este paso mantenemos el chat funcionando, pero agregamos defensas básicas para evitar errores y abuso.

Objetivo: no confiar ciegamente en lo que llega del cliente.

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
    <title>Cliente WebSocket - Paso 8</title>
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
    </style>
  </head>
  <body>
    <h1>WebSocket: validación básica</h1>

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

    <script>
      // Referencias del DOM.
      const statusEl = document.getElementById('status');
      const log = document.getElementById('log');
      const messageInput = document.getElementById('messageInput');
      const sendButton = document.getElementById('sendButton');

      // Variable que guarda la conexión WebSocket actual.
      let socket = null;
      // Timer para reconectar luego de una caída.
      let reconnectTimer = null;
      // Delay fijo de reconexión (básico). Más adelante se puede mejorar con backoff.
      const RECONNECT_DELAY_MS = 2000;

      // Imprime una línea en el log visual.
      function appendLog(text) {
        log.textContent += `${text}\n`;
      }

      // Actualiza texto de estado en pantalla.
      function setStatus(text) {
        statusEl.textContent = `Estado: ${text}`;
      }

      // Intenta abrir (o reabrir) la conexión WebSocket.
      function connect() {
        // Si existe un timer pendiente, lo limpiamos para no duplicar reconexiones.
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        setStatus('conectando...');
        appendLog('Intentando conectar...');

        // Creamos la conexión al servidor WebSocket.
        socket = new WebSocket('ws://localhost:3000');

        // Evento OPEN: conexión lista para enviar/recibir.
        socket.addEventListener('open', () => {
          setStatus('conectado');
          appendLog('Conexión abierta');
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
          setStatus('desconectado');
          appendLog(`Conexión cerrada. Reintentando en ${RECONNECT_DELAY_MS / 1000}s...`);

          reconnectTimer = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY_MS);
        });
      }

      // Envía el texto del input al servidor.
      function sendMessage() {
        const text = messageInput.value.trim();

        // Evitamos mensajes vacíos.
        if (!text) {
          return;
        }

        // Solo enviamos si el socket está en estado OPEN.
        if (socket && socket.readyState === WebSocket.OPEN) {
          // Construimos mensaje estructurado con type + payload.
          const outgoing = {
            type: 'chat_message',
            payload: {
              user: 'browser',
              text,
            },
          };

          // Enviamos serializado a JSON.
          socket.send(JSON.stringify(outgoing));
          appendLog(`Tú: ${text}`);
          messageInput.value = '';
          messageInput.focus();
        } else {
          appendLog('No se envió: conexión no disponible');
        }
      }

      // Click en botón => enviar mensaje.
      sendButton.addEventListener('click', sendMessage);

      // Enter en input => enviar mensaje.
      messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          sendMessage();
        }
      });

      // Arrancamos conexión inicial al cargar la página.
      connect();
    </script>
  </body>
</html>
```

## 3) Código que cambió vs paso anterior

### 3.1 `server.js`: límite de payload

```js
const wss = new WebSocket.Server({
  server,
  maxPayload: MAX_MESSAGE_BYTES,
});
```

Explicación:

- `maxPayload` evita que llegue un mensaje gigante y consuma memoria en exceso.
- Es una defensa inicial contra abuso o errores de cliente.

### 3.2 `server.js`: rechazo de binario

```js
ws.on('message', (rawMessage, isBinary) => {
  if (isBinary) {
    sendJson(ws, {
      type: 'error',
      payload: { message: 'Mensaje inválido: solo se acepta texto JSON' },
    });
    return;
  }
  // ...
});
```

Explicación:

- Este protocolo del curso usa JSON en texto.
- Si llega binario, lo rechazamos explícitamente.

### 3.3 `server.js`: normalización/sanitización de `user` y `text`

```js
function normalizeString(value, maxLen) {
  return String(value || '')
    .trim()
    .slice(0, maxLen);
}

const user = normalizeString(incoming.payload.user || 'anonimo', MAX_USER_LENGTH);
const chatText = normalizeString(incoming.payload.text, MAX_TEXT_LENGTH);
```

Explicación:

- Convertimos tipos inesperados a string, recortamos espacios y limitamos longitud.
- Evita payloads enormes y datos raros que rompan UI o logs.

### 3.4 `server.js`: validación de mensaje vacío

```js
if (!chatText) {
  sendJson(ws, {
    type: 'error',
    payload: { message: 'Mensaje inválido: text vacío' },
  });
  return;
}
```

Explicación:

- Si tras normalizar queda vacío, no se hace broadcast.
- Así mantenemos el canal limpio y consistente.

### 3.5 `index.html`: límite en input

```html
<input id="messageInput" type="text" maxlength="300" placeholder="Escribe un mensaje" />
```

Explicación:

- Añadimos una barrera del lado cliente para mejorar UX.
- Igual, la validación crítica permanece en servidor.

## 4) Resultado esperado

- El chat sigue funcionando igual para casos normales.
- Mensajes inválidos reciben `type: error`.
- Hay límites de tamaño y validación de contenido en servidor.

## 5) Prueba rápida

1. Levanta servidor:

```bash
node server.js
```

2. Abre dos navegadores en `http://localhost:3000`.

3. Envía mensajes normales y verifica broadcast.

4. Prueba enviar JSON con `text` vacío y verifica respuesta de error.
