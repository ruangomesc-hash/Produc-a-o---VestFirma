import { requiresLogin } from '../runtimeConfig'
import { mainPainelHref } from '../portalPedidoRoute'
import { redirectHref } from '../redirectRoute'
import { WhatsAppRedirectPanel } from './WhatsAppRedirectPanel'

type Props = {
  user: string | null
  onLogout: () => void | Promise<void>
}

export function WhatsAppRedirectPage({ user, onLogout }: Props) {
  return (
    <div className="app wa-redirect-page">
      <header className="app-header">
        <div className="header-spacer header-spacer--start">
          <a className="btn ghost portal-voltar-painel" href={mainPainelHref()}>
            Voltar para o painel
          </a>
        </div>
        <div className="brand brand-center">
          <img
            src={`${import.meta.env.BASE_URL}vestfirma-logo.png`}
            alt="VestFirma"
            className="brand-logo"
          />
          <p className="subtitle">Redirect WhatsApp · mensagens padrão</p>
        </div>
        <div className="header-actions">
          {user ? <span className="stat-pill">{user}</span> : null}
          {requiresLogin() ? (
            <button type="button" className="btn ghost" onClick={() => void onLogout()}>
              Sair
            </button>
          ) : null}
        </div>
      </header>

      <main className="wa-redirect-page-main">
        <div className="wa-redirect-page-card">
          <p className="wa-redirect-page-url" role="status">
            URL desta página:{' '}
            <a href={redirectHref()} className="wa-redirect-page-url-link">
              {redirectHref()}
            </a>
          </p>
          <WhatsAppRedirectPanel layout="page" />
        </div>
      </main>
    </div>
  )
}
