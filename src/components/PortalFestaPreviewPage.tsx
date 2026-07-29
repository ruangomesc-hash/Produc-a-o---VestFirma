import { requiresLogin } from '../authSession'
import { portalPedidoHref } from '../portalPedidoRoute'
import { iniciarSinoVenda, pararSinoVenda } from '../vendaSino'
import { PortalVendaCelebracao } from './PortalVendaCelebracao'

type Props = {
  user: string | null
  onLogout: () => void | Promise<void>
}

/** Tela de festa sempre aberta — para ajustar CSS sem cadastrar pedido. */
export function PortalFestaPreviewPage({ user, onLogout }: Props) {
  return (
    <div className="portal-pedido-page portal-pedido-page--festa portal-pedido-page--preview-festa">
      <header className="app-header">
        <div className="header-spacer" aria-hidden />
        <div className="brand brand-center">
          <img
            src={`${import.meta.env.BASE_URL}vestfirma-logo.png`}
            alt="VestFirma"
            className="brand-logo"
          />
          <p className="subtitle">Preview · tela “VENDEDOR VENDE!”</p>
        </div>
        <div className="header-actions">
          <a className="btn ghost portal-festa-preview-link" href={portalPedidoHref()}>
            Portal real
          </a>
          {user && <span className="stat-pill">{user}</span>}
          {requiresLogin() && (
            <button type="button" className="btn ghost" onClick={() => void onLogout()}>
              Sair
            </button>
          )}
        </div>
      </header>

      <p className="portal-festa-preview-banner" role="status">
        Modo preview — edite o visual e recarregue (F5). Não grava pedidos.
      </p>

      <PortalVendaCelebracao
        onCadastrarOutro={() => {
          pararSinoVenda()
          iniciarSinoVenda()
        }}
      />
    </div>
  )
}
