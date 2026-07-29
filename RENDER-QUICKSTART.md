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

## Disco persistente

O Blueprint já cria **5 GB** em `/var/data`:

- `board.json` — quadro (leve, logos externalizadas)
- `users.json` — logins
- `logos/` — imagens dos pedidos

## Domínio próprio

Render → serviço **vestfirma-producao** → **Settings** → **Custom Domains** → adicione (ex. `producao.vestfirma.com.br`) e configure DNS.

## Atualizar o site

Push na branch conectada → deploy automático. Dados em `/var/data` **permanecem**.

## Plano free vs Starter

- **Free** web services hibernam; disco persistente exige plano **Starter** (pago) na Render.
- Para produção com 1000+ pedidos, use **Starter** + disco (como no `render.yaml`).

## Migrar da Vercel

1. Deploy na Render e valide login + um pedido teste.
2. Aponte DNS para a Render (ou use só `.onrender.com`).
3. Desative deploy na Vercel ou deixe só como backup.
