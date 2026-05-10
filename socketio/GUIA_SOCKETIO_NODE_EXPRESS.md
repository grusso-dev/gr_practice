# Guia paso a paso: Socket.IO con Node.js y Express

Esta guia esta pensada en modo mixto: teoria breve + practica directa.

## Objetivo

Aprender desde cero a construir una app en tiempo real usando Node.js, Express y Socket.IO.

## Plan de aprendizaje

1. Fundamentos: que es Socket.IO y cuando usarlo.
2. Preparacion del proyecto Node.js + Express.
3. Integrar Socket.IO en el servidor.
4. Conectar un cliente HTML y validar conexion.
5. Enviar y recibir eventos (`emit` y `on`).
6. Broadcast y rooms.
7. Mensajes privados basicos.
8. Buenas practicas: validacion, auth simple y reconexion.
9. Mini proyecto final: chat en tiempo real.
10. Integraciones externas: publicar desde PHP y JS fuera del proyecto.
11. Despliegue en VPS (Hostinger): puertos, Nginx, SSL y procesos.

## Estructura de apuntes

Cada paso tiene su propio archivo dentro de `pasos-socketio/`.

Formato aplicado en todos los pasos practicos:

- Codigo completo de `server.js` e `index.html` para copiar y pegar.
- Codigo comentado linea/bloque por bloque.
- Explicacion explicita de que cambia respecto al paso anterior.

- [Paso 1 - Fundamentos](pasos-socketio/paso-01-fundamentos.md)
- [Paso 2 - Setup del proyecto](pasos-socketio/paso-02-setup-proyecto.md)
- [Paso 3 - Servidor con Socket.IO](pasos-socketio/paso-03-servidor-socketio.md)
- [Paso 4 - Primer evento personalizado](pasos-socketio/paso-04-cliente-y-conexion.md)
- [Paso 5 - Eventos de chat](pasos-socketio/paso-05-eventos.md)
- [Paso 6 - Broadcast y rooms](pasos-socketio/paso-06-broadcast-y-rooms.md)
- [Paso 7 - Mensajes privados](pasos-socketio/paso-07-mensajes-privados.md)
- [Paso 8 - Buenas practicas](pasos-socketio/paso-08-buenas-practicas.md)
- [Paso 9 - Mini proyecto final](pasos-socketio/paso-09-mini-proyecto.md)
- [Paso 10 - Integraciones externas (PHP + JS)](pasos-socketio/paso-10-integraciones-externas.md)
- [Paso 11 - Deploy en VPS (Hostinger)](pasos-socketio/paso-11-deploy-vps-hostinger.md)

## Ruta recomendada de practica (30-45 min)

Objetivo: terminar con el mini chat funcionando (rooms + privados + auth simple).

### Bloque 1 (10 min) - Base y conexion

1. Lee rapido Paso 1 (conceptos).
2. Ejecuta Paso 2 y deja `server.js` + `index.html` funcionando.
3. Ejecuta Paso 3 y confirma conexion Socket.IO (`socket.id` en consola).

### Bloque 2 (10-15 min) - Eventos y chat publico

1. Completa Paso 4 para entender `emit` y `on`.
2. Completa Paso 5 para chat publico.
3. Prueba en 2 pestañas que ambos vean los mensajes.

### Bloque 3 (10-15 min) - Rooms y privados

1. Completa Paso 6 y separa usuarios en rooms distintas.
2. Completa Paso 7 y prueba mensajes privados entre 2 pestañas.

### Bloque 4 (5 min) - Robustez final

1. Completa Paso 8 (token + reconexion + limites).
2. Completa Paso 9 (historial por room).
3. Haz una prueba integral final en 2 o 3 pestañas.

### Bloque 5 (5 min) - Integracion externa

1. Completa Paso 10 con endpoint `POST /api/publish`.
2. Envia un mensaje desde cliente PHP externo.
3. Envia un mensaje desde cliente JS externo.

### Bloque 6 (10 min) - Deploy real en VPS

1. Completa Paso 11 con Nginx + SSL + systemd.
2. Verifica WebSocket en `https://midominio.com.ar`.
3. Valida `POST /publish` con API key desde app externa.

Iremos creando y completando cada archivo a medida que avancemos.
