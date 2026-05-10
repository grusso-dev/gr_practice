# Paso 1: Fundamentos de Socket.IO

## 1) Idea principal

Socket.IO permite comunicacion en tiempo real entre cliente y servidor con un modelo basado en eventos.

Ejemplo mental rapido:

- HTTP clasico: cliente pide -> servidor responde (ciclo cerrado).
- Socket.IO: cliente y servidor quedan conectados y ambos pueden enviar eventos cuando quieran.

## 2) Teoria corta: Socket.IO vs WebSocket puro

WebSocket puro es el protocolo base. Socket.IO es una libreria que agrega capas utiles arriba de eso:

- Reconexion automatica.
- Rooms y namespaces.
- API de eventos (`emit`, `on`).
- Fallbacks de transporte cuando aplica.

Conclusión practica: para apps de negocio y aprendizaje, Socket.IO acelera mucho el desarrollo.

## 3) Casos de uso tipicos

- Chat en tiempo real.
- Notificaciones en vivo.
- Tableros (dashboards) con datos en streaming.
- Colaboracion en tiempo real (edicion compartida, presencia, etc.).

## 4) Conceptos que usaremos siempre

- `connection`: evento cuando un cliente se conecta.
- `disconnect`: evento cuando se desconecta.
- `emit`: enviar un evento.
- `on`: escuchar un evento.
- `room`: grupo logico para enviar mensajes a varios clientes.

## 5) Mini practica conceptual

Flujo de un chat basico:

1. Cliente se conecta al servidor Socket.IO.
2. Cliente emite `chat_message` con texto.
3. Servidor escucha `chat_message`.
4. Servidor reenvia a otros clientes (broadcast o room).

## 6) Resultado de este paso

Ya sabes que problema resuelve Socket.IO y los conceptos minimos para empezar a codificar.

En el proximo paso vamos a crear el proyecto y dejar instalado Express + Socket.IO.
