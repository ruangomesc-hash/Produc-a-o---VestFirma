import { useLayoutEffect, useMemo } from 'react'
import { iniciarSinoVenda } from '../vendaSino'

const CONFETTI_COLORS = [
  '#ff0080',
  '#ffea00',
  '#00ff88',
  '#00d4ff',
  '#ff4500',
  '#e8b923',
  '#bf00ff',
  '#ffffff',
]

type Props = {
  onCadastrarOutro: () => void
}

export function PortalVendaCelebracao({ onCadastrarOutro }: Props) {
  useLayoutEffect(() => {
    iniciarSinoVenda()
  }, [])

  const confetti = useMemo(
    () =>
      Array.from({ length: 64 }, (_, i) => ({
        id: i,
        left: `${(i * 13.7 + 3) % 100}%`,
        delay: `${(i % 14) * 0.09}s`,
        duration: `${2.4 + (i % 6) * 0.28}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 6 + (i % 5) * 4,
        h: 10 + (i % 4) * 5,
        rot: (i * 47) % 360,
      })),
    [],
  )

  const sparks = ['🎉', '💰', '🔥', '🏆', '✨', '💸', '🚀', '⭐']

  return (
    <div className="venda-festa-overlay" role="alertdialog" aria-labelledby="venda-festa-title">
      <div className="venda-festa-sol-amarelo" aria-hidden />

      <div className="venda-festa-confetti" aria-hidden>
        {confetti.map((p) => (
          <span
            key={p.id}
            className="venda-festa-confetti-piece"
            style={{
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration,
              backgroundColor: p.color,
              width: p.w,
              height: p.h,
              ['--confetti-rot' as string]: `${p.rot}deg`,
            }}
          />
        ))}
      </div>

      <div className="venda-festa-stage">
        <div className="venda-festa-orbit" aria-hidden>
          {sparks.map((emoji, i) => (
            <span
              key={emoji}
              className="venda-festa-orbit-emoji"
              style={{
                transform: `rotate(${i * 45}deg) translateY(calc(-1 * min(46vw, 14rem))) rotate(${-i * 45}deg)`,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>

        <div className="venda-festa-card">
          <p className="venda-festa-boom" aria-hidden>
            BOOOOM!!!
          </p>
          <h2 id="venda-festa-title" className="venda-festa-title">
            VENDEDOR VENDE!
          </h2>
          <p className="venda-festa-tagline">Vendas é energia, então comemore loucamente!</p>
          <p className="venda-festa-lead">
            Parabéns pela sua venda, você está mais perto do seu objetivo. Agora toque o seu
            sinoooo.
          </p>
          <button type="button" className="venda-festa-btn" onClick={onCadastrarOutro}>
            Cadastrar outro pedido
          </button>
        </div>
      </div>
    </div>
  )
}
