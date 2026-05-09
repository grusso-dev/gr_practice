# Paso 1: qué es WebSocket y cuándo usarlo

WebSocket es un protocolo que crea una conexión persistente entre cliente (navegador/app) y servidor.  
A diferencia de HTTP tradicional, no estás abriendo/cerrando una conexión por cada operación.

## Ejemplo mental rápido

- Con HTTP:  
  “¿Hay mensajes nuevos?” → petición  
  “¿Hay mensajes nuevos?” → otra petición  
  “¿Hay mensajes nuevos?” → otra petición  
  (esto suele hacerse con polling)

- Con WebSocket:  
  Se abre una vez la conexión y queda viva.  
  Cuando hay algo nuevo, el servidor lo empuja al cliente al instante.

## Cuándo conviene usar WebSocket

- chat en tiempo real
- notificaciones instantáneas
- dashboards/monitoreo en vivo
- colaboración en tiempo real (documentos, pizarras)
- juegos online

## Cuándo no hace falta

- CRUD normal (crear/listar/editar) sin necesidad de tiempo real
- páginas donde basta con actualizar manualmente o cada cierto tiempo
- APIs típicas REST sin eventos en vivo

## Idea clave

- REST/HTTP sigue siendo útil para operaciones normales.
- WebSocket lo agregas para la parte en tiempo real.
- En proyectos reales, muchas veces usas ambos juntos.
