<?php
/**
 * Cole estas linhas no config.php do servidor (mantenha o resto que já existe).
 * Sem require_login => true a API do quadro fica aberta mesmo com login no site.
 */
return [
    // ... suas chaves existentes (data_file, etc.)

    'require_login' => true,

    'seed_admin_email' => 'ruan.gomesc@gmail.com',
    'seed_admin_name' => 'Administrador',
    'seed_admin_password' => '@Vestfirma26!',

    'users_file' => __DIR__ . '/../data/users.json',
    'sessions_file' => __DIR__ . '/../data/sessions.json',
];
