import { useEffect, useState } from 'react'

/** Atualiza no início de cada minuto — alinhado ao texto “Xh Ymin restantes”. */
export function useRelogioPrazo(intervalMs = 60_000): number {
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    setAgora(Date.now())
    let intervalId = 0
    const startInterval = () => {
      intervalId = window.setInterval(() => setAgora(Date.now()), intervalMs)
    }
    const delay = intervalMs - (Date.now() % intervalMs)
    const timeoutId = window.setTimeout(startInterval, delay)
    return () => {
      window.clearTimeout(timeoutId)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [intervalMs])

  return agora
}
