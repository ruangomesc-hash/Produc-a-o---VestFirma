<?php
/**
 * Renomeie/copie para config.php no servidor (não commitar senhas reais).
 *
 * Hash opcional (no Mac): php -r "echo password_hash('SUA_SENHA', PASSWORD_DEFAULT);"
 */
return [
    'admin_user' => 'vestfirma',
    'admin_password' => 'TROQUE-ESTA-SENHA',
    // 'admin_password_hash' => '$2y$10$...',
    /** false = local / antes de publicar; true = exige login no site */
    'require_login' => true,
    'session_days' => 14,
    'data_file' => __DIR__ . '/../data/board.json',
    'sessions_file' => __DIR__ . '/../data/sessions.json',
    'users_file' => __DIR__ . '/../data/users.json',
    'seed_admin_email' => 'ruan.gomesc@gmail.com',
    'seed_admin_name' => 'Administrador',
    /** Defina antes do 1º login se data/users.json ainda não existir: */
    'seed_admin_password' => 'ESCOLHA-UMA-SENHA-FORTE-AQUI',
    /** URL do n8n / WhatsApp Business — recebe POST JSON do kanban */
    'whatsapp_webhook_url' => '',
];
