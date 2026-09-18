import { calcularEtapaPrazo, type EtapaPrazoCardRef } from '../etapas'
import { useRelogioPrazo } from '../hooks/useRelogioPrazo'

type Props = {
  columnId: string
  columnTitle: string
  card: EtapaPrazoCardRef
}

export function EtapaPrazoBadge({ columnId, columnTitle, card }: Props) {
  const agora = useRelogioPrazo()

  const prazo = calcularEtapaPrazo(columnId, columnTitle, card, agora)

  if (prazo.tipo === 'nenhum') return null

  if (prazo.tipo === 'logistica') {
    return <span className="etapa-tag logistica">Enviar logística</span>
  }

  if (prazo.tipo === 'enviado') {
    return <span className="etapa-tag enviado">Pedido enviado</span>
  }

  return (
    <span className={`etapa-tag ${prazo.atrasado ? 'atrasado' : 'no-prazo'}`}>{prazo.texto}</span>
  )
}
