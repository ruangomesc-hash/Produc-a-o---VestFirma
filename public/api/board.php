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
$dataFile = $config['data_file'] ?? (__DIR__ . '/../data/board.json');

if (vestfirma_login_required($config)) {
    vestfirma_require_session($config);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (!is_file($dataFile)) {
        echo 'null';
        exit;
    }
    readfile($dataFile);
    exit;
}

if ($method === 'PUT' || $method === 'POST') {
    $body = file_get_contents('php://input');
    if ($body === false || $body === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Corpo vazio']);
        exit;
    }

    json_decode($body);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON inválido']);
        exit;
    }

    $decoded = json_decode($body, true);
    if (is_array($decoded) && (($decoded['action'] ?? '') === 'vestfirma-card-patch')) {
        http_response_code(501);
        echo json_encode(['ok' => false, 'error' => 'Atualize o servidor Node para gravar comentário e logos.']);
        exit;
    }
    if (is_array($decoded) && empty($decoded['cards']) && is_file($dataFile)) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'code' => 'BOARD_WIPE_BLOCKED', 'error' => 'Recusado: salvar quadro vazio apagaria pedidos.']);
        exit;
    }

    $dir = dirname($dataFile);
    if (!is_dir($dir) && !mkdir($dir, 0750, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Não foi possível criar pasta de dados']);
        exit;
    }

    $tmp = $dataFile . '.tmp';
    if (file_put_contents($tmp, $body, LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Falha ao gravar']);
        exit;
    }
    if (!rename($tmp, $dataFile)) {
        @unlink($tmp);
        http_response_code(500);
        echo json_encode(['error' => 'Falha ao finalizar gravação']);
        exit;
    }

    echo json_encode(['ok' => true, 'savedAt' => gmdate('c')]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
