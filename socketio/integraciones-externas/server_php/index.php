<?php
// Configuracion basica del server PHP.
const API_KEY = 'php-key-demo-456';
const BRIDGE_URL = 'http://localhost:4100/publish';
const BRIDGE_API_KEY = 'bridge-key-demo-123';

// Habilita JSON de salida.
header('Content-Type: application/json; charset=utf-8');

// Permite solo POST para publicar mensajes.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Metodo no permitido']);
    exit;
}

// Valida API key entrante para proteger este server_php.
$incomingApiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($incomingApiKey !== API_KEY) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'API key invalida']);
    exit;
}

// Lee payload JSON recibido.
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON invalido']);
    exit;
}

// Normaliza payload con defaults.
$payload = [
    'room' => isset($data['room']) ? trim((string)$data['room']) : 'general',
    'usuario' => isset($data['usuario']) ? trim((string)$data['usuario']) : 'php-app',
    'texto' => isset($data['texto']) ? trim((string)$data['texto']) : ''
];

if ($payload['texto'] === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'texto requerido']);
    exit;
}

// Reenvia el mensaje al bridge Node que publica en Socket.IO.
$ch = curl_init(BRIDGE_URL);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'x-api-key: ' . BRIDGE_API_KEY,
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'Error al llamar bridge', 'detail' => $err]);
    exit;
}

http_response_code($status > 0 ? $status : 200);
echo $response;
