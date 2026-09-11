# VestFirma na Render (1000+ pedidos)

## Deploy rápido (Blueprint)

O repositório inclui **`render.yaml`** na raiz. Passo a passo curto: **[RENDER-QUICKSTART.md](./RENDER-QUICKSTART.md)**.

Resumo: Render → **New → Blueprint** → conecte o Git → informe **`SEED_ADMIN_PASSWORD`** no primeiro deploy.

---

Para **mais de ~100–200 pedidos com logos**, a Vercel não é adequada: o quadro inteiro ia num único JSON com limite de **~4,5 MB** por salvamento.

Na **Render** você roda o **servidor Node** do projeto (`server/server.mjs`), que:

- Aceita salvamentos bem maiores (**80 MB** por padrão, ajustável com `MAX_BODY_MB`).
- Grava **`data/board.json`** + **`data/users.json`** no disco.
- **Separa logos em arquivos** (`data/logos/`) no save — o JSON fica leve (~**2–5 KB por pedido**), suficiente para **1000+ pedidos em andamento**.

---

## 1. Criar o Web Service na Render

1. [render.com](https://render.com) → **New** → **Web Service** → conecte o repositório Git.
2. **Root Directory:** raiz do repo (`.`).
3. **Runtime:** Node.
4. **Build Command:**

   ```bash
   npm ci --include=dev && npm run build:render
   ```

   O `--include=dev` instala Vite, TypeScript e os tipos necessários ao build,
   mesmo quando `NODE_ENV=production`. Sem isso, o build falha com `TS2688`.

5. **Start Command:**

   ```bash
   node server/server.mjs
   ```

6. **Instance type:** pelo menos **512 MB RAM** (Starter). Para muitos acessos simultâneos, 1 GB+.

7. **Disk (importante):** em **Disks**, anexe um **Persistent Disk** (ex. 5 GB) e monte em **`/opt/render/project/src/data`** (igual ao `render.yaml`).

   > Se montar em `/var/data`, o servidor ainda tenta usar essa pasta — mas o Blueprint oficial usa `/opt/render/project/src/data`.

---

## 2. Variáveis de ambiente (Render → Environment)

| Variável | Valor |
|----------|--------|
| `NODE_VERSION` | `20` (ou 22) |
| `REQUIRE_LOGIN` | `true` |
| `SEED_ADMIN_EMAIL` | `ruan.gomesc@gmail.com` |
| `SEED_ADMIN_PASSWORD` | `@Vestfirma26!` |
| `SEED_ADMIN_NAME` | `Administrador` |
| `SESSION_DAYS` | `14` |
| `HOST` | `0.0.0.0` (opcional — o servidor já usa `0.0.0.0` quando `PORT` existe) |
| `BOARD_DATA_FILE` | `/var/data/board.json` |
| `BOARD_LOGO_DIR` | `/var/data/logos` |
| `MAX_BODY_MB` | `80` (ou `120` se tiver muitas logos ainda inline na migração) |
| `EXTERNALIZE_BOARD_LOGOS` | `1` (padrão; use `0` só para debug) |

**Build-time** (para o React apontar para a mesma origem):

Configure no build ou use `public/vestfirma-config.json` no repo para produção Render:

```json
{
  "requireLogin": true,
  "apiBase": "/api",
  "version": "render"
}
```

E `.env.production` (ou env do build na Render):

```env
VITE_REQUIRE_LOGIN=true
VITE_API_BASE=/api
VITE_API_BOARD_PATH=/board
```

---

## 3. Testes após deploy

1. `https://SEU-SERVICO.onrender.com/api/health`  
   - `"storage": "filesystem"`  
   - `"logosExternal": true`  
   - `"maxSaveBodyMb": 80`

2. Login admin → **Usuários** (cadastro sem Blob).

3. Crie pedidos com logo → salve → abra de novo: imagens vêm de `/api/logos/...`.

4. Aba **Status** → medidor de espaço: com logos externalizadas, **1000 pedidos** ficam na ordem de **~3–8 MB** de JSON (não 100+ MB).

---

## 4. Migrar da Vercel

1. Exporte o quadro atual (se ainda salva localmente no navegador, use o painel; ou baixe `board.json` do Blob se tiver acesso).
2. Suba o serviço na Render com disco persistente.
3. Faça login no site Render e use o quadro — primeiro **PUT** grava logos em arquivos.
4. Aponte o domínio (`producao.vestfirma…`) para a Render **ou** use só a URL `.onrender.com`.
5. Desative ou deixe a Vercel como backup estático (sem API).

---

## 5. Limites realistas

| Cenário | Vercel (atual) | Render + Node (este guia) |
|---------|----------------|---------------------------|
| Pedidos só texto | ~2000 no JSON | **10k+** |
| Pedidos com logos no JSON | ~20–80 | migração automática para arquivos |
| Pedidos com logos em `/api/logos` | — | **1000+ em andamento** (JSON ~MB; logos no disco) |
| Usuários / vendedores | exige Blob | **`data/users.json`** no disco |

Disco: **1 GB** aguenta milhares de logos JPEG comprimidas; o gargalo deixa de ser “tamanho do save” e passa a ser RAM/CPU do plano Render.

---

## 6. Comandos locais (igual produção)

```bash
cp .env.example .env
# REQUIRE_LOGIN=true, SEED_ADMIN_*, etc.

npm run build
REQUIRE_LOGIN=true node --env-file=.env server/server.mjs
```

Abra `http://127.0.0.1:4199` — logos vão para `data/logos/`.

---

## Hostinger PHP

Também suporta disco e limites maiores que a Vercel serverless; ver `DEPLOY.md`. Para **1000+ logos**, o ideal é o **Node na Render** com externalização (já implementada) ou evoluir o PHP com a mesma lógica de pastas.
