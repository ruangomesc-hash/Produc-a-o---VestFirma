<?php
declare(strict_types=1);

require __DIR__ . '/lib/auth.php';

header('Content-Type: application/json; charset=utf-8');
vestfirma_cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$config = vestfirma_load_config();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$token = vestfirma_read_bearer();
try {
    vestfirma_revoke_session($config, $token);
    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Falha ao encerrar sessão']);
}
