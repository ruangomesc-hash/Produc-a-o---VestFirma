<?php
declare(strict_types=1);

const VESTFIRMA_ROLES = ['admin', 'gerente', 'expedicao', 'impressao', 'vendedor'];

function vestfirma_users_path(array $config): string {
    return $config['users_file'] ?? (__DIR__ . '/../data/users.json');
}

function vestfirma_random_password(int $length = 12): string {
    $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $max = strlen($chars) - 1;
    $out = '';
    for ($i = 0; $i < $length; $i++) {
        $out .= $chars[random_int(0, $max)];
    }
    return $out;
}

function vestfirma_normalize_email(string $email): string {
    return strtolower(trim($email));
}

function vestfirma_is_valid_login_email(string $email): bool {
    $norm = vestfirma_normalize_email($email);
    if ($norm === '' || strlen($norm) > 254) {
        return false;
    }
    $at = strpos($norm, '@');
    if ($at === false || $at < 1 || $at === strlen($norm) - 1) {
        return false;
    }
    $local = substr($norm, 0, $at);
    $domain = substr($norm, $at + 1);
    if (strlen($local) > 64 || strlen($domain) > 253) {
        return false;
    }
    if (preg_match('/\s/', $norm)) {
        return false;
    }
    if (
        str_starts_with($local, '.') ||
        str_ends_with($local, '.') ||
        str_starts_with($domain, '.') ||
        str_ends_with($domain, '.') ||
        str_contains($local, '..') ||
        str_contains($domain, '..')
    ) {
        return false;
    }
    if (!preg_match('/^[a-z0-9.!#$%&\'*+\/=?^_`{|}~-]+$/i', $local)) {
        return false;
    }
    if (!preg_match('/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i', $domain)) {
        return false;
    }
    return true;
}

/** @return array{users: list<array<string,mixed>>} */
function vestfirma_users_load_raw(string $path): array {
    if (!is_file($path)) {
        return ['users' => []];
    }
    $raw = file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return ['users' => []];
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || !isset($data['users']) || !is_array($data['users'])) {
        return ['users' => []];
    }
    return $data;
}

/** @param array{users: list<array<string,mixed>>} $data */
function vestfirma_users_save_raw(string $path, array $data): void {
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0750, true)) {
        throw new RuntimeException('Não foi possível criar pasta de usuários');
    }
    $tmp = $path . '.tmp';
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false) {
        throw new RuntimeException('Falha ao gravar usuários');
    }
    if (!rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException('Falha ao finalizar usuários');
    }
}

function vestfirma_users_ensure_seeded(array $config): void {
    $path = vestfirma_users_path($config);
    $data = vestfirma_users_load_raw($path);
    if (count($data['users']) > 0) {
        return;
    }

    $email = vestfirma_normalize_email((string) ($config['seed_admin_email'] ?? 'ruan.gomesc@gmail.com'));
    $name = trim((string) ($config['seed_admin_name'] ?? 'Administrador'));
    $password = (string) ($config['seed_admin_password'] ?? '');
    if ($password === '') {
        $password = vestfirma_random_password(12);
    }

    $legacyUser = trim((string) ($config['admin_user'] ?? ''));
    $legacyPass = (string) ($config['admin_password'] ?? '');
    if ($legacyUser !== '' && str_contains($legacyUser, '@')) {
        $email = vestfirma_normalize_email($legacyUser);
    } elseif ($legacyUser !== '' && $email === '') {
        $email = vestfirma_normalize_email($legacyUser . '@vestfirma.local');
    }
    if ($legacyPass !== '' && !isset($config['seed_admin_password'])) {
        $password = $legacyPass;
    }

    $data['users'][] = [
        'id' => bin2hex(random_bytes(8)),
        'email' => $email,
        'name' => $name !== '' ? $name : 'Administrador',
        'role' => 'admin',
        'password' => $password,
        'createdAt' => gmdate('c'),
    ];
    vestfirma_users_save_raw($path, $data);
}

/** @return list<array<string,mixed>> */
function vestfirma_users_list(array $config): array {
    vestfirma_users_ensure_seeded($config);
    $data = vestfirma_users_load_raw(vestfirma_users_path($config));
    return $data['users'];
}

function vestfirma_user_find_by_email(array $config, string $email): ?array {
    $email = vestfirma_normalize_email($email);
    foreach (vestfirma_users_list($config) as $user) {
        if (vestfirma_normalize_email((string) ($user['email'] ?? '')) === $email) {
            return $user;
        }
    }
    return null;
}

function vestfirma_user_find_by_id(array $config, string $id): ?array {
    foreach (vestfirma_users_list($config) as $user) {
        if (($user['id'] ?? '') === $id) {
            return $user;
        }
    }
    return null;
}

function vestfirma_verify_user_password(array $user, string $password): bool {
    $stored = (string) ($user['password'] ?? '');
    return $stored !== '' && hash_equals($stored, $password);
}

