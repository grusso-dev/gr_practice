# Paso 12: `ws` vs `socket.io` (cómo elegir)

Perfecto, cerramos la ruta con una comparación práctica para decidir qué usar según el tipo de proyecto.

## 1) Idea central

- `ws`: implementación directa del protocolo WebSocket (más "baja capa").
- `socket.io`: librería de más alto nivel, con funcionalidades extra sobre WebSocket.

No es que una sea "mejor" en absoluto; depende de tus requisitos.

## 2) Cuándo elegir `ws`

Elige `ws` cuando:

- quieres control fino del protocolo y del flujo de mensajes,
- buscas menor abstracción y menor overhead,
- necesitas una base liviana y entiendes bien reconexión/rooms/heartbeat,
- tu arquitectura ya resuelve esas piezas (o no las necesita).

Ventajas:

- simple, directo, flexible,
- muy bueno para aprender fundamentos,
- te obliga a diseñar tu propio contrato de eventos (como hicimos con `type/payload`).

Coste:

- más trabajo manual (reconexión avanzada, rooms distribuidas, middlewares de auth, etc.).

## 3) Cuándo elegir `socket.io`

Elige `socket.io` cuando:

- priorizas productividad y features listas para usar,
- necesitas rooms/namespaces/eventos custom sin implementarlo todo a mano,
- quieres reconexión automática madura de fábrica,
- prefieres una API más conveniente para aplicaciones de producto.

Ventajas:

- ecosistema y API cómodos,
- muchas capacidades listas (rooms, broadcast selectivo, acknowledgements, middlewares),
- desarrollo más rápido para casos comunes.

Coste:

- más abstracción,
- dependes del protocolo propio de Socket.IO (cliente y servidor deben usar Socket.IO).

## 4) Tabla de decisión rápida

| Criterio | `ws` | `socket.io` |
|---|---|---|
| Nivel de abstracción | Bajo | Alto |
| Curva para tiempo real robusto | Mayor (manual) | Menor (builtin) |
| Control del protocolo | Muy alto | Medio |
| Velocidad para MVP con features | Media | Alta |
| Cliente requerido | WebSocket estándar | Cliente Socket.IO |

## 5) Regla práctica para elegir

- Si quieres **aprender y controlar**: empieza con `ws` (como en esta guía).
- Si quieres **entregar rápido producto** con muchas features en tiempo real: considera `socket.io`.

## 6) Mini ejemplo equivalente (solo referencia)

### 6.1 Ejemplo mínimo con `ws` (servidor)

```js
// Ejemplo base con ws.
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    // Broadcast manual a todos los clientes.
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg.toString());
      }
    });
  });
});

server.listen(3000);
```

### 6.2 Ejemplo mínimo con `socket.io` (servidor)

```js
// Ejemplo base con socket.io.
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  socket.on('chat_message', (payload) => {
    // Broadcast directo con API de socket.io.
    io.emit('chat_message', payload);
  });
});

server.listen(3000);
```

## 7) Cómo migrar gradualmente (si luego quieres Socket.IO)

1. Mantén tu contrato de mensajes (`type` + `payload`) aunque cambies transporte.
2. Migra primero servidor y cliente de un entorno de prueba.
3. Reimplementa auth/rooms/presence con primitivas nativas de Socket.IO.
4. Mantén pruebas de reconexión y aislamiento por sala antes de pasar a producción.

## 8) Cierre de la ruta

Con estos 12 pasos ya cubriste:

- fundamentos de WebSocket,
- integración con Express,
- cliente real con reconexión,
- validación y seguridad básica,
- heartbeat de servidor,
- autenticación básica y rooms,
- criterio de elección tecnológica.

Siguiente nivel natural: JWT real, persistencia de mensajes, escalado horizontal (Redis pub/sub) y observabilidad.
