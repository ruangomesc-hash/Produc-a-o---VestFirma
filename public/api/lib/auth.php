<?php
declare(strict_types=1);

function vestfirma_load_config(): array {
    $configFile = __DIR__ . '/config.php';
    if (!is_file($configFile)) {
        http_response_code(503);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'config.php ausente. Copie config.example.php']);
        exit;
    }
    /** @var array<string,mixed> $config */
    $config = require $configFile;
    return $config;
}

function vestfirma_cors(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, PUT, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Vary: Origin');
}

function vestfirma_read_bearer(): string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        return trim($m[1]);
    }
    return '';
}

function vestfirma_sessions_path(array $config): string {
    return $config['sessions_file'] ?? (__DIR__ . '/../data/sessions.json');
}

/** @return array<string,array{user:string,expires:int}> */
function vestfirma_sessions_load(string $path): array {
    if (!is_file($path)) {
        return [];
    }
    $raw = file_get_contents($path);
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** @param array<string,array{user:string,expires:int}> $sessions */
function vestfirma_sessions_save(string $path, array $sessions): void {
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0750, true)) {
        throw new RuntimeException('Não foi possível criar pasta de sessões');
    }
    $tmp = $path . '.tmp';
    $json = json_encode($sessions, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false) {
        throw new RuntimeException('Falha ao gravar sessões');
    }
    if (!rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException('Falha ao finalizar sessões');
    }
}

function vestfirma_purge_expired(array &$sessions): void {
    $now = time();
    foreach ($sessions as $token => $row) {
        if (($row['expires'] ?? 0) < $now) {
            unset($sessions[$token]);
        }
    }
}

function vestfirma_session_ttl_seconds(array $config): int {
    $days = (int) ($config['session_days'] ?? 14);
    if ($days < 1) {
        $days = 14;
    }
    return $days * 86400;
}

function vestfirma_verify_credentials(array $config, string $username, string $password): bool {
    $expectedUser = (string) ($config['admin_user'] ?? '');
    if ($expectedUser === '' || $username !== $expectedUser) {
        return false;
    }

    if (isset($config['admin_password_hash']) && is_string($config['admin_password_hash']) && $config['admin_password_hash'] !== '') {
        return password_verify($password, $config['admin_password_hash']);
    }

    $plain = (string) ($config['admin_password'] ?? '');
    return $plain !== '' && hash_equals($plain, $password);
}

function vestfirma_create_session(array $config): array {
    $path = vestfirma_sessions_path($config);
    $sessions = vestfirma_sessions_load($path);
    vestfirma_purge_expired($sessions);

    $token = bin2hex(random_bytes(32));
    $expires = time() + vestfirma_session_ttl_seconds($config);
    $user = (string) $config['admin_user'];
    $sessions[$token] = ['user' => $user, 'expires' => $expires];
    vestfirma_sessions_save($path, $sessions);

    return [
        'token' => $token,
        'expiresAt' => gmdate('c', $expires),
        'user' => $user,
    ];
}

function vestfirma_validate_session(array $config, string $token): ?array {
    if ($token === '') {
        return null;
    }
    $path = vestfirma_sessions_path($config);
    $sessions = vestfirma_sessions_load($path);
    vestfirma_purge_expired($sessions);
    vestfirma_sessions_save($path, $sessions);

    $row = $sessions[$token] ?? null;
    if (!is_array($row)) {
        return null;
    }
    if (($row['expires'] ?? 0) < time()) {
        unset($sessions[$token]);
        vestfirma_sessions_save($path, $sessions);
        return null;
    }
    return $row;
}

function vestfirma_revoke_session(array $config, string $token): void {
    if ($token === '') {
        return;
    }
    $path = vestfirma_sessions_path($config);
    $sessions = vestfirma_sessions_load($path);
    unset($sessions[$token]);
    vestfirma_sessions_save($path, $sessions);
}

function vestfirma_login_required(array $config): bool {
    return !empty($config['require_login']);
}

function vestfirma_require_session(array $config): array {
    $token = vestfirma_read_bearer();
    $row = vestfirma_validate_session($config, $token);
    if ($row === null) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Não autenticado']);
        exit;
    }
    return $row;
}
