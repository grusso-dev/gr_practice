# Paso 4: Primer evento personalizado (`emit` y `on`)

## 1) Objetivo del paso

Enviar y recibir nuestro primer evento personalizado entre cliente y servidor.

## 2) Que cambia respecto al paso anterior

En el Paso 3 solo validamos conexion (`connect` y `disconnect`).
Ahora agregamos comunicacion real:

- El cliente enviara un evento llamado `saludo`.
- El servidor escuchara `saludo`.
- El servidor respondera con `respuesta_servidor`.
- El cliente escuchara `respuesta_servidor` y lo mostrara en pantalla.

Esto ya representa el patron central de Socket.IO: **emitir eventos y escucharlos**.

## 3) Bloques de codigo que cambian vs Paso 3

### Bloque 1 (`server.js`) - nuevo listener y respuesta personalizada

```js
socket.on("saludo", (payload) => {
  console.log("Evento 'saludo' recibido:", payload);

  socket.emit("respuesta_servidor", {
    mensaje: "Hola cliente, recibi tu saludo correctamente.",
    recibido: payload,
    fecha: new Date().toISOString(),
  });
});
```

### Bloque 2 (`index.html`) - nuevo boton, emit y listener de respuesta

```html
<button id="btnSaludar">Enviar saludo al servidor</button>
<pre id="respuesta">Aun no hay respuesta...</pre>

<script>
  btnSaludar.addEventListener("click", () => {
    socket.emit("saludo", { usuario: "ClienteDemo", texto: "Hola servidor" });
  });

  socket.on("respuesta_servidor", (data) => {
    respuesta.textContent = JSON.stringify(data, null, 2);
  });
</script>
```

## 4) Codigo completo de `server.js` (copiar y pegar)

```js
// Importa Express para crear rutas HTTP basicas.
const express = require("express");

// Importa el modulo HTTP de Node para crear el servidor base.
const http = require("http");

// Importa Server desde socket.io para habilitar comunicacion en tiempo real.
const { Server } = require("socket.io");

// Crea la aplicacion Express.
const app = express();

// Crea el servidor HTTP usando la app Express.
const server = http.createServer(app);

// Monta Socket.IO sobre el servidor HTTP.
const io = new Server(server);

// Sirve el archivo index.html cuando visitamos la raiz.
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Se ejecuta cada vez que un cliente se conecta por Socket.IO.
io.on("connection", (socket) => {
  // Muestra en consola el id unico del cliente conectado.
  console.log("Nuevo cliente conectado:", socket.id);

  // Escucha el evento personalizado "saludo" enviado por el cliente.
  socket.on("saludo", (payload) => {
    // Log para ver que datos llegaron desde el cliente.
    console.log("Evento 'saludo' recibido:", payload);

    // Responde solo al cliente que envio el mensaje.
    socket.emit("respuesta_servidor", {
      mensaje: "Hola cliente, recibi tu saludo correctamente.",
      recibido: payload,
      fecha: new Date().toISOString(),
    });
  });

  // Se ejecuta cuando ese cliente se desconecta.
  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});

// Define el puerto donde correra el servidor.
const PORT = 3000;

// Inicia el servidor y muestra la URL de acceso.
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
```

## 5) Codigo completo de `index.html` (copiar y pegar)

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Socket.IO - Paso 4</title>
    <style>
      /* Estilo basico para que se vea claro el resultado. */
      body {
        font-family: sans-serif;
        margin: 2rem;
      }
      pre {
        background: #f4f4f4;
        padding: 1rem;
        border-radius: 8px;
      }
    </style>
  </head>
  <body>
    <h1>Paso 4 - Evento personalizado</h1>
    <button id="btnSaludar">Enviar saludo al servidor</button>
    <h2>Respuesta del servidor:</h2>
    <pre id="respuesta">Aun no hay respuesta...</pre>

    <!-- Carga la libreria cliente de Socket.IO desde el propio servidor. -->
    <script src="/socket.io/socket.io.js"></script>
    <script>
      // Crea la conexion con el servidor Socket.IO.
      const socket = io();

      // Obtiene referencias a elementos del DOM.
      const btnSaludar = document.getElementById("btnSaludar");
      const respuesta = document.getElementById("respuesta");

      // Se ejecuta al conectar correctamente.
      socket.on("connect", () => {
        console.log("Conectado con id:", socket.id);
      });

      // Al hacer click, enviamos el evento personalizado "saludo".
      btnSaludar.addEventListener("click", () => {
        socket.emit("saludo", {
          usuario: "ClienteDemo",
          texto: "Hola servidor",
        });
      });

      // Escucha la respuesta que manda el servidor.
      socket.on("respuesta_servidor", (data) => {
        // Muestra el objeto recibido en formato legible.
        respuesta.textContent = JSON.stringify(data, null, 2);
      });
    </script>
  </body>
</html>
```

## 6) Como probar

```bash
npm start
```

Luego abre `http://localhost:3000`, haz click en **Enviar saludo al servidor** y valida:

- En terminal: aparece el evento `saludo` recibido.
- En navegador: aparece el JSON de `respuesta_servidor`.

## 7) Resultado de este paso

Ya dominas el ciclo minimo de mensajeria en Socket.IO:

- Cliente `emit` -> Servidor `on`
- Servidor `emit` -> Cliente `on`

En el Paso 5 pasaremos a mensajes de chat reales (`chat_message`) y render de lista de mensajes.
