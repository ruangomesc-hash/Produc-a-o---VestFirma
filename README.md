# VestFirma — Kanban de Produção

Site para organizar pedidos de uniformes personalizados (cliente, peças, pedido, canal, endereço, datas, logo e fluxo de produção).

**Agora:** roda só neste computador (`npm run dev`).  
**Depois:** publica no seu servidor — a pasta `dist/` gerada pelo build.

## Estrutura do projeto

```
Produção - VestFirma/
├── public/          # Arquivos estáticos (favicon, .htaccess para Apache)
├── src/             # Código do site (React)
│   ├── components/  # Kanban, cards, modal
│   ├── hooks/       # Estado do quadro
│   └── storage.ts   # Persistência no navegador (IndexedDB)
├── index.html       # Entrada do site
├── vite.config.ts   # Build e caminho base na URL
├── package.json
└── dist/            # Gerado por npm run build → enviar ao servidor
```

## Desenvolvimento (local)

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:5199` e **mantenha o terminal aberto**.

Atalho Mac: **`Iniciar-Desenvolvimento.command`**

**Ver o site (recomendado):** **`Iniciar Kanban.command`** ou `npm run view` → `http://127.0.0.1:4199`

## Build (igual produção)

```bash
npm run build
npm run preview
```

Confira em `http://127.0.0.1:4199` antes de publicar.

## Publicação

Veja **[DEPLOY.md](./DEPLOY.md)** (Hostinger, subpasta, Apache).

## Dados dos pedidos

Com **`VITE_API_BASE`** configurado no build (veja **[DEPLOY.md](./DEPLOY.md)**), pedidos e logos ficam em **`data/board.json`** no servidor — **mesmo quadro em qualquer aparelho**.

Sem API, os dados ficam só no **IndexedDB** daquele navegador.

Logos são comprimidas no upload (até 1200 px, JPEG) para não inflar o arquivo.

## Colunas padrão

Logos recebidas → Logos em produção → Logos prontas → Disponíveis para aplicação → Em aplicação → Liberado para logística

Colunas e cards podem ser adicionados, excluídos e arrastados entre etapas.
