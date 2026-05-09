# Paso 6: eventos clave y reconexión básica

Perfecto. En este paso vamos a reforzar el cliente para manejar bien el ciclo de vida de WebSocket:

- `open`
- `message`
- `close`
- `error`

Además, agregaremos reconexión automática básica para mejorar la experiencia cuando se corta la conexión.

## 1) Actualizar `index.html`

Reemplaza el contenido de `index.html` por este ejemplo:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cliente WebSocket - Paso 6</title>
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
    <h1>WebSocket: eventos y reconexión</h1>

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
          appendLog(`Servidor: ${event.data}`);
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
          socket.send(text);
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

## 2) ¿Qué mejoras tiene este cliente?

- maneja explícitamente `open`, `message`, `error` y `close`,
- muestra estado de conexión en pantalla,
- reintenta conexión automáticamente cada 2 segundos,
- evita enviar si el socket no está abierto.

## 3) Cómo probar la reconexión

1. Levanta servidor:

```bash
node server.js
```

2. Abre `http://localhost:3000`.

3. Detén el servidor (`Ctrl + C`) y observa el estado en el navegador.

4. Vuelve a ejecutar `node server.js` y confirma que el cliente reconecta solo.

Con esto ya tienes una base mucho más realista para apps en producción.

## 4) Explicación del código (bloque por bloque)

```js
const statusEl = document.getElementById('status');
const log = document.getElementById('log');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
```

- Tomamos referencias de los elementos del HTML para actualizar estado, pintar logs y manejar el formulario de envío.

```js
let socket = null;
let reconnectTimer = null;
const RECONNECT_DELAY_MS = 2000;
```

- `socket` guarda la conexión actual.
- `reconnectTimer` evita programar reconexiones duplicadas.
- `RECONNECT_DELAY_MS` define cada cuánto reintentamos conectarnos.

```js
function appendLog(text) {
  log.textContent += `${text}\n`;
}

function setStatus(text) {
  statusEl.textContent = `Estado: ${text}`;
}
```

- `appendLog` agrega líneas en el panel de salida.
- `setStatus` actualiza el estado visual (`conectando`, `conectado`, etc.).

```js
function connect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  setStatus('conectando...');
  appendLog('Intentando conectar...');
  socket = new WebSocket('ws://localhost:3000');
```

- `connect()` abre la conexión inicial o de reconexión.
- Primero limpia un timer pendiente para no tener dos reintentos en paralelo.
- Luego crea un nuevo `WebSocket` al servidor.

```js
  socket.addEventListener('open', () => {
    setStatus('conectado');
    appendLog('Conexión abierta');
  });
```

- `open`: se dispara cuando el handshake termina bien y ya puedes enviar/recibir.

```js
  socket.addEventListener('message', (event) => {
    appendLog(`Servidor: ${event.data}`);
  });
```

- `message`: llega un dato desde servidor. En este paso lo mostramos como texto plano.

```js
  socket.addEventListener('error', () => {
    setStatus('error');
    appendLog('Ocurrió un error en WebSocket');
  });
```

- `error`: informa fallos de red/protocolo. No siempre trae mucho detalle, pero sirve para diagnóstico básico.

```js
  socket.addEventListener('close', () => {
    setStatus('desconectado');
    appendLog(`Conexión cerrada. Reintentando en ${RECONNECT_DELAY_MS / 1000}s...`);

    reconnectTimer = setTimeout(() => {
      connect();
    }, RECONNECT_DELAY_MS);
  });
}
```

- `close`: la conexión terminó (por caída de red, cierre del servidor, etc.).
- Programamos reconexión automática con `setTimeout`.

```js
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) {
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(text);
    appendLog(`Tú: ${text}`);
    messageInput.value = '';
    messageInput.focus();
  } else {
    appendLog('No se envió: conexión no disponible');
  }
}
```

- `sendMessage()` valida input y estado del socket.
- Solo envía cuando `readyState` está en `OPEN`.
- Si no hay conexión activa, avisa en pantalla en lugar de fallar silenciosamente.

```js
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

connect();
```

- Vinculamos eventos de UI (click y Enter) al envío.
- `connect()` se ejecuta al cargar la página para iniciar el flujo completo.
