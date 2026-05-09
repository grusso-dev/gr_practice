# Paso 4: cliente HTML mínimo (conectar, enviar y recibir)

Perfecto, ahora vamos a crear un cliente web básico para probar la conexión WebSocket desde el navegador.

## 1) Crear archivo `index.html`

Guarda este archivo como `index.html` (por ejemplo, en la raíz del proyecto):

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cliente WebSocket</title>
    <style>
      /* Estilos mínimos para que el ejemplo se vea ordenado. */
      body {
        font-family: sans-serif;
        max-width: 700px;
        margin: 2rem auto;
        padding: 0 1rem;
      }

      #log {
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 1rem;
        min-height: 160px;
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
    <h1>Prueba WebSocket</h1>

    <!-- Contenedor donde mostramos eventos y mensajes. -->
    <div id="log"></div>

    <div class="row">
      <!-- Input para escribir el mensaje a enviar. -->
      <input id="messageInput" type="text" placeholder="Escribe un mensaje" />
      <!-- Botón para enviar el mensaje por WebSocket. -->
      <button id="sendButton">Enviar</button>
    </div>

    <script>
      // Referencias a elementos del DOM.
      const log = document.getElementById('log');
      const messageInput = document.getElementById('messageInput');
      const sendButton = document.getElementById('sendButton');

      // Función utilitaria para imprimir líneas en pantalla.
      function appendLog(text) {
        log.textContent += `${text}\n`;
      }

      // Creamos la conexión WebSocket al mismo puerto del servidor.
      const socket = new WebSocket('ws://localhost:3000');

      // Evento: conexión abierta.
      socket.addEventListener('open', () => {
        appendLog('Conexión WebSocket abierta');
      });

      // Evento: mensaje recibido desde el servidor.
      socket.addEventListener('message', (event) => {
        appendLog(`Servidor: ${event.data}`);
      });

      // Evento: conexión cerrada.
      socket.addEventListener('close', () => {
        appendLog('Conexión WebSocket cerrada');
      });

      // Evento: error de conexión/comunicación.
      socket.addEventListener('error', () => {
        appendLog('Ocurrió un error en WebSocket');
      });

      // Enviamos el texto del input al hacer click.
      sendButton.addEventListener('click', () => {
        const text = messageInput.value.trim();

        // Evitamos enviar mensajes vacíos.
        if (!text) {
          return;
        }

        // Validamos que la conexión esté abierta antes de enviar.
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(text);
          appendLog(`Tú: ${text}`);
          messageInput.value = '';
          messageInput.focus();
        } else {
          appendLog('No se pudo enviar: conexión no disponible');
        }
      });
    </script>
  </body>
</html>
```

## 2) Servir el `index.html` con Express

Para abrir la página desde tu servidor (en lugar de archivo local), actualiza `server.js` así:

```js
// Importamos Express para servidor y rutas.
const express = require('express');
// Importamos http para compartir servidor HTTP con WebSocket.
const http = require('http');
// Importamos ws para la capa WebSocket.
const WebSocket = require('ws');
// Importamos path para resolver rutas de archivos estáticos.
const path = require('path');

const app = express();
const PORT = 3000;

// Servimos index.html y otros archivos estáticos desde la carpeta actual.
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Cuando un cliente se conecta, enviamos un saludo.
wss.on('connection', (ws) => {
  console.log('Cliente WebSocket conectado');
  ws.send('Bienvenido! Conexión WebSocket establecida.');

  // Mostramos en consola cada mensaje que llega del navegador.
  ws.on('message', (message) => {
    console.log('Mensaje recibido:', message.toString());
  });

  // Notificamos desconexión del cliente.
  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
  });
});

// Levantamos servidor HTTP + WebSocket en el mismo puerto.
server.listen(PORT, () => {
  console.log(`Servidor HTTP en http://localhost:${PORT}`);
  console.log(`WebSocket activo en ws://localhost:${PORT}`);
});
```

## 3) Probar el flujo completo

1. Ejecuta:

```bash
node server.js
```

2. Abre en el navegador:

`http://localhost:3000`

3. Escribe un mensaje y pulsa **Enviar**.

## 4) ¿Qué debes observar?

- En la página: estado de conexión y mensajes enviados/recibidos.
- En consola del servidor: los mensajes que envía el cliente.

Con esto ya tienes ida y vuelta real cliente-servidor por WebSocket.
