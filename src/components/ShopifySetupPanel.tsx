import { useCallback, useEffect, useRef, useState } from 'react'
import { authHeaders } from '../authSession'
import { getApiBase } from '../runtimeConfig'

type ShopifyStatus = {
  ok?: boolean
  shopifyConfigured?: boolean
  shop?: string | null
  webhook?: string
}

type PedidoFaltando = {
  shopifyOrderId: string
  numeroPedido: string
  cliente: string
  dataPedido: string
  createdAt: string
  quantidade: number
  cancelado?: boolean
}

type CheckupResult = {
  ok?: boolean
  error?: string
  imported?: number
  restaurados?: number
  shopifyTotal?: number
  kanbanTotal?: number
  jaNoKanban?: number
  faltando?: number
  noKanban?: PedidoFaltando[]
  extraidos?: PedidoFaltando[]
}

function checkupUrl(): string {
  const api = getApiBase()
  if (api?.startsWith('http')) return `${api.replace(/\/$/, '')}/shopify/checkup`
  return `${(api || '/api').replace(/\/$/, '')}/shopify/checkup`
}

function webhookUrlAbsoluta(): string {
  const path = '/shopify/webhook'
  const api = getApiBase()
  if (api?.startsWith('http')) return `${api.replace(/\/$/, '')}${path}`
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://mapaproducao.vestfirma.com.br'
  const base = (api || '/api').replace(/\/$/, '')
  return `${origin}${base}${path}`
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}

