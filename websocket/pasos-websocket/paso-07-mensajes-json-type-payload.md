# Paso 7: mensajes JSON (`type` + `payload`)

Perfecto. Desde este paso dejamos de enviar texto plano y pasamos a mensajes estructurados en JSON.

La idea es simple: cada mensaje viaja con:

- `type`: qué clase de evento es,
- `payload`: los datos del evento.

Esto te permite escalar fácilmente (chat, sistema, usuarios conectados, etc.) sin romper el protocolo.

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

// Servimos los archivos estáticos (por ejemplo index.html) desde la carpeta actual.
app.use(express.static(path.join(__dirname)));

// Creamos un único servidor HTTP para Express y WebSocket.
const server = http.createServer(app);
// Asociamos WebSocket al servidor HTTP existente.
const wss = new WebSocket.Server({ server });

// Se ejecuta cuando un nuevo cliente se conecta por WebSocket.
wss.on('connection', (ws) => {
  console.log('Cliente WebSocket conectado');

  // Enviamos un mensaje de bienvenida solo al cliente recién conectado.
  ws.send(
    JSON.stringify({
      type: 'system_message',
      payload: { text: 'Bienvenido! Conexión WebSocket establecida.' },
    })
  );

  // Se ejecuta cada vez que este cliente envía un mensaje.
  ws.on('message', (rawMessage) => {
    // Convertimos Buffer a string para poder parsear JSON.
    const text = rawMessage.toString();

    let incoming;

    try {
      // Intentamos convertir el string a objeto JSON.
      incoming = JSON.parse(text);
    } catch {
      // Si no es JSON válido, avisamos solo a ese cliente y salimos.
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: { message: 'Formato inválido: se esperaba JSON' },
        })
      );
      return;
    }

    // Validamos estructura mínima esperada.
    if (!incoming.type || typeof incoming.payload === 'undefined') {
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: { message: 'Mensaje inválido: faltan type/payload' },
        })
      );
      return;
    }

    // Caso de uso actual: mensajes de chat.
    if (incoming.type === 'chat_message') {
      // Armamos el evento de salida que se envía a todos.
      const outgoing = {
        type: 'chat_message',
        payload: {
          // Usamos nombre por defecto si no vino user.
          user: incoming.payload.user || 'anonimo',
          // Garantizamos texto en string.
          text: String(incoming.payload.text || ''),
          // Timestamp útil para UI/ordenamiento.
          sentAt: new Date().toISOString(),
        },
      };

      // Broadcast a todos los clientes conectados.
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(outgoing));
        }
      });
      return;
    }

    // Si el tipo no existe aún en nuestro protocolo, respondemos error.
    ws.send(
      JSON.stringify({
        type: 'error',
        payload: { message: `Tipo no soportado: ${incoming.type}` },
      })
    );
  });

  // Se ejecuta cuando el cliente actual se desconecta.
  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
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
    <title>Cliente WebSocket - Paso 7</title>
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
    <h1>WebSocket: JSON type/payload</h1>

    <!-- Indicador visual del estado actual de conexión. -->
    <div class="status" id="status">Estado: desconectado</div>

    <!-- Log de eventos y mensajes. -->
    <div id="log"></div>

    <div class="row">
      <!-- Campo para escribir mensajes. -->
      <input id="messageInput" type="text" placeholder="Escribe un mensaje" />
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
            // Si llega algo no-JSON, lo mostramos crudo.
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

          // Cualquier otro tipo aún no manejado por el cliente.
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

          // Programamos un nuevo intento de conexión.
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

### 3.1 Cambio en `server.js`: parseo JSON + validación + enrutamiento por `type`

```js
ws.on('message', (rawMessage) => {
  const text = rawMessage.toString();

  let incoming;

  try {
    incoming = JSON.parse(text);
  } catch {
    ws.send(
      JSON.stringify({
        type: 'error',
        payload: { message: 'Formato inválido: se esperaba JSON' },
      })
    );
    return;
  }

  if (!incoming.type || typeof incoming.payload === 'undefined') {
    ws.send(
      JSON.stringify({
        type: 'error',
        payload: { message: 'Mensaje inválido: faltan type/payload' },
      })
    );
    return;
  }

  if (incoming.type === 'chat_message') {
    const outgoing = {
      type: 'chat_message',
      payload: {
        user: incoming.payload.user || 'anonimo',
        text: String(incoming.payload.text || ''),
        sentAt: new Date().toISOString(),
      },
    };

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(outgoing));
      }
    });
    return;
  }

  ws.send(
    JSON.stringify({
      type: 'error',
      payload: { message: `Tipo no soportado: ${incoming.type}` },
    })
  );
});
```

Explicación:

- Se reemplaza la lógica de texto plano por parseo con `JSON.parse`.
- Se valida contrato mínimo (`type` y `payload`).
- Se enruta por tipo (`chat_message`) para poder escalar protocolo.
- Se responde `error` cuando el formato o el tipo no son válidos.

### 3.2 Cambio en `index.html`: parseo por tipo en `message`

```js
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
    appendLog(`${user}: ${text}`);
    return;
  }

  if (data.type === 'error') {
    appendLog(`Error servidor: ${data.payload?.message || 'desconocido'}`);
    return;
  }

  appendLog(`Evento no manejado: ${data.type}`);
});
```

Explicación:

- El cliente ya no asume texto plano: parsea JSON.
- Reacciona distinto según `type` (`chat_message`, `error`, etc.).
- Queda lista la base para nuevos eventos sin reescribir todo.

### 3.3 Cambio en `index.html`: envío estructurado en `sendMessage()`

```js
const outgoing = {
  type: 'chat_message',
  payload: {
    user: 'browser',
    text,
  },
};

socket.send(JSON.stringify(outgoing));
appendLog(`Tú: ${text}`);
```

Explicación:

- En lugar de mandar solo texto, ahora se envía un objeto con contrato explícito.
- `JSON.stringify` serializa el objeto para transmitirlo por WebSocket.

## 4) Resultado esperado

- Sigues viendo chat en tiempo real entre múltiples navegadores.
- Ahora cada mensaje viaja con estructura JSON.
- Si envías formato inválido, el servidor responde con `type: error`.

## 5) Prueba rápida

1. Levanta servidor:

```bash
node server.js
```

2. Abre dos navegadores en `http://localhost:3000`.

3. Envía mensajes y confirma que aparecen con formato `usuario: texto`.

4. (Opcional) desde DevTools, prueba enviar un texto no JSON y verifica respuesta `error`.
