# Paso 5: Mensajes de chat reales (`chat_message`)

## 1) Objetivo del paso

Convertir el ejemplo de saludo del Paso 4 en un mini chat real:

- El cliente enviara mensajes de chat.
- El servidor recibira esos mensajes.
- El servidor hara broadcast a todos los clientes conectados.
- El cliente renderizara una lista de mensajes en pantalla.

## 2) Que cambia respecto al paso anterior

En el Paso 4 teniamos un evento de prueba (`saludo`) con respuesta solo al emisor.

Ahora cambiamos a un flujo de chat:

- Reemplazamos `saludo` por `chat_message`.
- En servidor usamos `io.emit(...)` para que todos reciban el mensaje.
- En cliente agregamos formulario y lista visual de mensajes.

## 3) Bloques de codigo que cambian vs Paso 4

### Bloque 1 (`server.js`) - cambio de evento y broadcast global

```js
socket.on("chat_message", (payload) => {
  const textoLimpio = payload.texto.trim();

  const mensaje = {
    usuario: payload.usuario?.trim() || "Anonimo",
    texto: textoLimpio,
    socketId: socket.id,
    fecha: new Date().toISOString(),
  };

  io.emit("chat_message", mensaje);
});
```

### Bloque 2 (`index.html`) - formulario de chat + render de lista

```html
<form id="chatForm">
  <input id="usuario" type="text" />
  <input id="texto" type="text" />
  <button type="submit">Enviar</button>
</form>
<ul id="mensajes"></ul>

<script>
  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    socket.emit("chat_message", { usuario: usuarioInput.value, texto: textoInput.value });
  });

  socket.on("chat_message", (data) => {
    const item = document.createElement("li");
    item.textContent = `[${new Date(data.fecha).toLocaleTimeString()}] ${data.usuario}: ${data.texto}`;
    mensajes.appendChild(item);
  });
</script>
```

## 4) Codigo completo de `server.js` (copiar y pegar)

