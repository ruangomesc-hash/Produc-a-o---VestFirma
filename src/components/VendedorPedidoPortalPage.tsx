import { useCallback, useEffect, useMemo, useState } from 'react'
import { requiresLogin } from '../runtimeConfig'
import { colunaParaNovoPedido } from '../defaultBoard'
import { useBoard } from '../hooks/useBoard'
import { iniciarSinoVenda, prepararAudioVenda, pararSinoVenda } from '../vendaSino'
import type { CardFormData } from '../types'
import type { SessionProfile } from '../userRoles'
import { findVendedorIdForSession } from '../vendedorUserSync'
import { canPlaceOrders } from '../userRoles'
import { CardModal } from './CardModal'
import { PortalVendaCelebracao } from './PortalVendaCelebracao'

type Props = {
  session: SessionProfile | null
  onLogout: () => void | Promise<void>
}

export function VendedorPedidoPortalPage({ session, onLogout }: Props) {
  const { board, ready, addCard, addSegmento, sync, upsertVendedorFromSession } = useBoard()
  const [modalOpen, setModalOpen] = useState(true)
  const [modalSession, setModalSession] = useState(0)
  const [pedidoEnviado, setPedidoEnviado] = useState(false)

  const columnId = useMemo(
    () => (ready ? colunaParaNovoPedido(board) : null),
    [ready, board],
  )

  const preferredVendedorId = useMemo(
    () => (ready ? findVendedorIdForSession(board, session) : null),
    [ready, board, session],
  )

  useEffect(() => {
    if (!ready || !session || !canPlaceOrders(session.role)) return
    upsertVendedorFromSession(session)
  }, [ready, session, upsertVendedorFromSession])

  const userLabel = session?.user ?? null

  useEffect(() => {
    if (!ready) return
    prepararAudioVenda()
    const warm = () => prepararAudioVenda()
    document.addEventListener('pointerdown', warm, true)
    document.addEventListener('keydown', warm, true)
    return () => {
      document.removeEventListener('pointerdown', warm, true)
      document.removeEventListener('keydown', warm, true)
    }
  }, [ready])

  const abrirNovoPedido = useCallback(() => {
    pararSinoVenda()
    setModalSession((n) => n + 1)
    setPedidoEnviado(false)
    setModalOpen(true)
  }, [])

  const enviarPedido = useCallback(
    (data: CardFormData) => {
      if (!columnId) return
      addCard(columnId, data)
      setModalOpen(false)
      setModalSession((n) => n + 1)
      prepararAudioVenda()
      setPedidoEnviado(true)
    },
    [addCard, columnId],
  )

  if (!ready) {
    return (
      <div className="app-loading portal-pedido-loading">
        <p>Carregando…</p>
      </div>
    )
  }

  if (!columnId || board.columns.length === 0) {
    return (
      <div className="portal-pedido-page">
        <div className="portal-pedido-shell">
          <p className="portal-pedido-error">
            O quadro ainda não tem colunas configuradas. Abra o painel principal primeiro.
          </p>
        </div>
      </div>
    )
  }

  const colunaNome =
    board.columns.find((c) => c.id === columnId)?.title ?? 'Entrada de pedidos'

  return (
    <div className={`portal-pedido-page ${pedidoEnviado ? 'portal-pedido-page--festa' : ''}`}>
      <header className="app-header">
        <div className="header-spacer" aria-hidden />
        <div className="brand brand-center">
          <img
            src={`${import.meta.env.BASE_URL}vestfirma-logo.png`}
            alt="VestFirma"
            className="brand-logo"
          />
          <p className="subtitle">
            Novo pedido · entra em <strong>{colunaNome}</strong> no painel da produção
          </p>
        </div>
        <div className="header-actions">
          {sync.remote && (
            <span
              className={`stat-pill ${
                sync.status === 'saving'
                  ? 'sync-saving'
                  : sync.status === 'error'
                    ? 'sync-error'
                    : 'sync-ok'
              }`}
              title={sync.message}
            >
              {sync.status === 'saving'
                ? 'Salvando…'
                : sync.status === 'error'
                  ? 'Erro ao salvar'
                  : 'Sincronizado'}
            </span>
          )}
          {userLabel && <span className="stat-pill">{userLabel}</span>}
          {requiresLogin() && (
            <button type="button" className="btn ghost" onClick={() => void onLogout()}>
              Sair
            </button>
          )}
        </div>
      </header>

      <main className="portal-pedido-main">
        {!pedidoEnviado && !modalOpen ? (
          <div className="portal-pedido-hint">
            <p>Formulário fechado.</p>
            <button type="button" className="btn primary" onClick={abrirNovoPedido}>
              Cadastrar pedido
            </button>
          </div>
        ) : null}
      </main>

      {pedidoEnviado ? <PortalVendaCelebracao onCadastrarOutro={abrirNovoPedido} /> : null}

      <CardModal
        key={modalSession}
        session={modalSession}
        open={modalOpen}
        mode="create"
        vendedores={board.vendedores}
        segmentos={board.segmentos ?? []}
        allowVendedorCadastro={false}
        preferredVendedorId={preferredVendedorId}
        lockVendedorToSession
        comentarioAutorNome={session?.user}
        onClose={() => setModalOpen(false)}
        onOpenVendedores={() => {}}
        onAddSegmento={addSegmento}
        onSubmit={enviarPedido}
        onVendaCelebrar={iniciarSinoVenda}
      />
    </div>
  )
}
