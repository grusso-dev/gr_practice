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
