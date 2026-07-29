# Publicar o Kanban VestFirma (com dados compartilhados)

O quadro (pedidos, logos, colunas) pode ficar **um único arquivo no servidor**, acessível de **qualquer lugar** (celular, outro PC, escritório).

Há duas formas de hospedar a API:

| Onde | Recomendado para |
|------|------------------|
| **PHP** (`api/board.php`) | Hostinger, cPanel, hospedagem compartilhada |
| **Node** (`npm run server`) | VPS, Mac sempre ligado, teste local “igual produção” |

---

## 1. Configurar o build (Mac)

1. Copie o exemplo de ambiente:

   ```bash
   cp .env.example .env
   ```

2. Edite `.env` **antes** do build (só caminhos da API — **senha fica no servidor**, não no React):

   ```env
   VITE_BASE_PATH=/
   VITE_API_BASE=/api
   VITE_API_BOARD_PATH=/board.php
   ```
     - `VITE_BASE_PATH=/kanban/`
     - `VITE_API_BASE=/kanban/api`

3. Gere o site:

   ```bash
   npm install
   npm run build
   ```

4. A pasta **`dist/`** terá:
   - `index.html`, `assets/` (React)
   - `api/board.php`, `api/config.example.php`
   - `data/.htaccess` (protege a pasta de dados no Apache)

---

## 2. Hostinger / Apache (PHP)

1. Envie **todo o conteúdo de `dist/`** para `public_html/` ou subpasta (ex. `public_html/kanban/`).

2. Na pasta **`api/`** do servidor:
   - Copie `config.example.php` → **`config.php`**
   - Ative login e multiusuário (ajuste senhas no servidor, não no React):

   ```php
   'require_login' => true,
   'seed_admin_email' => 'ruan.gomesc@gmail.com',
   'seed_admin_name' => 'Administrador',
   // opcional na 1ª vez: 'seed_admin_password' => 'senha-inicial',
   'users_file' => __DIR__ . '/../data/users.json',
   'sessions_file' => __DIR__ . '/../data/sessions.json',
   ```

   Campos legados (`admin_user` / `admin_password`) ainda funcionam na migração; o admin principal passa a ser o e-mail em `users.json`.

3. Crie a pasta **`data/`** com permissão de escrita (grava `board.json`, `sessions.json` e **`users.json`**).

4. **Envie estes arquivos da API** (além do que já tinha). Se faltar algum, login/admin não funciona no ar:
   - `api/login.php`, `api/logout.php`, `api/session.php`
   - **`api/users.php`**
   - `api/lib/auth.php`, **`api/lib/users.php`**
   - `assets/index-*.js` e `assets/index-*.css` **novos** (build com login ligado)

5. No Mac, **antes de enviar o `dist/`**:

   ```bash
   npm run build:publicar
   ```

   Isso usa `.env.production` (`VITE_REQUIRE_LOGIN=true`). Build só com `.env` e `false` **não mostra** tela de login nem botão **Usuários** — mesmo com PHP certo.

6. No painel PHP, se o quadro for grande (muitas logos), aumente se necessário:
   - `upload_max_filesize` / `post_max_size` → **64M** ou mais

5. Acesse pelo HTTPS. A **tela de login (e-mail + senha)** aparece antes do kanban. Admin geral: botão **Usuários** no header para criar Gerente, Expedição, Impressão, Vendedor e copiar senhas.

**Segurança:** HTTPS obrigatório; `data/users.json` contém senhas em texto (para você copiar e enviar) — proteja a pasta `data/`. Quem não estiver logado **não lê nem grava** o quadro (API retorna 401).

---

## Login e perfis (admin)

| Onde | O que ligar |
|------|-------------|
| Build (`npm run build:publicar`) | `VITE_REQUIRE_LOGIN=true` em `.env.production` |
| PHP `config.php` | `'require_login' => true` + `users_file` / `seed_admin_email` |
| Node | `REQUIRE_LOGIN=true` + `SEED_ADMIN_EMAIL=ruan.gomesc@gmail.com` |

**Primeiro acesso admin:** se `data/users.json` ainda não existir, o servidor cria `ruan.gomesc@gmail.com` com senha aleatória ou a de `seed_admin_password` / `admin_password` legado. Veja a senha em **Usuários** (logado como admin) ou no arquivo `users.json` no servidor.

**Atualizar só o front:** reenvie `index.html`, `assets/*` e confira se `api/users.php` e `api/lib/users.php` já estão no FTP.

---

## Login (resumo)

- **Antes de publicar (Mac):** deixe `VITE_REQUIRE_LOGIN=false` no build e `REQUIRE_LOGIN=false` no Node (ou `require_login => false` no PHP). O kanban abre **sem tela de login**, mas continua salvando no servidor se a API estiver ativa.
- **Ao publicar:** `npm run build:publicar` (ou `.env.production` com `VITE_REQUIRE_LOGIN=true`); no servidor PHP `require_login => true` em `config.php`; no Node `REQUIRE_LOGIN=true`.
- **Sem `VITE_API_BASE`:** só dados no navegador — login desligado.
- Sessão: **14 dias** (`session_days` / `SESSION_DAYS`). Botão **Sair** quando login estiver ativo.

---

## 3. Servidor Node (VPS ou Mac)

No `.env` do servidor:

```env
ADMIN_USER=vestfirma
ADMIN_PASSWORD=mesma-senha-forte
SESSION_DAYS=14
PORT=4199
```

```bash
npm install
npm run build
npm run server
```

- Site + API: `http://IP:4199`
- Dados: arquivo `data/board.json` na pasta do projeto
- Para build com API em `/api/board` (sem `.php`), use no `.env`:
  - `VITE_API_BOARD_PATH=/board`

Coloque um proxy (Nginx/Caddy) com HTTPS na frente em produção.

---

## 4. Desenvolvimento no Mac

Terminal 1 — API:

```bash
npm run server:api
```

Terminal 2 — interface com hot reload:

```bash
npm run dev
```

O `.env.development` já aponta `VITE_API_BASE=/api` e o Vite faz proxy para a porta **8787**.

**Atalho “produção local”:** `Iniciar Kanban.command` → build + `npm run server` na porta **4199** (site + API + arquivo `data/board.json`).

---

## 5. Como funciona o salvamento

- Cada alteração (pedido, logo, arrastar card) grava:
  1. **Cópia no navegador** (IndexedDB) — cache offline neste aparelho
  2. **Arquivo no servidor** — fonte compartilhada entre todos
- Logos continuam **comprimidas** (até 1200 px, JPEG) antes de ir para o JSON.
- Se o servidor falhar, aparece **“Erro ao salvar”**; a cópia local no navegador ainda existe neste aparelho.
- **Modo demo** substitui tudo (pede confirmação) — evite em produção.

---

## 6. Migrar do navegador para o servidor

Na **primeira** vez que abrir o site **já configurado** com API:

- Se o servidor estiver vazio e este navegador tiver pedidos antigos, o app **envia automaticamente** essa cópia para o servidor.

---

## 7. Atualizar o site

```bash
npm run build:publicar
```

Envie de novo os arquivos de **`dist/`** (mantenha `data/board.json`, `data/users.json` e `api/config.php` no servidor — **não apague**).

---

## O que não enviar / não commitar

- `node_modules/`, `src/` (opcional no FTP)
- `.env` com senha real
- `data/board.json` (dados de produção)
- `public/api/config.php` (só no servidor)
