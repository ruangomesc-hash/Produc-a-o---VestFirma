import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  logout,
  fetchSessionProfile,
  ensureAuthConfigReady,
  markLoginGrace,
} from './authSession'
import { requiresLogin } from './runtimeConfig'
import type { SessionProfile } from './authSession'
import { UsuariosModal } from './components/UsuariosModal'
import { isAdmin, fetchUsers } from './usersApi'
import { USER_ROLE_LABELS, canPlaceOrders } from './userRoles'
import { findVendedorIdForSession } from './vendedorUserSync'
import { ConfirmModal } from './components/ConfirmModal'
import { CardModal } from './components/CardModal'
import { KanbanBoard } from './components/KanbanBoard'
import { LoginPage } from './components/LoginPage'
import { VendedoresModal } from './components/VendedoresModal'
import { WhatsAppNotifyModal } from './components/WhatsAppNotifyModal'
import { VisaoGeralPanel } from './components/VisaoGeralPanel'
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
    dismissLocalRestore,
    addColumn,
    removeColumn,
    updateVendedorContato,
    removeVendedor,
    upsertVendedorFromManagedUser,
    upsertVendedorFromSession,
    removeVendedorForManagedUser,
    syncVendedoresFromManagedUsers,
    addSegmento,
    addCard,
    updateCard,
    addPedidoComentario,
    archiveCard,
    moveCard,
    loadDemo,
    exitDemo,
  } = useBoard()

  const [modalOpen, setModalOpen] = useState(false)
  const [demoConfirm, setDemoConfirm] = useState<'load' | 'exit' | null>(null)
  const [modalSession, setModalSession] = useState(0)
  const [vendedoresOpen, setVendedoresOpen] = useState(false)
  const [whatsappNotifyOpen, setWhatsappNotifyOpen] = useState(false)
  const [usuariosOpen, setUsuariosOpen] = useState(false)

  useEffect(() => {
    if (!vendedoresOpen || !isAdmin(session)) return
    void fetchUsers()
      .then((users) => syncVendedoresFromManagedUsers(users))
      .catch(() => {})
  }, [vendedoresOpen, session, syncVendedoresFromManagedUsers])

  useEffect(() => {
    if (!ready || !session || !canPlaceOrders(session.role)) return
    if (sync.remote && sync.status === 'error') return
    if (sync.remote && sync.status !== 'saved') return
    upsertVendedorFromSession(session)
  }, [ready, session, sync.remote, sync.status, upsertVendedorFromSession])

  const preferredVendedorId = useMemo(
    () => (session ? findVendedorIdForSession(board, session) : null),
    [board, session],
  )

  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
  const [editingCard, setEditingCard] = useState<OrderCard | undefined>()

  const editingCardLive = useMemo(() => {
    if (!editingCard) return undefined
    return board.cards.find((c) => c.id === editingCard.id) ?? editingCard
  }, [board.cards, editingCard])

  const [view, setView] = useState<'kanban' | 'visao' | 'status' | 'vendedores' | 'historico'>(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (
      hash === 'status' ||
      hash === 'visao' ||
      hash === 'kanban' ||
      hash === 'vendedores' ||
      hash === 'historico'
    ) {
      return hash
    }
    return 'kanban'
  })
  const [visaoTvMode, setVisaoTvMode] = useState(false)

  useEffect(() => {
    if (view === 'historico' && !isAdmin(session)) {
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

  const openEdit = (card: OrderCard) => {
    setModalSession((n) => n + 1)
    setModalMode('edit')
    setEditingCard(card)
    setActiveColumnId(card.columnId)
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
            {board.demo ? (
              <button
                type="button"
                className="stat-pill demo-pill stat-pill-btn"
                title="Voltar aos seus pedidos reais"
                onClick={() => setDemoConfirm('exit')}
              >
                Modo demo — sair
              </button>
            ) : null}
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                if (board.demo) {
                  loadDemo()
                  return
                }
                if (board.cards.length > 0) {
                  setDemoConfirm('load')
                  return
                }
                loadDemo()
              }}
            >
              Modo demo
            </button>
            {isAdmin(session) && (
              <button type="button" className="btn ghost" onClick={() => setUsuariosOpen(true)}>
                Usuários
              </button>
            )}
            <button type="button" className="btn ghost" onClick={() => setVendedoresOpen(true)}>
              Vendedores ({board.vendedores.length})
            </button>
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
          board={board}
          dragEnabled={!modalOpen && !vendedoresOpen && !whatsappNotifyOpen}
          onMoveCard={moveCard}
          onAddCard={openCreate}
          onEditCard={openEdit}
          onArchiveCard={archiveCard}
          canArchivePedidos={isAdmin(session)}
          canManageColumns={isAdmin(session)}
          onDeleteColumn={removeColumn}
          onAddColumn={addColumn}
        />
        </div>
      ) : view === 'visao' ? (
        <div id="panel-visao" className="app-panel" role="tabpanel" aria-labelledby="tab-visao-geral">
          <VisaoGeralPanel board={board} tvMode={visaoTvMode} onExitTv={sairModoTv} />
        </div>
      ) : view === 'vendedores' ? (
        <div id="panel-vendedores" className="app-panel" role="tabpanel" aria-labelledby="tab-vendedores">
          <VendedoresOverviewPanel board={board} />
        </div>
      ) : view === 'historico' ? (
        <div id="panel-historico" className="app-panel" role="tabpanel" aria-labelledby="tab-historico">
          <HistoricoAuditoriaPanel />
        </div>
      ) : (
        <div id="panel-status" className="app-panel" role="tabpanel" aria-labelledby="tab-status">
          <SystemStatusPanel board={board} />
        </div>
      )}

      <CardModal
        key={modalSession}
        session={modalSession}
        open={modalOpen}
        mode={modalMode}
        initial={editingCardLive}
        vendedores={board.vendedores}
        segmentos={board.segmentos ?? []}
        preferredVendedorId={preferredVendedorId}
        comentarios={editingCardLive?.comentarios ?? []}
        comentarioAutorNome={session?.user ?? 'Equipe'}
        onAddComentario={
          editingCardLive
            ? (texto) =>
                addPedidoComentario(editingCardLive.id, texto, {
                  nome: session?.user ?? 'Equipe',
                  email: session?.email ?? '',
                  role: session?.role,
                })
            : undefined
        }
        onClose={() => setModalOpen(false)}
        onOpenVendedores={() => {
          setModalOpen(false)
          setVendedoresOpen(true)
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

      <VendedoresModal
        open={vendedoresOpen}
        vendedores={board.vendedores}
        onClose={() => setVendedoresOpen(false)}
        onUpdateContato={updateVendedorContato}
        onRemove={removeVendedor}
        canManageUsers={isAdmin(session)}
        onOpenUsuarios={
          isAdmin(session)
            ? () => {
                setVendedoresOpen(false)
                setUsuariosOpen(true)
              }
            : undefined
        }
      />

      <WhatsAppNotifyModal
        open={whatsappNotifyOpen}
        onClose={() => setWhatsappNotifyOpen(false)}
      />

      <UsuariosModal
        open={usuariosOpen}
        onClose={() => setUsuariosOpen(false)}
        onUsersLoaded={syncVendedoresFromManagedUsers}
        onUserCreated={upsertVendedorFromManagedUser}
        onUserDeleted={(user) => {
          if (user.role === 'vendedor') removeVendedorForManagedUser(user.id)
        }}
      />

      <ConfirmModal
        open={demoConfirm === 'load'}
        title="Carregar demonstração?"
        message="Os pedidos atuais serão guardados neste navegador e substituídos por exemplos em todas as etapas. Use “Modo demo — sair” para voltar."
        confirmLabel="Carregar demo"
        onCancel={() => setDemoConfirm(null)}
        onConfirm={() => {
          setDemoConfirm(null)
          loadDemo()
        }}
      />

      <ConfirmModal
        open={demoConfirm === 'exit'}
        title="Sair do modo demo?"
        message="Voltamos ao quadro com os seus pedidos de antes de carregar a demonstração."
        confirmLabel="Voltar aos meus pedidos"
        onCancel={() => setDemoConfirm(null)}
        onConfirm={() => {
          setDemoConfirm(null)
          exitDemo()
          setView('kanban')
        }}
      />

      {!visaoTvMode && <PortalPedidoQuickLink />}
    </div>
  )
}