function vestfirma_role_valid(string $role): bool {
    return in_array($role, VESTFIRMA_ROLES, true);
}

/** @return array<string,mixed> */
function vestfirma_user_public(array $user, bool $includePassword): array {
    $row = [
        'id' => (string) ($user['id'] ?? ''),
        'email' => (string) ($user['email'] ?? ''),
        'name' => (string) ($user['name'] ?? ''),
        'role' => (string) ($user['role'] ?? ''),
        'createdAt' => (string) ($user['createdAt'] ?? ''),
    ];
    if ($includePassword) {
        $row['password'] = (string) ($user['password'] ?? '');
    }
    return $row;
}

/** @return array<string,mixed> */
function vestfirma_users_create(array $config, string $email, string $role, string $name): array {
    if (!vestfirma_role_valid($role)) {
        throw new InvalidArgumentException('Perfil inválido');
    }
    if ($role === 'admin') {
        throw new InvalidArgumentException('Use apenas um administrador geral');
    }
    $email = vestfirma_normalize_email($email);
    if ($email === '' || !vestfirma_is_valid_login_email($email)) {
        throw new InvalidArgumentException('E-mail inválido');
    }
    if (vestfirma_user_find_by_email($config, $email) !== null) {
        throw new InvalidArgumentException('Este e-mail já está cadastrado');
    }

    $path = vestfirma_users_path($config);
    $data = vestfirma_users_load_raw($path);
    $user = [
        'id' => bin2hex(random_bytes(8)),
        'email' => $email,
        'name' => trim($name) !== '' ? trim($name) : $email,
        'role' => $role,
        'password' => vestfirma_random_password(12),
        'createdAt' => gmdate('c'),
    ];
    $data['users'][] = $user;
    vestfirma_users_save_raw($path, $data);
    return $user;
}

/** @return array<string,mixed> */
function vestfirma_users_update(
    array $config,
    string $id,
    ?string $email,
    ?string $role,
    ?string $name,
    bool $regeneratePassword,
): array {
    $path = vestfirma_users_path($config);
    $data = vestfirma_users_load_raw($path);
    $found = false;
    foreach ($data['users'] as &$user) {
        if (($user['id'] ?? '') !== $id) {
            continue;
        }
        $found = true;
        if ($email !== null) {
            $emailNorm = vestfirma_normalize_email($email);
            if ($emailNorm === '' || !vestfirma_is_valid_login_email($emailNorm)) {
                throw new InvalidArgumentException('E-mail inválido');
            }
            $other = vestfirma_user_find_by_email($config, $emailNorm);
            if ($other !== null && ($other['id'] ?? '') !== $id) {
                throw new InvalidArgumentException('Este e-mail já está cadastrado');
            }
            $user['email'] = $emailNorm;
        }
        if ($role !== null) {
            if (!vestfirma_role_valid($role)) {
                throw new InvalidArgumentException('Perfil inválido');
            }
            if (($user['role'] ?? '') === 'admin' && $role !== 'admin') {
                throw new InvalidArgumentException('Não é possível alterar o perfil do administrador geral');
            }
            if ($role === 'admin') {
                throw new InvalidArgumentException('Só existe um administrador geral');
            }
            $user['role'] = $role;
        }
        if ($name !== null && trim($name) !== '') {
            $user['name'] = trim($name);
        }
        if ($regeneratePassword) {
            $user['password'] = vestfirma_random_password(12);
        }
        vestfirma_users_save_raw($path, $data);
        return $user;
    }
    if (!$found) {
        throw new InvalidArgumentException('Usuário não encontrado');
    }
    throw new RuntimeException('Falha ao atualizar');
}

function vestfirma_users_delete(array $config, string $id, string $currentUserId, string $actorRole = ''): void {
    if ($actorRole !== '' && $actorRole !== 'admin') {
        throw new InvalidArgumentException('Apenas o administrador pode excluir usuários');
    }
    $path = vestfirma_users_path($config);
    $data = vestfirma_users_load_raw($path);
    $next = [];
    $deleted = false;
    foreach ($data['users'] as $user) {
        if (($user['id'] ?? '') === $id) {
            if (($user['role'] ?? '') === 'admin') {
                throw new InvalidArgumentException('Não é possível excluir o administrador geral');
            }
            if ($id === $currentUserId) {
                throw new InvalidArgumentException('Você não pode excluir a si mesmo');
            }
            $deleted = true;
            continue;
        }
        $next[] = $user;
    }
    if (!$deleted) {
        throw new InvalidArgumentException('Usuário não encontrado');
    }
    $data['users'] = $next;
    vestfirma_users_save_raw($path, $data);
}

function vestfirma_require_admin_session(array $config): array {
    $row = vestfirma_require_session($config);
    if (($row['role'] ?? '') !== 'admin') {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Acesso restrito ao administrador']);
        exit;
    }
    return $row;
}
