import { useCallback, useEffect, useState } from 'react'
import {
  isWebAppInstalled,
  pedirPermissaoNotificacoes,
  setWebNotifyEnabled,
  webNotifyActive,
  webNotifyPermission,
  webNotifySupported,
} from '../webNotify'

export function WebNotifyButton() {
  const [on, setOn] = useState(false)
  const [hint, setHint] = useState('')

  useEffect(() => {
    setOn(webNotifyActive())
  }, [])

  const toggle = useCallback(async () => {
    setHint('')
    if (!webNotifySupported()) {
      setHint('Este navegador não mostra notificações do sistema.')
      return
    }
    if (on) {
      setWebNotifyEnabled(false)
      setOn(false)
      return
    }
    const ok = await pedirPermissaoNotificacoes()
    setOn(ok)
    if (!ok) {
      setHint(
        webNotifyPermission() === 'denied'
          ? 'Permissão bloqueada neste aparelho. Libere notificações nas configurações do site.'
          : 'Não foi possível ativar as notificações.',
      )
      return
    }
    try {
      const icon = `${import.meta.env.BASE_URL}favicon.png`
      const registration = await navigator.serviceWorker?.ready.catch(() => null)
      const options = {
        body: isWebAppInstalled()
          ? 'Avisos de pedido novo, movimento e etapa estão ligados neste app.'
          : 'Avisos ligados. No iPhone, adicione à Tela de Início para receber com o app fechado.',
        tag: 'vestfirma-notify-teste',
        icon,
      }
      if (registration) await registration.showNotification('VestFirma', options)
      else new Notification('VestFirma', options)
    } catch {
      /* ignore */
    }
  }, [on])

  if (!webNotifySupported()) return null

  return (
    <span className="web-notify-wrap">
      <button
        type="button"
        className={`btn ghost${on ? ' web-notify-btn--on' : ''}`}
        onClick={() => void toggle()}
        title="Notificações deste aparelho: pedido novo, movimento ou mudança de etapa"
        aria-pressed={on}
      >
        {on ? (
          <>
            <span className="btn-text-full">Notificações on</span>
            <span className="btn-text-short">Notif. on</span>
          </>
        ) : (
          <>
            <span className="btn-text-full">Notificações</span>
            <span className="btn-text-short">Notif.</span>
          </>
        )}
      </button>
      {hint ? (
        <span className="web-notify-hint" role="status">
          {hint}
        </span>
      ) : null}
    </span>
  )
}
