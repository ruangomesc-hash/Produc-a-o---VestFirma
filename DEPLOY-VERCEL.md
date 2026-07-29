# VestFirma na Vercel — login

## ⚠️ Root Directory

No projeto Vercel, **Root Directory deve ser a raiz do repo** (`.`).  
Se estiver `dist`, as funções em `/api` **não sobem** e o login nunca funciona.

## Teste rápido (sem login)

1. `https://SEU-APP.vercel.app/api/ping` → `"ok": true`
2. `https://SEU-APP.vercel.app/api/health.php` → `"requireLogin": true`, `"sessionMode": "jwt"`

Se `/api/ping` der 404, o deploy não inclui a pasta `api/` — corrija o Root Directory e redeploy.

## Variáveis (Settings → Environment Variables)

| Nome | Valor |
|------|--------|
| `REQUIRE_LOGIN` | `true` |
| `SEED_ADMIN_EMAIL` | `ruan.gomesc@gmail.com` |
| `SEED_ADMIN_PASSWORD` | `@Vestfirma26!` |

Use **Production**. Depois: **Redeploy** (obrigatório).

> Senha com `@` e `!` — cole exatamente no painel Vercel (sem aspas extras).

**Blob** é opcional para **login** (sessão JWT + senha no env). Blob (ou equivalente) ainda é recomendado para **quadro** e **lista de usuários** persistirem.

## Entrar

- E-mail: `ruan.gomesc@gmail.com`
- Senha: `@Vestfirma26!`

## Ainda falha?

1. Abra `/api/ping` e `/api/health.php` e confira o JSON.
2. Redeploy após mudar variáveis.
3. Aba anônima (cache do JS antigo).
4. Se no Blob existir `vestfirma/users.json` com senha velha, apague o arquivo — o login do admin usa **`SEED_ADMIN_PASSWORD`** do env (prioridade).
