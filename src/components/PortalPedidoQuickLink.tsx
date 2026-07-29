import { portalPedidoHref } from '../portalPedidoRoute'

/** Atalho flutuante no painel principal → página /novo-pedido */
export function PortalPedidoQuickLink() {
  return (
    <a
      href={portalPedidoHref()}
      className="app-portal-fab"
      title="Portal do vendedor — cadastrar novo pedido"
      aria-label="Abrir portal do vendedor para cadastrar pedido"
    >
      +
    </a>
  )
}
