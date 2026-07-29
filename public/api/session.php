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

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $token = vestfirma_read_bearer();
    $row = vestfirma_validate_session($config, $token);
    if ($row === null) {
        http_response_code(401);
        echo json_encode(['ok' => false]);
        exit;
    }
    echo json_encode(['ok' => true, 'user' => $row['user']]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