```js
// Importa Express para manejar rutas HTTP.
const express = require("express");

// Importa HTTP nativo para crear el servidor base.
const http = require("http");

// Importa Socket.IO para tiempo real por eventos.
const { Server } = require("socket.io");

// Crea la app de Express.
const app = express();

// Crea el servidor HTTP a partir de Express.
const server = http.createServer(app);

// Monta Socket.IO sobre el servidor HTTP.
const io = new Server(server);

// Entrega el cliente HTML en la ruta raiz.
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Se dispara por cada nuevo cliente conectado.
io.on("connection", (socket) => {
  // Log del cliente conectado.
  console.log("Nuevo cliente conectado:", socket.id);

  // Escucha mensajes de chat enviados por cualquier cliente.
  socket.on("chat_message", (payload) => {
    // Validacion basica para evitar mensajes invalidos.
    if (!payload || typeof payload.texto !== "string") {
      socket.emit("error_message", {
        mensaje: "Formato de mensaje invalido.",
      });
      return;
    }

    // Limpia espacios y evita mensajes vacios.
    const textoLimpio = payload.texto.trim();
    if (!textoLimpio) {
      socket.emit("error_message", {
        mensaje: "El mensaje no puede estar vacio.",
      });
      return;
    }

    // Construye el mensaje final que se enviara a todos.
    const mensaje = {
      usuario: payload.usuario?.trim() || "Anonimo",
      texto: textoLimpio,
      socketId: socket.id,
      fecha: new Date().toISOString(),
    };

    // Broadcast global: todos los clientes (incluyendo emisor) reciben el chat.
    io.emit("chat_message", mensaje);
  });

  // Log cuando un cliente se desconecta.
  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});

// Puerto de escucha del servidor.
const PORT = 3000;

// Arranca el servidor.
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
    <title>Socket.IO - Paso 5</title>
    <style>
      /* Estilos basicos para una UI clara de chat. */
      body {
        font-family: sans-serif;
        margin: 2rem;
        max-width: 800px;
      }

      h1 {
        margin-bottom: 1rem;
      }

      form {
        display: grid;
        grid-template-columns: 180px 1fr auto;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }

      input,
      button {
        padding: 0.6rem;
        font-size: 1rem;
      }

      #mensajes {
        list-style: none;
        padding: 0;
        margin: 0;
        border: 1px solid #ddd;
        border-radius: 8px;
        min-height: 200px;
      }

      #mensajes li {
        padding: 0.75rem;
        border-bottom: 1px solid #eee;
      }

      #mensajes li:last-child {
        border-bottom: none;
      }

      #error {
        color: #b00020;
        margin-top: 0.75rem;
        min-height: 1.2rem;
      }
    </style>
  </head>
  <body>
    <h1>Paso 5 - Chat basico en tiempo real</h1>

    <!-- Formulario para enviar mensajes al servidor. -->
    <form id="chatForm">
      <input id="usuario" type="text" placeholder="Tu nombre" value="ClienteDemo" />
      <input id="texto" type="text" placeholder="Escribe un mensaje" />
      <button type="submit">Enviar</button>
    </form>

    <!-- Lista donde se renderizan mensajes recibidos. -->
    <ul id="mensajes"></ul>

    <!-- Zona para mostrar errores enviados por el servidor. -->
    <div id="error"></div>

    <!-- Script cliente de Socket.IO servido automaticamente por el servidor. -->
    <script src="/socket.io/socket.io.js"></script>
    <script>
      // Abre conexion con el servidor Socket.IO.
      const socket = io();

      // Referencias de elementos del DOM.
      const chatForm = document.getElementById("chatForm");
      const usuarioInput = document.getElementById("usuario");
      const textoInput = document.getElementById("texto");
      const mensajes = document.getElementById("mensajes");
      const errorBox = document.getElementById("error");

      // Evento de conexion exitosa.
      socket.on("connect", () => {
        console.log("Conectado con id:", socket.id);
      });

      // Envia el mensaje al servidor cuando se hace submit.
      chatForm.addEventListener("submit", (event) => {
        // Evita recarga de pagina por comportamiento default del form.
        event.preventDefault();

        // Limpia mensaje de error previo.
        errorBox.textContent = "";

        // Emite evento chat_message con usuario y texto.
        socket.emit("chat_message", {
          usuario: usuarioInput.value,
          texto: textoInput.value,
        });

        // Limpia input de texto para escribir el siguiente mensaje.
        textoInput.value = "";
        textoInput.focus();
      });

      // Escucha mensajes broadcast y los pinta en la lista.
      socket.on("chat_message", (data) => {
        // Crea un elemento visual por cada mensaje recibido.
        const item = document.createElement("li");

        // Da formato legible al timestamp.
        const hora = new Date(data.fecha).toLocaleTimeString();

        // Texto final que se muestra en pantalla.
        item.textContent = `[${hora}] ${data.usuario}: ${data.texto}`;

        // Agrega el mensaje al final de la lista.
        mensajes.appendChild(item);
      });

      // Escucha errores enviados por el servidor.
      socket.on("error_message", (data) => {
        errorBox.textContent = data.mensaje;
      });
    </script>
  </body>
</html>
```

## 6) Como probar

```bash
npm start
```

Pasos de validacion:

1. Abre `http://localhost:3000` en dos pestañas.
2. Envia un mensaje desde una pestaña.
3. Confirma que aparece en ambas (broadcast).
4. Intenta enviar mensaje vacio y revisa el error.

## 7) Errores comunes en este paso

- Si no carga `socket.io.js`, revisa que el servidor este corriendo.
- Si no aparecen mensajes, confirma que el nombre del evento sea exactamente `chat_message` en cliente y servidor.
- Si el form recarga la pagina, verifica `event.preventDefault()`.

## 8) Resultado de este paso

Ya tienes un chat funcional basico en tiempo real usando eventos personalizados.

En el Paso 6 vamos a separar conversaciones por grupos usando **rooms**.
