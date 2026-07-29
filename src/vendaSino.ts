/** Campainha real (`src/assets/sino.mp3`) em loop até `pararSinoVenda()`. */

import sinoAssetUrl from './assets/sino.mp3?url'

let sharedCtx: AudioContext | null = null
let bellBuffer: AudioBuffer | null = null
let bellLoadPromise: Promise<AudioBuffer> | null = null
let bellLoadFailed = false

let loopSource: AudioBufferSourceNode | null = null
let loopGain: GainNode | null = null

let htmlAudio: HTMLAudioElement | null = null
let mediaSource: MediaElementAudioSourceNode | null = null
let mediaGain: GainNode | null = null

const PLAYBACK_RATE = 1
const SINO_GANHO = 20

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null

  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null

  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioCtx()
  }
  return sharedCtx
}

function normalizarPico(buf: AudioBuffer): void {
  let peak = 0
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]!))
    }
  }
  if (peak <= 0) return
  const f = 0.995 / peak
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < data.length; i++) data[i]! *= f
  }
}

function ensureBellBuffer(ctx: AudioContext): Promise<AudioBuffer> {
  if (bellBuffer) return Promise.resolve(bellBuffer)
  if (bellLoadFailed) return Promise.reject(new Error('sino indisponível'))
  if (bellLoadPromise) return bellLoadPromise

  bellLoadPromise = (async () => {
    const res = await fetch(sinoAssetUrl, { cache: import.meta.env.DEV ? 'no-store' : 'default' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ab = await res.arrayBuffer()
    bellBuffer = await ctx.decodeAudioData(ab.slice(0))
    normalizarPico(bellBuffer)
    return bellBuffer
  })().catch((err) => {
    bellLoadFailed = true
    bellLoadPromise = null
    console.error('VestFirma: não foi possível carregar sino.mp3', err)
    throw err
  })

  return bellLoadPromise
}

function ensureHtmlAudio(ctx: AudioContext): HTMLAudioElement {
  if (!htmlAudio) {
    htmlAudio = new Audio(sinoAssetUrl)
    htmlAudio.loop = true
    htmlAudio.preload = 'auto'
    htmlAudio.load()
  }
  if (!mediaSource) {
    mediaSource = ctx.createMediaElementSource(htmlAudio)
    mediaGain = ctx.createGain()
    mediaGain.gain.value = SINO_GANHO
    mediaSource.connect(mediaGain)
    mediaGain.connect(ctx.destination)
  }
  return htmlAudio
}

function pararBufferLoop(): void {
  const src = loopSource
  const gain = loopGain
  loopSource = null
  loopGain = null
  if (src) {
    try {
      src.stop()
    } catch {
      /* ok */
    }
    src.disconnect()
  }
  if (gain) gain.disconnect()
}

export function prepararAudioVenda(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  void ctx.resume().catch(() => {})
  ensureHtmlAudio(ctx)
  void ensureBellBuffer(ctx).catch(() => {})
}

export function pararSinoVenda(): void {
  pararBufferLoop()
  if (htmlAudio) {
    htmlAudio.pause()
    try {
      htmlAudio.currentTime = 0
    } catch {
      /* ok */
    }
  }
}

function tocarViaBuffer(ctx: AudioContext, buf: AudioBuffer): void {
  pararBufferLoop()
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = PLAYBACK_RATE
  src.loop = true
  const master = ctx.createGain()
  master.gain.value = SINO_GANHO
  src.connect(master)
  master.connect(ctx.destination)
  src.start(0)
  loopSource = src
  loopGain = master
}

/** Toca na hora (ideal: chamar no clique de enviar ou ao abrir a festa). */
export function iniciarSinoVenda(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const audio = ensureHtmlAudio(ctx)
  if (!audio.paused) return

  void ctx.resume().catch(() => {})

  pararBufferLoop()
  audio.loop = true
  audio.playbackRate = PLAYBACK_RATE
  audio.currentTime = 0

  void audio.play().catch((err) => {
    console.warn('VestFirma: falha HTMLAudio sino, tentando buffer.', err)
    void ensureBellBuffer(ctx)
      .then((buf) => {
        if (!audio.paused) return
        tocarViaBuffer(ctx, buf)
      })
      .catch(() => {})
  })
}

export function tocarSinoVenda(): void {
  iniciarSinoVenda()
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', pararSinoVenda)
}
