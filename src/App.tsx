import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  logout,
  fetchSessionProfile,
  ensureAuthConfigReady,
  markLoginGrace,
} from './authSession'
import { requiresLogin } from './runtimeConfig'
import type { SessionProfile } from './authSession'
import type { ManagedUser } from './userRoles'
import { UsuariosModal } from './components/UsuariosModal'
import { isAdmin, fetchUsers } from './usersApi'
import { USER_ROLE_LABELS, canPlaceOrders } from './userRoles'
import { findVendedorIdForSession, boardVisivelParaSession, vendedorPodeAcessarPedido, vendedoresParaAtribuirPedido, vendedoresSelectFromUsers } from './vendedorUserSync'
import { autorComentarioFromSession } from './pedidoComentarios'
import { ConfirmModal } from './components/ConfirmModal'
import { CardModal } from './components/CardModal'
import { KanbanBoard } from './components/KanbanBoard'
import { LoginPage } from './components/LoginPage'
import { WhatsAppNotifyModal } from './components/WhatsAppNotifyModal'
import { VisaoGeralPanel } from './components/VisaoGeralPanel'
import { VisaoEquipePanel } from './components/VisaoEquipePanel'
import { SystemStatusPanel } from './components/SystemStatusPanel'
import { VendedoresOverviewPanel } from './components/VendedoresOverviewPanel'
import { VendedorPedidoPortalPage } from './components/VendedorPedidoPortalPage'
import { PortalFestaPreviewPage } from './components/PortalFestaPreviewPage'
import { PortalPedidoQuickLink } from './components/PortalPedidoQuickLink'
import { isPortalFestaPreviewRoute, isPortalPedidoRoute } from './portalPedidoRoute'
import { HistoricoAuditoriaPanel } from './components/HistoricoAuditoriaPanel'
import { setAuditActor } from './auditContext'
import { recordAudit } from './auditLog'
import { useBoard } from './hooks/useBoard'
import { contagemPedidos, pedidoVisivelNoKanban } from './pedidosPolicy'
import type { OrderCard } from './types'

