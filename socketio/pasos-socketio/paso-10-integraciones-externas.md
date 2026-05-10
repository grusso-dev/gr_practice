# Paso 10: Integraciones externas (PHP + JS)

## 1) Objetivo del paso

Publicar mensajes hacia tu chat Socket.IO desde aplicaciones externas, sin modificar tu `server.js` actual.

## 2) Que cambia respecto al paso anterior

En el Paso 9 todo vivia dentro de la misma app.

Ahora agregamos una arquitectura puente:

- `server_ext.js` (Node): se conecta al Socket.IO actual como cliente.
- `server_php` (PHP): recibe HTTP y lo reenvia al bridge.
- `js_externo` (Node script): ejemplo de otra app JS fuera del proyecto principal.

Con esto no tocas el servidor de chat actual.

## 3) Bloques de codigo que cambian vs Paso 9

### Bloque 1 (`server_ext.js`) - puente HTTP -> Socket.IO

```js
const socket = io(SOCKET_SERVER_URL, { auth: { token: SOCKET_TOKEN } });

app.post("/publish", (req, res) => {
  socket.emit("chat_message", { texto: req.body.texto });
  res.json({ ok: true });
});
```

### Bloque 2 (`server_php/index.php`) - API key + forward al bridge

```php
if ($apiKey !== API_KEY) {
  http_response_code(401);
  echo json_encode(["ok" => false]);
  exit;
}

// POST a http://localhost:4100/publish
```

### Bloque 3 (`js_externo/publish.js`) - publicacion externa por HTTP

```js
await fetch("http://localhost:4200/publish", {
  method: "POST",
  headers: { "x-api-key": API_KEY, "content-type": "application/json" },
  body: JSON.stringify(payload),
});
```

## 4) Codigo completo de `server_ext.js` (copiar y pegar)

Archivo: `server_ext.js`

```js
// Importa Express para exponer endpoint HTTP de publicacion.
const express = require("express");

// Importa cliente Socket.IO para conectarse al servidor de chat existente.
const { io } = require("socket.io-client");

// Configuracion del bridge externo.
const BRIDGE_PORT = 4100;
const BRIDGE_API_KEY = "bridge-key-demo-123";
const SOCKET_SERVER_URL = "http://localhost:3000";
const SOCKET_TOKEN = "token-demo-123";
const DEFAULT_ROOM = "general";

// Crea app HTTP.
const app = express();
app.use(express.json());

// Conecta este servidor externo como cliente al Socket.IO principal.
const socket = io(SOCKET_SERVER_URL, {
  auth: { token: SOCKET_TOKEN },
  reconnection: true,
});

// Log de estado del bridge.
socket.on("connect", () => {
  console.log(`[server_ext] conectado a Socket.IO como ${socket.id}`);
});

socket.on("connect_error", (err) => {
  console.error(`[server_ext] error de conexion: ${err.message}`);
});

// Endpoint que recibe mensajes externos y los publica al chat.
app.post("/publish", (req, res) => {
  // Valida API key del emisor externo.
  const apiKey = req.header("x-api-key");
  if (apiKey !== BRIDGE_API_KEY) {
    return res.status(401).json({ ok: false, error: "API key invalida" });
  }

  // Valida payload minimo.
  const room = typeof req.body.room === "string" ? req.body.room.trim().toLowerCase() : DEFAULT_ROOM;
  const texto = typeof req.body.texto === "string" ? req.body.texto.trim() : "";
  const usuario = typeof req.body.usuario === "string" ? req.body.usuario.trim() : "externo";

  if (!texto) {
    return res.status(400).json({ ok: false, error: "texto requerido" });
  }

  // El servidor principal usa room actual del socket.
  // Primero entramos a la room requerida y luego emitimos chat_message.
  socket.emit("join_room", { room });
  socket.emit("register_user", { username: usuario });
  socket.emit("chat_message", { texto });

  return res.json({ ok: true, room, usuario, texto });
});

// Arranca servidor externo.
app.listen(BRIDGE_PORT, () => {
  console.log(`[server_ext] HTTP listo en http://localhost:${BRIDGE_PORT}`);
});
```

## 5) Codigo completo de `server_php/index.php` (copiar y pegar)

Archivo: `integraciones-externas/server_php/index.php`

```php
<?php
// Configuracion basica del server PHP.
const API_KEY = 'php-key-demo-456';
const BRIDGE_URL = 'http://localhost:4100/publish';
const BRIDGE_API_KEY = 'bridge-key-demo-123';

