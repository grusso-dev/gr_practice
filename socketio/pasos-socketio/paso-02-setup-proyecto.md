# Paso 2: Preparar proyecto Node.js + Express + Socket.IO

## 1) Objetivo del paso

Dejar un proyecto minimo funcionando con dependencias instaladas y estructura base para empezar la parte en tiempo real.

## 2) Teoria corta

En esta etapa todavia no hacemos logica de eventos compleja.
Primero necesitamos:

- Un servidor HTTP con Express.
- Socket.IO montado sobre ese servidor HTTP.
- Un cliente HTML simple para conectarnos despues.

Socket.IO no reemplaza Express: trabajan juntos.

Como este paso sigue a fundamentos (Paso 1), aqui agregamos el primer esqueleto de archivos para que ya puedas copiar y pegar algo ejecutable.

## 3) Dependencias

En la carpeta del proyecto ejecuta:

```bash
npm init -y
npm install express socket.io
```

Opcional para desarrollo:

```bash
npm install -D nodemon
```

## 4) Estructura recomendada

```text
socketio/
  server.js
  index.html
  package.json
  pasos-socketio/
    paso-01-fundamentos.md
    paso-02-setup-proyecto.md
```

## 5) Que cambia respecto al paso anterior

En el Paso 1 no habia codigo, solo conceptos.

En este paso aparecen por primera vez los archivos de trabajo:

- `server.js` con estructura minima (sin logica Socket.IO todavia).
- `index.html` base para validar que Express sirve una vista.
- Scripts de npm para correr rapido.

## 6) Codigo completo de `server.js` (copiar y pegar)

```js
// Importa Express para crear el servidor web.
const express = require("express");

// Crea la app de Express.
const app = express();

// Define el puerto del servidor.
const PORT = 3000;

// Ruta raiz para devolver el HTML principal.
app.get("/", (req, res) => {
  // Envia el archivo index.html que vive en la misma carpeta.
  res.sendFile(__dirname + "/index.html");
});

// Inicia el servidor HTTP.
app.listen(PORT, () => {
  console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
});
```

## 7) Codigo completo de `index.html` (copiar y pegar)

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Socket.IO - Paso 2</title>
  </head>
  <body>
    <!-- Contenido minimo para validar que Express sirve HTML. -->
    <h1>Proyecto base listo</h1>
    <p>En el Paso 3 conectaremos Socket.IO sobre este servidor.</p>
  </body>
</html>
```

## 8) Script sugerido en package.json

Agrega scripts para arrancar facil:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

## 9) Checklist rapido

- Node.js instalado (`node -v`).
- `npm install` completado sin errores.
- `express` y `socket.io` presentes en `dependencies`.
- `server.js` e `index.html` creados y funcionando en navegador.

## 10) Resultado de este paso

Ya tienes la base del proyecto lista para arrancar el servidor real.

En el siguiente paso vamos a montar Express con Socket.IO y validar que el servidor arranque en `http://localhost:3000`.
