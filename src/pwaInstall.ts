import { isWebAppInstalled } from './webNotify'

const LS_DISMISS = 'vestfirma-pwa-install-dismiss'

export type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEventLike | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const fn of listeners) fn()
}

export function capturePwaInstallPrompt() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEventLike
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    try {
      localStorage.removeItem(LS_DISMISS)
    } catch {
      /* ignore */
    }
    notify()
  })
}

export function subscribePwaInstall(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEventLike | null {
  return deferredPrompt
}

export function clearDeferredInstallPrompt() {
  deferredPrompt = null
  notify()
}

export function pwaInstallDismissed(): boolean {
  try {
    return sessionStorage.getItem(LS_DISMISS) === '1'
  } catch {
    return false
  }
}

export function dismissPwaInstallBanner() {
  try {
    sessionStorage.setItem(LS_DISMISS, '1')
  } catch {
    /* ignore */
  }
  notify()
}

export function shouldOfferPwaInstall(): boolean {
  if (typeof window === 'undefined') return false
  if (isWebAppInstalled()) return false
  if (pwaInstallDismissed()) return false
  return true
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  return ios && safari
}

export function isLikelyMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  if (window.matchMedia('(max-width: 1024px) and (pointer: coarse)').matches) return true
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferredPrompt
  if (!event) return 'unavailable'
  try {
    await event.prompt()
    const choice = await event.userChoice
    deferredPrompt = null
    notify()
    return choice.outcome
  } catch {
    return 'dismissed'
  }
}
