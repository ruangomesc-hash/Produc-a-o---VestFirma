<?php
declare(strict_types=1);

require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/users.php';

header('Content-Type: application/json; charset=utf-8');
vestfirma_cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$config = vestfirma_load_config();

if (!vestfirma_login_required($config)) {
    http_response_code(503);
    echo json_encode(['error' => 'Login desligado no servidor (require_login)']);
    exit;
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $session = vestfirma_require_admin_session($config);
        unset($session);
        $users = vestfirma_users_list($config);
        $out = array_map(static fn ($u) => vestfirma_user_public($u, true), $users);
        echo json_encode(['users' => $out]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        vestfirma_require_admin_session($config);
        $body = file_get_contents('php://input');
        $data = json_decode($body ?: '', true);
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['error' => 'JSON inválido']);
            exit;
        }
        $email = (string) ($data['email'] ?? '');
        $role = (string) ($data['role'] ?? '');
        $name = (string) ($data['name'] ?? '');
        $user = vestfirma_users_create($config, $email, $role, $name);
        echo json_encode(['user' => vestfirma_user_public($user, true)]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $session = vestfirma_require_admin_session($config);
        $body = file_get_contents('php://input');
        $data = json_decode($body ?: '', true);
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['error' => 'JSON inválido']);
            exit;
        }
        $id = (string) ($data['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id obrigatório']);
            exit;
        }
        $email = array_key_exists('email', $data) ? (string) $data['email'] : null;
        $role = array_key_exists('role', $data) ? (string) $data['role'] : null;
        $name = array_key_exists('name', $data) ? (string) $data['name'] : null;
        $regen = !empty($data['regeneratePassword']);
        $user = vestfirma_users_update($config, $id, $email, $role, $name, $regen);
        echo json_encode(['user' => vestfirma_user_public($user, true)]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $session = vestfirma_require_admin_session($config);
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id obrigatório']);
            exit;
        }
        vestfirma_users_delete($config, $id, (string) ($session['userId'] ?? ''));
        echo json_encode(['ok' => true]);
        exit;
    }
} catch (InvalidArgumentException $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Falha ao processar usuários']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
