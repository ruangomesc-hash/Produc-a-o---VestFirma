/** Campainha de pedido novo da Shopify (`src/assets/audio-novo-pedido.mp3`). Uma toque por pedido. */

import audioNovoPedidoUrl from './assets/audio-novo-pedido.mp3?url'

let audio: HTMLAudioElement | null = null
let fila = 0
let tocando = false
let desbloqueado = false

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
  if (!audio) {
    audio = new Audio(audioNovoPedidoUrl)
    audio.preload = 'auto'
    audio.loop = false
    audio.addEventListener('ended', () => {
      tocando = false
      tocarProximoDaFila()
    })
    audio.addEventListener('error', () => {
      tocando = false
      fila = 0
    })
  }
  return audio
}

function tocarProximoDaFila(): void {
  if (tocando || fila <= 0) return
  const el = getAudio()
  if (!el) {
    fila = 0
    return
  }
  fila -= 1
  tocando = true
  el.loop = false
  el.muted = false
  try {
    el.currentTime = 0
  } catch {
    /* ok */
  }
  void el.play().catch((err) => {
    tocando = false
    console.warn('VestFirma: não tocou campainha de pedido Shopify.', err)
  })
}

/** Libera áudio no gesto do usuário (senão o Chrome bloqueia o toque automático). */
export function prepararSinoNovoPedidoShopify(): void {
  if (desbloqueado || tocando || fila > 0) return
  const el = getAudio()
  if (!el) return
  el.muted = true
  void el
    .play()
    .then(() => {
      el.pause()
      el.muted = false
      try {
        el.currentTime = 0
      } catch {
        /* ok */
      }
      desbloqueado = true
    })
    .catch(() => {
      el.muted = false
    })
}

/** Toca o áudio uma vez por pedido novo (em fila, sem sobrepor). */
export function tocarSinoNovosPedidosShopify(quantidade: number): void {
  const n = Math.max(0, Math.floor(Number(quantidade) || 0))
  if (!n) return
  fila += n
  tocarProximoDaFila()
}
