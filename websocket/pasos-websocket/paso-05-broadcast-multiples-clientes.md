# Paso 5: broadcast a múltiples clientes

Perfecto. En este paso vamos a hacer que cada mensaje que envía un cliente se reparta a todos los clientes conectados.

Hasta ahora, cada navegador solo veía su propio mensaje local. Ahora convertimos eso en una comunicación grupal.

## 1) Actualizar `server.js` con broadcast

Reemplaza el contenido de `server.js` por este:

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
  ws.send('Bienvenido! Conexión WebSocket establecida.');

  // Se ejecuta cada vez que este cliente envía un mensaje.
  ws.on('message', (message) => {
    // Convertimos el Buffer a texto para poder mostrar/enviar contenido legible.
    const text = message.toString();
    console.log('Mensaje recibido:', text);

    // Recorremos todos los clientes conectados al servidor WebSocket.
    wss.clients.forEach((client) => {
      // Solo enviamos a conexiones que siguen abiertas.
      if (client.readyState === WebSocket.OPEN) {
        // Reenviamos el mensaje a cada cliente conectado (broadcast).
        client.send(text);
      }
    });
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

## 2) Probar con dos navegadores

1. Ejecuta el servidor:

```bash
node server.js
```

2. Abre dos pestañas o dos navegadores en:

`http://localhost:3000`

3. Escribe un mensaje en una ventana y envíalo.

## 3) Resultado esperado

- Si Browser 1 envía `hola`, Browser 1 y Browser 2 reciben `hola`.
- Si Browser 2 envía `chau`, Browser 1 y Browser 2 reciben `chau`.

Con esto ya tienes el comportamiento base de chat grupal en tiempo real.

## 4) Nota importante

Este broadcast envía texto plano tal como llega. En el siguiente paso estructuraremos mensajes en JSON para incluir metadatos (usuario, tipo de evento, etc.) y hacer la app más robusta.

## 5) Aclaración sobre `wss.clients`

Si te preguntas cómo aparecen clientes dentro de `wss.clients`, la respuesta es: lo hace `ws` automáticamente.

- al conectarse un cliente y completarse el handshake, `ws` lo agrega al set,
- al cerrar o perder la conexión, `ws` lo elimina,
- por eso al iterar `wss.clients` en el broadcast siempre recorres clientes activos de ese servidor.

También recuerda que `wss.clients` es un `Set` y no una lista global entre múltiples servidores.
