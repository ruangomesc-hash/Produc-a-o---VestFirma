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

$body = file_get_contents('php://input');
$data = json_decode($body ?: '', true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'JSON inválido']);
    exit;
}

$username = trim((string) ($data['username'] ?? ''));
$password = (string) ($data['password'] ?? '');

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Usuário e senha são obrigatórios']);
    exit;
}

if (!vestfirma_verify_credentials($config, $username, $password)) {
    http_response_code(401);
    echo json_encode([
        'ok' => false,
        'code' => 'AUTH_INVALID',
        'error' => 'E-mail ou senha incorretos.',
        'fix' => 'Confira users.json no servidor ou seed_admin_password em config.php.',
    ]);
    exit;
}

try {
    echo json_encode(vestfirma_create_session($config, $username));
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Falha ao iniciar sessão']);
}
