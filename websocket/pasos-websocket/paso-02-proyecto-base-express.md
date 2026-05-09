# Paso 2: proyecto base con Express

Perfecto, en este paso vamos a dejar listo un servidor HTTP mínimo con Node.js + Express para usarlo como base antes de integrar WebSocket.

## 1) Crear carpeta del proyecto (si aún no existe)

```bash
mkdir websocket
cd websocket
```

Si ya estás dentro de la carpeta del proyecto, seguimos al siguiente paso.

## 2) Inicializar Node.js

```bash
npm init -y
```

Esto crea el archivo `package.json` con la configuración base del proyecto.

## 3) Instalar Express

```bash
npm install express
```

Express será nuestro framework para levantar el servidor HTTP y definir rutas básicas.

## 4) Crear archivo del servidor

Crea un archivo `server.js` con este contenido:

```js
const express = require('express');

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send('Servidor Express funcionando');
});

app.listen(PORT, () => {
  console.log(`Servidor HTTP en http://localhost:${PORT}`);
});
```

## 5) Ejecutar el servidor

```bash
node server.js
```

Ahora abre en el navegador:

`http://localhost:3000`

Deberías ver el mensaje: `Servidor Express funcionando`.

## 6) Resultado esperado de este paso

- ya tienes proyecto Node inicializado,
- Express instalado,
- servidor HTTP funcionando localmente.

Con esto, en el siguiente paso conectamos WebSocket sobre este mismo servidor.
