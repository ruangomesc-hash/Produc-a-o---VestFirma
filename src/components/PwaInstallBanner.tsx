import { useCallback, useEffect, useState } from 'react'
import { isWebAppInstalled } from '../webNotify'
import {
  dismissPwaInstallBanner,
  isIosSafari,
  isLikelyMobile,
  promptPwaInstall,
  shouldOfferPwaInstall,
  subscribePwaInstall,
} from '../pwaInstall'

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false)
  const [howto, setHowto] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    setVisible(shouldOfferPwaInstall())
  }, [])

  useEffect(() => {
    refresh()
    return subscribePwaInstall(refresh)
  }, [refresh])

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const onChange = () => refresh()
    mq.addEventListener('change', onChange)
    window.addEventListener('appinstalled', onChange)
    return () => {
      mq.removeEventListener('change', onChange)
      window.removeEventListener('appinstalled', onChange)
    }
  }, [refresh])

  if (!visible || isWebAppInstalled()) return null

  const mobile = isLikelyMobile()
  const ios = isIosSafari()

  const onInstall = async () => {
    setBusy(true)
    const result = await promptPwaInstall()
    setBusy(false)
    if (result === 'accepted') {
      setVisible(false)
      return
    }
    if (result === 'unavailable') setHowto(true)
  }

  const onDismiss = () => {
    dismissPwaInstallBanner()
    setVisible(false)
  }

  const howtoText = ios
    ? 'No Safari, toque em Compartilhar (quadrado com a seta) e depois em Adicionar à Tela de Início.'
    : mobile
      ? 'No menu do Chrome (⋮), toque em Instalar aplicativo ou Adicionar à tela inicial.'
      : 'No Chrome ou Edge, abra o menu do navegador e escolha Instalar VestFirma.'

  return (
    <div className="pwa-install-banner" role="region" aria-label="Instalar aplicativo">
      <p className="pwa-install-banner-text">
        {mobile
          ? 'Coloque o VestFirma na tela inicial do celular ou tablet para abrir como aplicativo.'
          : 'Instale o VestFirma neste computador para abrir como aplicativo na área de trabalho.'}
      </p>
      <div className="pwa-install-banner-actions">
        <button
          type="button"
          className="btn primary pwa-install-banner-btn"
          disabled={busy}
          onClick={() => void onInstall()}
        >
          {busy ? 'Abrindo…' : 'Baixar aplicativo'}
        </button>
        <button type="button" className="pwa-install-banner-close" onClick={onDismiss} aria-label="Fechar">
          ×
        </button>
      </div>
      {howto ? (
        <p className="pwa-install-banner-howto" role="status">
          {howtoText}
        </p>
      ) : null}
    </div>
  )
}
