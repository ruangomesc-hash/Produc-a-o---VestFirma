import type { BoardNotifyItem } from './boardNotifyDiff'

const LS_ENABLED = 'vestfirma-web-notify-enabled'

export function webNotifySupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function webNotifyEnabled(): boolean {
  try {
    return localStorage.getItem(LS_ENABLED) === '1'
  } catch {
    return false
  }
}

export function setWebNotifyEnabled(on: boolean) {
  try {
    localStorage.setItem(LS_ENABLED, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function webNotifyPermission(): NotificationPermission | 'unsupported' {
  if (!webNotifySupported()) return 'unsupported'
  return Notification.permission
}

export function webNotifyActive(): boolean {
  return webNotifySupported() && webNotifyEnabled() && Notification.permission === 'granted'
}

export function isWebAppInstalled(): boolean {
  if (typeof window === 'undefined') return false
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const ios = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return standalone || ios
}

export async function registerVestfirmaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  const url = `${import.meta.env.BASE_URL}sw.js`
  try {
    return await navigator.serviceWorker.register(url, { scope: import.meta.env.BASE_URL })
  } catch (err) {
    console.warn('VestFirma: service worker não registrado.', err)
    return null
  }
}

export async function pedirPermissaoNotificacoes(): Promise<boolean> {
  if (!webNotifySupported()) return false
  const perm =
    Notification.permission === 'granted'
      ? 'granted'
      : Notification.permission === 'denied'
        ? 'denied'
        : await Notification.requestPermission()
  const ok = perm === 'granted'
  setWebNotifyEnabled(ok)
  if (ok) await registerVestfirmaServiceWorker()
  return ok
}

export async function mostrarAvisosQuadro(items: BoardNotifyItem[]) {
  if (!items.length || !webNotifyActive()) return
  const icon = `${import.meta.env.BASE_URL}favicon.png`
  const registration = await navigator.serviceWorker?.ready.catch(() => null)

  for (const item of items) {
    const options: NotificationOptions = {
      body: item.body,
      tag: item.tag,
      icon,
      badge: icon,
      data: { url: `${import.meta.env.BASE_URL}#kanban` },
    }
    try {
      if (registration) {
        await registration.showNotification(item.title, options)
      } else {
        new Notification(item.title, options)
      }
    } catch (err) {
      console.warn('VestFirma: falha ao exibir notificação.', err)
    }
  }
}