type AuthState = 'boot' | 'checking' | 'login' | 'ok'

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('boot')
  const [session, setSession] = useState<SessionProfile | null>(null)

  useEffect(() => {
    let cancelled = false

    void ensureAuthConfigReady().then(() => {
      if (cancelled) return
      if (!requiresLogin()) {
        setAuthState('ok')
        return
      }
      setAuthState('checking')
      return fetchSessionProfile().then((profile) => {
        if (cancelled) return
        setSession(profile)
        setAuthState(profile ? 'ok' : 'login')
      })
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = () => {
      setSession(null)
      setAuthState(requiresLogin() ? 'login' : 'ok')
    }
    window.addEventListener('vestfirma:unauthorized', onUnauthorized)
    return () => window.removeEventListener('vestfirma:unauthorized', onUnauthorized)
  }, [])

  if (authState === 'boot' || authState === 'checking') {
    return (
      <div className="app-loading">
        <p>{authState === 'boot' ? 'Carregando configuração…' : 'Verificando acesso…'}</p>
      </div>
    )
  }

  if (authState === 'login') {
    return (
      <LoginPage
        onSuccess={(profile) => {
          markLoginGrace()
          setSession(profile)
          setAuthState('ok')
          setAuditActor(profile)
          recordAudit({
            action: 'auth.login',
            summary: `${profile.user} entrou no sistema`,
          })
        }}
      />
    )
  }

  return (
    <AuthenticatedRoot
      session={session}
      onLogout={async () => {
        recordAudit({ action: 'auth.logout', summary: `${session?.user ?? 'Usuário'} saiu` })
        await logout()
        setAuditActor(null)
        setSession(null)
        setAuthState(requiresLogin() ? 'login' : 'ok')
      }}
    />
  )
}

function AuthenticatedRoot({
  session,
  onLogout,
}: {
  session: SessionProfile | null
  onLogout: () => void | Promise<void>
}) {
  const userLabel = session?.user ?? null
  if (isPortalFestaPreviewRoute()) {
    return <PortalFestaPreviewPage user={userLabel} onLogout={onLogout} />
  }
  if (isPortalPedidoRoute()) {
    return <VendedorPedidoPortalPage session={session} onLogout={onLogout} />
  }
  return <AuthenticatedApp session={session} onLogout={onLogout} />
}

type AuthenticatedProps = {
  session: SessionProfile | null
  onLogout: () => void | Promise<void>
}

function AuthenticatedApp({ session, onLogout }: AuthenticatedProps) {
  const {
    board,
    ready,
    sync,
    localRestore,
    restoreRicherLocalToServer,
    restoreFromPedidosSnapshot,
    dismissLocalRestore,
    pedidosSnapshotCount,
    addColumn,
    removeColumn,
    updateVendedorContato,
    upsertVendedorFromManagedUser,
    upsertVendedorFromSession,
    removeVendedorForManagedUser,
    syncVendedoresFromManagedUsers,
    addSegmento,
    addCard,
    updateCard,
    addPedidoComentario,
    archiveCard,
    restoreArchivedCard,
    moveCard,
  } = useBoard()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalSession, setModalSession] = useState(0)
  const [usuariosOpen, setUsuariosOpen] = useState(false)
  const [whatsappNotifyOpen, setWhatsappNotifyOpen] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState<OrderCard | null>(null)
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [managedUsersReady, setManagedUsersReady] = useState(false)

  const refreshManagedUsers = useCallback(() => {
    if (!isAdmin(session)) return Promise.resolve()
    return fetchUsers()
      .then((users) => {
        setManagedUsers(users)
        setManagedUsersReady(true)
        syncVendedoresFromManagedUsers(users)
      })
      .catch(() => {})
  }, [session, syncVendedoresFromManagedUsers])

  useEffect(() => {
    if (!usuariosOpen || !isAdmin(session)) return
    void refreshManagedUsers()
  }, [usuariosOpen, session, refreshManagedUsers])

  useEffect(() => {
    if (!ready || !session || !canPlaceOrders(session.role)) return
    if (sync.remote && sync.status === 'error') return
    upsertVendedorFromSession(session)
  }, [ready, session, sync.remote, sync.status, upsertVendedorFromSession])

  const preferredVendedorId = useMemo(
    () => (session ? findVendedorIdForSession(board, session) : null),
    [board, session],
  )

  const lockVendedorToSession = session?.role === 'vendedor'

  const vendedoresNoPedido = useMemo(() => {
    if (isAdmin(session) && managedUsersReady) {
      return vendedoresSelectFromUsers(board, managedUsers)
    }
    return vendedoresParaAtribuirPedido(board.vendedores, session)
  }, [board, managedUsers, managedUsersReady, session])

  useEffect(() => {
    if (!ready || !isAdmin(session)) return
    void refreshManagedUsers()
  }, [ready, session, refreshManagedUsers])

  const boardForSession = useMemo(
    () => boardVisivelParaSession(board, session),
    [board, session],
  )

  const pedidosVisiveisNoKanban = useMemo(
    () => boardForSession.cards.filter(pedidoVisivelNoKanban).length,
    [boardForSession.cards],
  )

  const pedidosArquivadosTotal = useMemo(
    () => board.cards.filter((c) => c.arquivadoEm).length,
    [board.cards],
  )

  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
  const [editingCard, setEditingCard] = useState<OrderCard | undefined>()

  const editingCardLive = useMemo(() => {
    if (!editingCard) return undefined
    return board.cards.find((c) => c.id === editingCard.id) ?? editingCard
  }, [board.cards, editingCard])

  const podeComentarPedidoAberto =
    Boolean(editingCardLive) &&
    Boolean(session) &&
    vendedorPodeAcessarPedido(board, session, editingCardLive!)

  const autorComentario = useMemo(
    () => (session ? autorComentarioFromSession(session) : null),
    [session],
  )

  const openEdit = useCallback(
    (card: OrderCard) => {
      if (!vendedorPodeAcessarPedido(board, session, card)) return
      setEditingCard(card)
      setModalMode('edit')
      setActiveColumnId(card.columnId)
      setModalSession((n) => n + 1)
      setModalOpen(true)
    },
    [board, session],
  )

  const [view, setView] = useState<
    'kanban' | 'visao' | 'status' | 'vendedores' | 'historico' | 'equipe'
  >(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (
      hash === 'status' ||
      hash === 'visao' ||
      hash === 'kanban' ||
      hash === 'vendedores' ||
      hash === 'historico' ||
      hash === 'equipe'
    ) {
      return hash
    }
    return 'kanban'
  })
  const [visaoTvMode, setVisaoTvMode] = useState(false)

  useEffect(() => {
    if ((view === 'historico' || view === 'equipe') && !isAdmin(session)) {
      setView('kanban')
    }
  }, [view, session])

  useEffect(() => {
    setAuditActor(session)
  }, [session])

  useEffect(() => {
    const want = view === 'kanban' ? '' : `#${view}`
    if (window.location.hash !== want) {
      window.history.replaceState(null, '', want || `${window.location.pathname}${window.location.search}`)
    }
  }, [view])

  const sairModoTv = useCallback(() => {
    setVisaoTvMode(false)
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    }
  }, [])

  const entrarModoTv = useCallback(() => {
    setView('visao')
    setVisaoTvMode(true)
    void document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  useEffect(() => {
    if (visaoTvMode) {
      document.documentElement.classList.add('visao-tv-active')
    } else {
      document.documentElement.classList.remove('visao-tv-active')
    }
    return () => document.documentElement.classList.remove('visao-tv-active')
  }, [visaoTvMode])

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && visaoTvMode) {
        setVisaoTvMode(false)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [visaoTvMode])

  useEffect(() => {
    if (view !== 'visao' && visaoTvMode) {
      sairModoTv()
    }
  }, [view, visaoTvMode, sairModoTv])

  const openCreate = (columnId: string) => {
    setModalSession((n) => n + 1)
    setModalMode('create')
    setActiveColumnId(columnId)
    setEditingCard(undefined)
    setModalOpen(true)
  }

  if (!ready) {
    return (
      <div className="app-loading">
        <p>Carregando produção VestFirma…</p>
      </div>
    )
  }

  return (
    <div className={`app ${visaoTvMode ? 'app-visao-tv' : ''}`}>
      {!visaoTvMode && (
        <header className="app-header">
          <nav className="header-nav" aria-label="Navegação principal">
            <div className="nav-tabs" role="tablist" aria-label="Telas">
              <button
                type="button"
                role="tab"
                id="tab-meus-pedidos"
                aria-selected={view === 'kanban'}
                aria-controls="panel-kanban"
                className={`nav-tab ${view === 'kanban' ? 'active' : ''}`}
                onClick={() => setView('kanban')}
              >
                Meus pedidos
                {board.cards.length > 0 ? ` (${board.cards.length})` : ''}
              </button>
              <button
                type="button"
                role="tab"
                id="tab-visao-geral"
                aria-selected={view === 'visao'}
                aria-controls="panel-visao"
                className={`nav-tab ${view === 'visao' ? 'active' : ''}`}
                onClick={() => setView('visao')}
              >
                Visão geral
              </button>
              <button
                type="button"
                role="tab"
                id="tab-vendedores"
                aria-selected={view === 'vendedores'}
                aria-controls="panel-vendedores"
                className={`nav-tab ${view === 'vendedores' ? 'active' : ''}`}
                onClick={() => setView('vendedores')}
              >
                Por vendedor
              </button>
              <button
                type="button"
                role="tab"
                id="tab-status"
                aria-selected={view === 'status'}
                aria-controls="panel-status"
                className={`nav-tab ${view === 'status' ? 'active' : ''}`}
                onClick={() => setView('status')}
              >
                Status
              </button>
              {isAdmin(session) ? (
                <button
                  type="button"
                  role="tab"
                  id="tab-equipe"
                  aria-selected={view === 'equipe'}
                  aria-controls="panel-equipe"
                  className={`nav-tab ${view === 'equipe' ? 'active' : ''}`}
                  onClick={() => setView('equipe')}
                >
                  Equipe
                </button>
              ) : null}
              {isAdmin(session) ? (
                <button
                  type="button"
                  role="tab"
                  id="tab-historico"
                  aria-selected={view === 'historico'}
                  aria-controls="panel-historico"
                  className={`nav-tab ${view === 'historico' ? 'active' : ''}`}
                  onClick={() => setView('historico')}
                >
                  Histórico
                </button>
              ) : null}
            </div>
          </nav>
          <div className="brand brand-center">
            <img
              src={`${import.meta.env.BASE_URL}vestfirma-logo.png`}
              alt="VestFirma"
              className="brand-logo"
            />
            <p className="subtitle">
              {view === 'visao'
                ? 'Painel de produção'
                : view === 'status'
                  ? 'Diagnóstico do kanban'
                  : view === 'vendedores'
                    ? 'Desempenho por vendedor'
                    : view === 'historico'
                      ? 'Histórico de ações no app'
                      : view === 'equipe'
                        ? 'Visão da equipe por setor'
                        : 'Kanban de uniformes personalizados'}
            </p>
          </div>
          <div className="header-actions">
            {session && (
              <span className="stat-pill" title={session.email}>
                {session.user}
                {session.role ? ` · ${USER_ROLE_LABELS[session.role]}` : ''}
              </span>
            )}
            {isAdmin(session) && (
              <button type="button" className="btn ghost" onClick={() => setUsuariosOpen(true)}>
                Usuários
              </button>
            )}

            <button
              type="button"
              className="btn ghost"
              onClick={() => setWhatsappNotifyOpen(true)}
              title="Avisos no grupo WhatsApp"
            >
              Grupo WhatsApp
            </button>
            {view === 'visao' && (
              <button type="button" className="btn secondary" onClick={entrarModoTv}>
                Modo TV
              </button>
            )}
            {requiresLogin() && (
              <button type="button" className="btn ghost" onClick={() => void onLogout()}>
                Sair
              </button>
            )}
          </div>
        </header>
      )}

      {view === 'kanban' ? (
        <div id="panel-kanban" className="app-panel" role="tabpanel" aria-labelledby="tab-meus-pedidos">
          {sync.status === 'error' && sync.message ? (
            <div className="board-restore-banner board-sync-error-banner" role="alert">
              <p>
                <strong>Falha ao salvar no servidor:</strong> {sync.message}. Seus pedidos continuam
                neste navegador — use <strong>Restaurar pedidos no servidor</strong> abaixo ou
                recarregue após corrigir a conexão.
              </p>
            </div>
          ) : null}
          {ready &&
          contagemPedidos(board) === 0 &&
          (pedidosSnapshotCount > 0 || (localRestore?.cards.length ?? 0) > 0) ? (
            <div className="board-restore-banner" role="alert">
              <p>
                <strong>O quadro aparece vazio</strong>, mas há backup neste navegador (
                {pedidosSnapshotCount || localRestore?.cards.length} pedido(s)). Use o botão para
                recuperar e gravar no servidor.
              </p>
              <div className="board-restore-actions">
                {pedidosSnapshotCount > 0 ? (
                  <button type="button" className="btn primary" onClick={restoreFromPedidosSnapshot}>
                    Recuperar pedidos do backup
                  </button>
                ) : null}
                {localRestore && localRestore.cards.length > 0 ? (
                  <button type="button" className="btn primary" onClick={restoreRicherLocalToServer}>
                    Restaurar pedidos no servidor
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {pedidosVisiveisNoKanban === 0 &&
          pedidosArquivadosTotal > 0 &&
          isAdmin(session) ? (
            <div className="board-restore-banner" role="status">
              <p>
                Há <strong>{pedidosArquivadosTotal}</strong> pedido(s){' '}
                <strong>arquivados</strong> (ocultos do kanban, não apagados). Restaure em{' '}
                <strong>Status → Pedidos arquivados</strong>.
              </p>
              <div className="board-restore-actions">
                <button type="button" className="btn primary" onClick={() => setView('status')}>
                  Abrir Status
                </button>
              </div>
            </div>
          ) : null}
          {localRestore && localRestore.cards.length > board.cards.length ? (
            <div className="board-restore-banner" role="status">
              <p>
                Este navegador guarda <strong>{localRestore.cards.length}</strong> pedido(s), mas o
                servidor só tem <strong>{board.cards.length}</strong>. Isso pode ter ocorrido durante
                falhas de login anteriores.
              </p>
              <div className="board-restore-actions">
                <button type="button" className="btn primary" onClick={restoreRicherLocalToServer}>
                  Restaurar pedidos no servidor
                </button>
                <button type="button" className="btn ghost" onClick={dismissLocalRestore}>
                  Ignorar
                </button>
              </div>
            </div>
          ) : null}
        <KanbanBoard
          board={boardForSession}
          dragEnabled={!modalOpen && !usuariosOpen && !whatsappNotifyOpen}
          onMoveCard={moveCard}
          onAddCard={openCreate}
          onEditCard={openEdit}
          onRequestArchiveCard={(card) => setArchiveConfirm(card)}
          canArchivePedidos={isAdmin(session)}
          canManageColumns={isAdmin(session)}
          onDeleteColumn={removeColumn}
          onAddColumn={addColumn}
        />
        </div>
      ) : view === 'visao' ? (
        <div
          id="panel-visao"
          className={`app-panel${visaoTvMode ? ' app-panel--tv' : ''}`}
          role="tabpanel"
          aria-labelledby="tab-visao-geral"
        >
          <VisaoGeralPanel board={boardForSession} tvMode={visaoTvMode} onExitTv={sairModoTv} />
        </div>
      ) : view === 'vendedores' ? (
        <div id="panel-vendedores" className="app-panel" role="tabpanel" aria-labelledby="tab-vendedores">
          <VendedoresOverviewPanel board={boardForSession} />
        </div>
      ) : view === 'historico' ? (
        <div id="panel-historico" className="app-panel" role="tabpanel" aria-labelledby="tab-historico">
          <HistoricoAuditoriaPanel />
        </div>
      ) : view === 'equipe' ? (
        <div id="panel-equipe" className="app-panel" role="tabpanel" aria-labelledby="tab-equipe">
          <VisaoEquipePanel />
        </div>
      ) : (
        <div id="panel-status" className="app-panel" role="tabpanel" aria-labelledby="tab-status">
          <SystemStatusPanel
            board={board}
            showArchived={isAdmin(session)}
            onRestoreArchived={restoreArchivedCard}
          />
        </div>
      )}

      <CardModal
        key={modalSession}
        session={modalSession}
        open={modalOpen}
        mode={modalMode}
        initial={editingCardLive}
        vendedores={lockVendedorToSession ? board.vendedores : vendedoresNoPedido}
        segmentos={board.segmentos ?? []}
        preferredVendedorId={preferredVendedorId}
        lockVendedorToSession={lockVendedorToSession}
        comentarios={editingCardLive?.comentarios ?? []}
        comentarioAutor={autorComentario}
        podeComentarPedido={podeComentarPedidoAberto}
        onAddComentario={
          podeComentarPedidoAberto && editingCardLive
            ? (texto) =>
                addPedidoComentario(
                  editingCardLive.id,
                  texto,
                  autorComentarioFromSession(session),
                )
            : undefined
        }
        onClose={() => setModalOpen(false)}
        onOpenVendedores={() => {
          setModalOpen(false)
          setUsuariosOpen(true)
        }}
        onAddSegmento={addSegmento}
        onSubmit={(data) => {
          if (modalMode === 'create' && activeColumnId) {
            addCard(activeColumnId, data)
          } else if (modalMode === 'edit' && editingCardLive) {
            updateCard(editingCardLive.id, data)
          }
        }}
      />

      <UsuariosModal
        open={usuariosOpen}
        onClose={() => setUsuariosOpen(false)}
        vendedores={board.vendedores}
        onUsersLoaded={(users) => {
          setManagedUsers(users)
          syncVendedoresFromManagedUsers(users)
        }}
        onUserCreated={(user, contato) => {
          upsertVendedorFromManagedUser(user, contato)
          void refreshManagedUsers()
        }}
        onEnsureVendedor={upsertVendedorFromManagedUser}
        onUpdateVendedorContato={updateVendedorContato}
        onUserDeleted={(user) => removeVendedorForManagedUser(user.id)}
      />

      <WhatsAppNotifyModal
        open={whatsappNotifyOpen}
        onClose={() => setWhatsappNotifyOpen(false)}
      />

      <ConfirmModal
        open={!!archiveConfirm}
        title="Arquivar pedido?"
        message={
          archiveConfirm
            ? `Pedido ${archiveConfirm.numeroPedido} (${archiveConfirm.cliente}) será ocultado do kanban. Não muda de coluna nem é apagado — os dados ficam no servidor. Como administrador, você encontra e restaura em Status → Pedidos arquivados.`
            : ''
        }
        confirmLabel="Sim, arquivar"
        cancelLabel="Cancelar"
        onCancel={() => setArchiveConfirm(null)}
        onConfirm={() => {
          if (archiveConfirm) archiveCard(archiveConfirm.id)
          setArchiveConfirm(null)
        }}
      />

      {!visaoTvMode && <PortalPedidoQuickLink />}
    </div>
  )
}