export function ShopifySetupPanel({ onImported }: { onImported?: () => void }) {
  const [status, setStatus] = useState<ShopifyStatus | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [checkup, setCheckup] = useState<CheckupResult | null>(null)
  const [checkupError, setCheckupError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'scan' | 'import' | null>(null)
  const autoExtractFeito = useRef(false)
  const webhook = webhookUrlAbsoluta()

  const refresh = useCallback(async () => {
    const api = getApiBase()
    const url = api?.startsWith('http')
      ? `${api.replace(/\/$/, '')}/shopify`
      : `${(api || '/api').replace(/\/$/, '')}/shopify`
    try {
      const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
      const data = (await res.json()) as ShopifyStatus
      setStatus(data)
    } catch {
      setStatus({ ok: false, shopifyConfigured: false })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const runCheckup = useCallback(async (importMissing: boolean) => {
    setBusy(importMissing ? 'import' : 'scan')
    setCheckupError(null)
    try {
      const res = await fetch(checkupUrl(), {
        method: importMissing ? 'POST' : 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: importMissing ? JSON.stringify({ importMissing: true }) : undefined,
      })
      const data = (await res.json().catch(() => ({}))) as CheckupResult
      if (!res.ok || data.ok === false) {
        setCheckupError(data.error || `Falha no checkup (${res.status})`)
        return
      }
      setCheckup(data)
      if (importMissing && ((data.imported ?? 0) > 0 || (data.restaurados ?? 0) > 0)) onImported?.()
    } catch (err) {
      setCheckupError(err instanceof Error ? err.message : 'Falha no checkup')
    } finally {
      setBusy(null)
    }
  }, [onImported])

  const onCopy = async (id: string, texto: string) => {
    const ok = await copiar(texto)
    if (ok) {
      setCopied(id)
      window.setTimeout(() => setCopied(null), 2000)
    }
  }

  const ligado = status?.shopifyConfigured === true

  useEffect(() => {
    if (!ligado || autoExtractFeito.current) return
    autoExtractFeito.current = true
    void runCheckup(true)
  }, [ligado, runCheckup])

  return (
    <div className="shopify-setup">
      <div className="shopify-setup-inner">
        <header className="shopify-setup-top">
          <div>
            <h1 className="shopify-setup-title">Configurar Shopify</h1>
            <p className="shopify-setup-sub">
              Passo a passo para a loja <strong>vestfirma.com.br</strong> mandar pedidos para o kanban em{' '}
              <strong>mapaproducao.vestfirma.com.br</strong> (coluna Pedido feito) e receber a etapa de
              volta.
            </p>
          </div>
          <span className={`shopify-setup-status ${ligado ? 'on' : 'off'}`}>
            {ligado
              ? `Ligada${status?.shop ? ` · ${status.shop}` : ''}`
              : 'Ainda não conectada'}
          </span>
        </header>

        <section className="shopify-setup-card shopify-checkup-card">
          <h2>Checkup: Shopify × kanban</h2>
          <p className="shopify-setup-hint">
            Lê todos os pedidos da loja, mostra o que ainda não está no quadro e, se você pedir, traz
            os que faltam para <strong>Pedido feito</strong> com a data do pedido na Shopify.
          </p>
          <div className="shopify-setup-copy-row">
            <button
              type="button"
              className="btn secondary small"
              disabled={busy !== null || !ligado}
              onClick={() => void runCheckup(false)}
            >
              {busy === 'scan' ? 'Conferindo…' : 'Conferir pedidos da loja'}
            </button>
            <button
              type="button"
              className="btn primary small"
              disabled={busy !== null || !ligado}
              onClick={() => void runCheckup(true)}
            >
              {busy === 'import'
                ? 'Extraindo…'
                : `Trazer os que faltam${checkup?.faltando ? ` (${checkup.faltando})` : ''}`}
            </button>
          </div>
          {checkupError ? (
            <p className="shopify-checkup-error" role="alert">
              {checkupError}
            </p>
          ) : null}
          {checkup ? (
            <dl className="shopify-checkup-stats">
              <div>
                <dt>Na Shopify</dt>
                <dd>{checkup.shopifyTotal ?? 0}</dd>
              </div>
              <div>
                <dt>Já no kanban</dt>
                <dd>{checkup.jaNoKanban ?? 0}</dd>
              </div>
              <div>
                <dt>Faltando</dt>
                <dd>{checkup.faltando ?? 0}</dd>
              </div>
              {typeof checkup.imported === 'number' && checkup.imported > 0 ? (
                <div>
                  <dt>Extraídos agora</dt>
                  <dd>{checkup.imported}</dd>
                </div>
              ) : null}
              {typeof checkup.restaurados === 'number' && checkup.restaurados > 0 ? (
                <div>
                  <dt>De volta ao quadro</dt>
                  <dd>{checkup.restaurados}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {checkup && (checkup.faltando ?? 0) === 0 ? (
            <p className="shopify-checkup-ok">Todos os pedidos da Shopify já estão no kanban.</p>
          ) : null}
          {(checkup?.noKanban?.length || checkup?.extraidos?.length) ? (
            <div className="shopify-checkup-table-wrap">
              <table className="shopify-checkup-table">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Data na loja</th>
                    <th>Peças</th>
                  </tr>
                </thead>
                <tbody>
                  {(checkup.noKanban?.length ? checkup.noKanban : checkup.extraidos ?? []).map((p) => (
                    <tr key={p.shopifyOrderId}>
                      <td>{p.numeroPedido}</td>
                      <td>
                        {p.cliente}
                        {p.cancelado ? ' (cancelado)' : ''}
                      </td>
                      <td>{p.dataPedido}</td>
                      <td>{p.quantidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section className="shopify-setup-card">
          <h2>O que você vai copiar neste kanban</h2>
          <p className="shopify-setup-hint">URL do webhook — cole na Shopify, nos avisos de pedido:</p>
          <div className="shopify-setup-copy-row">
            <code className="shopify-setup-code">{webhook}</code>
            <button type="button" className="btn primary small" onClick={() => void onCopy('wh', webhook)}>
              {copied === 'wh' ? 'Copiado' : 'Copiar URL'}
            </button>
          </div>
        </section>

        <ol className="shopify-setup-steps">
          <li>
            <h3>1. Abra o admin da Shopify</h3>
            <p>
              Entre em <a href="https://admin.shopify.com" target="_blank" rel="noreferrer">admin.shopify.com</a>{' '}
              na loja do site vestfirma.com.br.
            </p>
          </li>
          <li>
            <h3>2. Anote o endereço interno da loja</h3>
            <p>
              No seu painel já aparece: use <code>vestfirma.myshopify.com</code> como{' '}
              <code>SHOPIFY_SHOP</code>. O site público é o vestfirma.com.br; o{' '}
              <code>zt3dfv-b8.myshopify.com</code> também é da mesma loja e o kanban aceita os dois
              no webhook.
            </p>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => void onCopy('shop', 'vestfirma.myshopify.com')}
            >
              {copied === 'shop' ? 'Copiado' : 'Copiar vestfirma.myshopify.com'}
            </button>
          </li>
          <li>
            <h3>3. Use o app que já existe no tema</h3>
            <p>
              Na loja VestFirma o app certo é <strong>app-pedidos-status-de-producao</strong> (o do tema /
              thank-you), já com <code>read_orders</code> e <code>write_orders</code>. Instale esse. Não
              precisa de um app novo só para o kanban — o VestFirma Kanban do Dev Dashboard pode ficar
              parado.
            </p>
          </li>
          <li>
            <h3>4. Libere os pedidos</h3>
            <p>
              Em <strong>Configuração da API Admin</strong>, marque <strong>read_orders</strong> e{' '}
              <strong>write_orders</strong>. Salve e <strong>instale o app</strong>.
            </p>
          </li>
          <li>
            <h3>5. Copie o token</h3>
            <p>
              Revele o <strong>token de acesso da API Admin</strong>. Esse valor é o{' '}
              <code>SHOPIFY_ADMIN_TOKEN</code>. Não cole no GitHub — só no servidor.
            </p>
          </li>
          <li>
            <h3>6. Cole as variáveis no servidor (Render)</h3>
            <p>
              No painel da Render, serviço do kanban → <strong>Environment</strong>. Crie ou preencha:
            </p>
            <ul>
              <li>
                <code>SHOPIFY_SHOP</code> = <code>vestfirma.myshopify.com</code>
              </li>
              <li>
                <code>SHOPIFY_ADMIN_TOKEN</code> = o token do passo 5
              </li>
              <li>
                <code>SHOPIFY_WEBHOOK_SECRET</code> = o secret do passo 7
              </li>
            </ul>
            <p>Salve e aguarde o serviço reiniciar. Os pedidos que já estão no kanban não são apagados.</p>
          </li>
          <li>
            <h3>7. Cadastre o webhook na Shopify</h3>
            <p>
              <strong>Configurações → Notificações → Webhooks → Criar webhook</strong>. Formato JSON.
              URL: a que você copiou acima. Eventos:
            </p>
            <ul>
              <li>Pedido criado (<code>orders/create</code>)</li>
              <li>Pedido atualizado (<code>orders/updated</code>)</li>
              <li>Pedido cancelado (<code>orders/cancelled</code>) — só anota; o card permanece</li>
            </ul>
            <p>
              Depois de criar, copie a <strong>assinatura / signing secret</strong> para{' '}
              <code>SHOPIFY_WEBHOOK_SECRET</code> no passo 6 (se ainda não estiver).
            </p>
            <button type="button" className="btn ghost small" onClick={() => void onCopy('wh2', webhook)}>
              {copied === 'wh2' ? 'URL copiada' : 'Copiar URL do webhook de novo'}
            </button>
          </li>
          <li>
            <h3>8. Conferir</h3>
            <p>
              Faça um pedido de teste na loja. Ele deve aparecer em <strong>Pedido feito</strong>,
              piscando <strong>Solicitar logo</strong>. Ao clicar, abre o WhatsApp do cliente com a
              mensagem de logo (configurável no Redirect). Ao arrastar para a próxima etapa, a Shopify
              recebe a etapa de volta.
            </p>
            <button type="button" className="btn secondary small" onClick={() => void refresh()}>
              Verificar conexão agora
            </button>
          </li>
        </ol>
      </div>
    </div>
  )
}
