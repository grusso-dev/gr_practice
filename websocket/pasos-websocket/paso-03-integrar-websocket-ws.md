# Paso 3: integrar WebSocket (`ws`) con Express

Perfecto, ahora vamos a conectar WebSocket al mismo servidor HTTP que ya creamos con Express.

## 1) Instalar la librería `ws`

```bash
npm install ws
```

`ws` es una implementación simple y directa de WebSocket para Node.js, ideal para aprender fundamentos.

## 2) Reemplazar `server.js` para compartir HTTP + WebSocket

Usa este contenido en `server.js`:

```js
// Importamos Express para las rutas HTTP.
const express = require('express');
// Importamos http para crear el servidor base que compartirá Express + WebSocket.
const http = require('http');
// Importamos la librería ws para manejar conexiones WebSocket.
const WebSocket = require('ws');

const app = express();
const PORT = 3000;

// Ruta HTTP simple para comprobar que Express sigue funcionando.
app.get('/', (req, res) => {
  res.send('Servidor Express + WebSocket funcionando');
});

// Creamos el servidor HTTP a partir de la app de Express.
const server = http.createServer(app);
// Montamos WebSocket sobre el mismo servidor/puerto.
const wss = new WebSocket.Server({ server });

// Se dispara cada vez que un cliente abre conexión WebSocket.
wss.on('connection', (ws) => {
  console.log('Cliente WebSocket conectado');

  // Enviamos un mensaje de bienvenida apenas se conecta.
  ws.send('Bienvenido! Conexión WebSocket establecida.');

  // Escuchamos mensajes entrantes desde ese cliente.
  ws.on('message', (message) => {
    console.log('Mensaje recibido:', message.toString());
  });

  // Detectamos cuando el cliente se desconecta.
  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
  });
});

// Iniciamos el servidor HTTP (y con él también queda activo WebSocket).
server.listen(PORT, () => {
  console.log(`Servidor HTTP en http://localhost:${PORT}`);
  console.log(`WebSocket activo en ws://localhost:${PORT}`);
});
```

## 3) ¿Qué cambió respecto al paso anterior?

- ya no usamos `app.listen(...)` directo,
- creamos un servidor HTTP con `http.createServer(app)`,
- montamos WebSocket sobre ese servidor con `new WebSocket.Server({ server })`.

Esto permite que Express y WebSocket funcionen en el mismo puerto (`3000`).

## 4) Cómo se gestiona `wss.clients`

`wss.clients` lo mantiene automáticamente la librería `ws`.

- cuando un navegador abre `new WebSocket('ws://localhost:3000')` y el handshake termina bien, `ws` crea la conexión y la agrega a `wss.clients`,
- por eso, cuando corre `wss.on('connection', (ws) => { ... })`, ese cliente ya está registrado,
- cuando el cliente se desconecta o la conexión falla, `ws` lo quita del set automáticamente.

Dato útil: `wss.clients` es un `Set` (no un array), y representa solo los clientes conectados a ese servidor WebSocket en ese proceso.

## 5) Probar que levanta correctamente

```bash
node server.js
```

Debes ver en consola algo como:

- `Servidor HTTP en http://localhost:3000`
- `WebSocket activo en ws://localhost:3000`

## 6) Resultado esperado de este paso

- Express sigue respondiendo HTTP en `/`,
- el servidor ya acepta conexiones WebSocket,
- tienes eventos básicos: `connection`, `message` y `close`.

En el siguiente paso creamos un cliente HTML mínimo para conectarnos y enviar/recibir mensajes en vivo.
