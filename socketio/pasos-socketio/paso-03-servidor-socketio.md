# Paso 3: Montar servidor Express con Socket.IO

## 1) Objetivo del paso

Levantar un servidor HTTP con Express e integrar Socket.IO para aceptar conexiones en tiempo real.

## 2) Teoria corta

Socket.IO necesita un servidor HTTP real para colgarse encima.
Por eso el flujo correcto es:

1. Crear app Express.
2. Crear servidor HTTP con esa app.
3. Pasar ese servidor a `new Server(...)` de Socket.IO.

## 3) Que cambia respecto al paso anterior

En el Paso 2 solo levantamos Express con `app.listen(...)`.

Ahora cambiamos esos bloques clave:

- Reemplazamos `app.listen(...)` por `http.createServer(app)` + `server.listen(...)`.
- Inicializamos Socket.IO con `const io = new Server(server);`.
- Agregamos eventos `connection` y `disconnect` para validar conexion realtime.

## 4) Codigo completo de `server.js` (copiar y pegar)

Usa este contenido:

```js
// Importa Express para crear rutas HTTP basicas.
const express = require("express");

// Importa HTTP nativo de Node para crear servidor base.
const http = require("http");

// Importa Server de Socket.IO para habilitar tiempo real.
const { Server } = require("socket.io");

// Crea la app de Express.
const app = express();

// Crea servidor HTTP a partir de la app Express.
const server = http.createServer(app);

// Monta Socket.IO sobre el servidor HTTP.
const io = new Server(server);

// Entrega index.html en la ruta raiz.
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Evento que se dispara al conectar un cliente.
io.on("connection", (socket) => {
  // Log de conexion del cliente actual.
  console.log("Nuevo cliente conectado:", socket.id);

  // Evento que se dispara cuando ese cliente se desconecta.
  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});

// Puerto de ejecucion local.
const PORT = 3000;

// Arranca el servidor HTTP + Socket.IO.
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
```

## 5) Codigo completo de `index.html` (copiar y pegar)

Si no lo tienes aun, crea `index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Socket.IO - Paso 3</title>
  </head>
  <body>
    <!-- Texto minimo para verificar que el cliente carga correctamente. -->
    <h1>Socket.IO conectado</h1>

    <!-- Carga el cliente Socket.IO servido automaticamente por el backend. -->
    <script src="/socket.io/socket.io.js"></script>
    <script>
      // Crea la conexion del cliente hacia el servidor Socket.IO.
      const socket = io();

      // Se ejecuta cuando la conexion se completa.
      socket.on("connect", () => {
        console.log("Conectado con id:", socket.id);
      });
    </script>
  </body>
</html>
```

## 6) Aclaracion importante sobre `socket.io.js`

No necesitas crear un archivo fisico `socket.io.js` en tu proyecto.

- La ruta `<script src="/socket.io/socket.io.js"></script>` la expone automaticamente el servidor de Socket.IO.
- Es un archivo virtual servido por la libreria cuando inicializas `const io = new Server(server);`.
- Si el servidor esta corriendo, esa URL responde sola.

Prueba rapida:

- Abre `http://localhost:3000/socket.io/socket.io.js` en el navegador.
- Deberias ver codigo JavaScript de la libreria cliente.

## 7) Ejecutar y validar

Inicia el servidor:

```bash
npm start
```

Abre `http://localhost:3000` y revisa:

- En navegador: se ve el titulo `Socket.IO conectado`.
- En consola del navegador: aparece el `socket.id`.
- En terminal del servidor: aparece `Nuevo cliente conectado`.

## 8) Resultado de este paso

Ya tienes la conexion cliente-servidor funcionando con Socket.IO.

En el Paso 4 vamos a enviar y recibir el primer evento personalizado entre cliente y servidor.
