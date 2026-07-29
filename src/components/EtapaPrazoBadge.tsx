import { useEffect, useState } from 'react'
import { calcularEtapaPrazo } from '../etapas'

type Props = {
  columnId: string
  columnTitle: string
  etapaDesde: string
}

export function EtapaPrazoBadge({ columnId, columnTitle, etapaDesde }: Props) {
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const prazo = calcularEtapaPrazo(columnId, columnTitle, etapaDesde, agora)

  if (prazo.tipo === 'nenhum') return null

  if (prazo.tipo === 'logistica') {
    return <span className="etapa-tag logistica">Enviar logística</span>
  }

  return (
    <span className={`etapa-tag ${prazo.atrasado ? 'atrasado' : 'no-prazo'}`}>{prazo.texto}</span>
  )
}
