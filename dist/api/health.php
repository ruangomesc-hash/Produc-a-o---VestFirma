<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    $configPath = __DIR__ . '/config.example.php';
}
$config = require $configPath;

echo json_encode([
    'ok' => true,
    'service' => 'vestfirma-kanban',
    'requireLogin' => !empty($config['require_login']),
    'whatsappWebhookConfigured' => !empty(trim((string) ($config['whatsapp_webhook_url'] ?? ''))),
    'boardDataConfigured' => !empty($config['data_file']),
    'timestamp' => gmdate('c'),
]);
