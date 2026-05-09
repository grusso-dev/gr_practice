# Ruta de aprendizaje: WebSocket en Node.js con Express

Este documento es nuestra guia para aprender WebSocket desde cero, paso a paso, con foco en entender bien la base antes de avanzar a temas mas complejos.

## 1) Entender que es WebSocket y cuando usarlo

En este paso veremos la diferencia entre HTTP tradicional y WebSocket:

- **HTTP**: el cliente pide, el servidor responde y se cierra la comunicacion.
- **WebSocket**: se abre una conexion persistente y ambos (cliente y servidor) pueden enviarse mensajes en cualquier momento.

Objetivo: entender por que WebSocket es ideal para chat, notificaciones en vivo, dashboards en tiempo real y juegos multijugador.

## 2) Preparar proyecto base con Express

Crearemos un proyecto Node.js desde cero e instalaremos Express para levantar un servidor HTTP sencillo.

Objetivo: tener una base estable sobre la que luego montaremos WebSocket.

## 3) Integrar WebSocket en el mismo servidor

Agregaremos la libreria `ws` y la conectaremos al servidor HTTP de Express.

Objetivo: aprender la arquitectura correcta para que Express y WebSocket compartan el mismo puerto y proceso.

## 4) Crear un cliente web minimo

Haremos una pagina HTML simple que:

- abra la conexion WebSocket,
- envie mensajes al servidor,
- y muestre en pantalla los mensajes recibidos.

Objetivo: ver el flujo completo cliente-servidor en funcionamiento real.

## 5) Manejar eventos fundamentales

Trabajaremos con los eventos principales:

- `open`: conexion establecida,
- `message`: recepcion de datos,
- `close`: conexion cerrada,
- `error`: fallos de comunicacion.

Objetivo: aprender el ciclo de vida de una conexion WebSocket y reaccionar correctamente en cada etapa.

## 6) Implementar broadcast a multiples clientes

Modificaremos el servidor para reenviar mensajes a todos los clientes conectados.

Objetivo: construir la base de un chat grupal o sistema de actualizaciones globales.

## 7) Estructurar mensajes en formato JSON

Pasaremos de texto plano a mensajes con estructura, por ejemplo:

```json
{
  "type": "chat_message",
  "payload": {
    "user": "gabriel",
    "text": "hola"
  }
}
```

Objetivo: enviar datos robustos, faciles de validar y escalables para nuevas funcionalidades.

## 8) Validacion y seguridad basica

Aplicaremos practicas iniciales para evitar errores y abusos:

- validar que el JSON sea correcto,
- limitar tamano de mensajes,
- no confiar en datos del cliente,
- cerrar conexiones invalidas.

Objetivo: mejorar la estabilidad y seguridad desde el inicio.

## 9) Reconexion y experiencia de usuario

En el cliente implementaremos reconexion automatica simple cuando se caiga la conexion.

Objetivo: que la app sea mas resistente a cortes de red y mas usable en escenarios reales.

## 10) Heartbeat (ping/pong) y limpieza de conexiones

Agregaremos una verificacion periodica para detectar clientes desconectados silenciosamente y liberar recursos.

Objetivo: mantener sano el servidor cuando hay muchas conexiones o redes inestables.

## 11) Siguiente nivel: autenticacion y rooms

Cuando dominemos la base, veremos:

- autenticacion (por ejemplo con JWT),
- canales o rooms por tema/sala,
- separacion de eventos por tipo.

Objetivo: pasar de una demo a una arquitectura de aplicacion real.

## 12) Comparar `ws` vs `socket.io`

Cerraremos con criterios de decision:

- cuando usar `ws` (control y simplicidad del protocolo),
- cuando usar `socket.io` (features listas como reconexion avanzada, rooms, fallback, etc.).

Objetivo: que puedas elegir la herramienta adecuada segun el proyecto.

---

## Como vamos a trabajar

- Avanzamos un paso por vez.
- En cada paso: explicacion breve, codigo practico y prueba local.
- No avanzamos al siguiente hasta que lo tengas claro.

Con esta ruta, al final no solo vas a "hacer que funcione", sino entender por que funciona y como escalarlo.
