# Deploy na Render (Blueprint)

Guia completo: [DEPLOY-RENDER.md](./DEPLOY-RENDER.md)

## Deploy em ~5 minutos

1. **Git** — suba este projeto para GitHub ou GitLab (branch `main` ou ajuste `render.yaml`).

2. **Render** — [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.

3. Conecte o repositório e confirme o **`render.yaml`** na raiz.

4. Quando pedir variáveis com cadeado:
   - **`SEED_ADMIN_PASSWORD`** → `@Vestfirma26!` (ou a senha que você usar)
   - **`WHATSAPP_WEBHOOK_URL`** → deixe vazio ou cole depois (opcional)

5. Aguarde **Build** + **Deploy** (primeiro build ~2–4 min).

6. **Teste**
   - `https://SEU-SERVICO.onrender.com/api/health`  
     → `"storage": "filesystem"`, `"logosExternal": true`
   - Login: `ruan.gomesc@gmail.com` + senha definida no passo 4
   - **Usuários** → cadastrar vendedores (sem Blob)
   - **Status** → medidor de espaço do quadro

## Disco persistente (memória — pedidos e usuários não somem)

O Blueprint **`render.yaml`** já cria disco de **5 GB** montado em:

**`/opt/render/project/src/data`**

Lá ficam `board.json`, `users.json`, `logos/` e backups.

### Confira no painel Render

1. Serviço **vestfirma-producao** → aba **Disks**
2. Deve existir disco **vestfirma-data** em `/opt/render/project/src/data`
3. Plano **Starter** (disco persistente **não funciona** no Free)

### Variáveis que NÃO devem existir (ou apagam a memória)

Remova do **Environment** se você tiver colocado manualmente:

- `BOARD_DATA_DIR=/var/data` (caminho antigo da doc — conflita com o Blueprint)
- `BOARD_DATA_FILE`, `BOARD_LOGO_DIR` apontando para `/var/data`

O código escolhe sozinho a pasta certa. O `render-start.mjs` aponta para `/opt/render/project/src/data`.

### Teste depois do deploy

Abra `https://SEU-SERVICO.onrender.com/api/health` e confira:

| Campo | Valor esperado |
|--------|----------------|
| `storage` | `"filesystem"` |
| `dataDir` | `/opt/render/project/src/data` |
| `persistentDiskLikely` | `true` |
| `storageNote` | disco persistente Render |

Cadastre um vendedor teste → **F5** → `/api/health` → `usersOnDisk` deve ser ≥ 2.

### Erro `EACCES /var/data`

Você definiu pasta de disco sem anexar disco, ou usou `/var/data` em vez do mount do Blueprint. Remova as env `BOARD_DATA_*` e redeploy.

## Domínio próprio

Render → serviço **vestfirma-producao** → **Settings** → **Custom Domains** → adicione (ex. `producao.vestfirma.com.br`) e configure DNS.

## Atualizar o site

Push na branch conectada → deploy automático. Dados em **`/opt/render/project/src/data`** permanecem entre deploys.

## Plano free vs Starter

- **Free** web services hibernam; disco persistente exige plano **Starter** (pago) na Render.
- Para produção com 1000+ pedidos, use **Starter** + disco (como no `render.yaml`).

## Migrar da Vercel

1. Deploy na Render e valide login + um pedido teste.
2. Aponte DNS para a Render (ou use só `.onrender.com`).
3. Desative deploy na Vercel ou deixe só como backup.
