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
   - Defina usuário e senha de acesso:

   ```php
   'admin_user' => 'vestfirma',
   'admin_password' => 'SUA-SENHA-FORTE',
   ```

   Opcional (mais seguro): use hash em vez de senha em texto:

   ```bash
   php -r "echo password_hash('SUA-SENHA', PASSWORD_DEFAULT);"
   ```

   No `config.php`:

   ```php
   'admin_password_hash' => '$2y$10$...',
   // remova ou deixe vazio admin_password
   ```

3. Crie a pasta **`data/`** com permissão de escrita (grava `board.json` e `sessions.json`).

4. No painel PHP, se o quadro for grande (muitas logos), aumente se necessário:
   - `upload_max_filesize` / `post_max_size` → **64M** ou mais

5. Acesse pelo HTTPS. A **tela de login** aparece antes do kanban. O mesmo usuário/senha vale em qualquer aparelho.

**Segurança:** HTTPS obrigatório; senha forte em `config.php` / `ADMIN_PASSWORD`. Quem não estiver logado **não lê nem grava** o quadro (API retorna 401).

---

## Login

- **Antes de publicar (Mac):** deixe `VITE_REQUIRE_LOGIN=false` no build e `REQUIRE_LOGIN=false` no Node (ou `require_login => false` no PHP). O kanban abre **sem tela de login**, mas continua salvando no servidor se a API estiver ativa.
- **Ao publicar:** no `.env` do build, `VITE_REQUIRE_LOGIN=true`; no servidor PHP `require_login => true` em `config.php`; no Node `REQUIRE_LOGIN=true`.
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
npm run build
```

Envie de novo os arquivos de **`dist/`** (mantenha `data/board.json` e `api/config.php` no servidor — **não apague**).

---

## O que não enviar / não commitar

- `node_modules/`, `src/` (opcional no FTP)
- `.env` com senha real
- `data/board.json` (dados de produção)
- `public/api/config.php` (só no servidor)
