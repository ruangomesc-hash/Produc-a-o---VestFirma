# VestFirma só na Vercel

Na Vercel **não roda PHP** (`login.php` etc.). O site estático vem de `dist/` e a API fica em **`/api/*`** (Serverless + **Vercel Blob**).

## 1. No painel Vercel do projeto

1. **Storage → Blob** — crie um store (liga `BLOB_READ_WRITE_TOKEN` automaticamente).
2. **Settings → Environment Variables** (Production):

   | Variável | Valor |
   |----------|--------|
   | `REQUIRE_LOGIN` | `true` |
   | `SEED_ADMIN_EMAIL` | `ruan.gomesc@gmail.com` |
   | `SEED_ADMIN_PASSWORD` | `@Vestfirma26!` |
   | `SEED_ADMIN_NAME` | `Administrador` |

3. **Deploy** — build `npm run build:publicar`, output `dist` (`vercel.json`).

## 2. Conferir API

`https://SEU-PROJETO.vercel.app/api/health.php` → `"requireLogin": true`, `"storage": "vercel-blob"`.

## 3. Login admin

- **E-mail:** `ruan.gomesc@gmail.com`
- **Senha:** `@Vestfirma26!`

## 4. Senha não entra

1. Variáveis na Vercel + **Redeploy**.
2. No Blob, apague `vestfirma/users.json` se tiver senha antiga; login recria com `SEED_ADMIN_PASSWORD`.