// Habilita JSON de salida.
header('Content-Type: application/json; charset=utf-8');

// Permite solo POST para publicar mensajes.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Metodo no permitido']);
    exit;
}

// Valida API key entrante para proteger este server_php.
$incomingApiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($incomingApiKey !== API_KEY) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'API key invalida']);
    exit;
}

// Lee payload JSON recibido.
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON invalido']);
    exit;
}

// Normaliza payload con defaults.
$payload = [
    'room' => isset($data['room']) ? trim((string)$data['room']) : 'general',
    'usuario' => isset($data['usuario']) ? trim((string)$data['usuario']) : 'php-app',
    'texto' => isset($data['texto']) ? trim((string)$data['texto']) : ''
];

if ($payload['texto'] === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'texto requerido']);
    exit;
}

// Reenvia el mensaje al bridge Node que publica en Socket.IO.
$ch = curl_init(BRIDGE_URL);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'x-api-key: ' . BRIDGE_API_KEY,
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'Error al llamar bridge', 'detail' => $err]);
    exit;
}

http_response_code($status > 0 ? $status : 200);
echo $response;
```

## 6) Codigo completo de `js_externo/publish.js` (copiar y pegar)

Archivo: `integraciones-externas/js_externo/publish.js`

```js
// URL de server_php (app externa).
const PHP_SERVER_URL = "http://localhost:4200";

// API key que protege server_php.
const PHP_API_KEY = "php-key-demo-456";

async function main() {
  // Payload de ejemplo para publicar en room general.
  const payload = {
    room: "general",
    usuario: "js-externo",
    texto: "Hola desde otra aplicacion JavaScript",
  };

  // Envia POST hacia server_php.
  const response = await fetch(`${PHP_SERVER_URL}/publish`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": PHP_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  // Muestra resultado para diagnostico rapido.
  const text = await response.text();
  console.log("status:", response.status);
  console.log("body:", text);
}

main().catch((err) => {
  console.error("Fallo publicando desde js_externo:", err);
});
```

## 7) Estructura de carpetas sugerida

```text
socketio/
  server.js
  server_ext.js
  integraciones-externas/
    server_php/
      index.php
    js_externo/
      publish.js
```

## 8) Comandos para correr todo

### 8.1 Servidor principal (tu chat actual)

```bash
npm start
```

### 8.2 Servidor externo Node (raiz del proyecto)

```bash
npm run start:ext
```

### 8.3 Server PHP

```bash
cd integraciones-externas/server_php
php -S localhost:4200 index.php
```

### 8.4 Cliente JS externo

```bash
cd integraciones-externas/js_externo
node publish.js
```

## 9) Como probar

1. Abre `http://localhost:3000` (chat principal) en una o dos pestañas.
2. Levanta `server_ext.js`.
3. Levanta `server_php`.
4. Ejecuta `node publish.js`.
5. Verifica que aparece un mensaje en la room `general` en el chat.

## 10) Errores comunes

- Si `server_ext.js` no conecta, revisa token `token-demo-123` y que el server principal este en `:3000`.
- Si PHP devuelve 401, revisa header `x-api-key` contra `php-key-demo-456`.
- Si PHP devuelve 502, revisa que el bridge este arriba en `http://localhost:4100`.
- Si llega al bridge pero no al chat, revisa evento `chat_message` y room.

## 11) Resultado de este paso

Ya puedes publicar mensajes al chat Socket.IO desde:

- una aplicacion PHP externa (`server_php`)
- otra aplicacion JS externa (`js_externo`)

sin tocar el servidor principal del proyecto.
