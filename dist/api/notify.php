<?php
/**
 * Encaminha eventos do kanban para webhook (n8n / WhatsApp Business).
 * Configure whatsapp_webhook_url em config.php
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    $configPath = __DIR__ . '/config.example.php';
}
$config = require $configPath;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$payload = json_decode($raw, true);
if (!is_array($payload) || empty($payload['message']) || !is_string($payload['message'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Campo message obrigatório']);
    exit;
}

$webhook = trim((string) ($config['whatsapp_webhook_url'] ?? ''));
if ($webhook === '') {
    error_log('[vestfirma WhatsApp] ' . $payload['message']);
    echo json_encode(['ok' => true, 'mode' => 'log', 'delivered' => false]);
    exit;
}

$ch = curl_init($webhook);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => $raw,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
]);
$response = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$ok = $status >= 200 && $status < 300;
http_response_code($ok ? 200 : 502);
echo json_encode([
    'ok' => $ok,
    'delivered' => $ok,
    'upstreamStatus' => $status,
    'upstreamBody' => is_string($response) ? substr($response, 0, 500) : '',
]);
