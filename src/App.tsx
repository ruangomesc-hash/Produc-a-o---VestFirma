import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { mergeManagedUsers } from './mergeManagedUsers'
import { USER_ROLE_LABELS, canPlaceOrders } from './userRoles'
import {
  findVendedorIdForSession,
  boardVisivelParaSession,
  vendedorPodeAcessarPedido,
  vendedoresParaAtribuirPedido,
  vendedoresParaAtribuirPedidoComAdmin,
  vendedoresSelectParaPedidoAdmin,
  type VendedorContatoPatch,
} from './vendedorUserSync'
import { autorComentarioFromSession } from './pedidoComentarios'
import { ConfirmModal } from './components/ConfirmModal'
import { CardModal } from './components/CardModal'
import { KanbanBoard } from './components/KanbanBoard'
import { PedidoSearchBar } from './components/PedidoSearchBar'
import { WebNotifyButton } from './components/WebNotifyButton'
import { LoginPage } from './components/LoginPage'
import { PwaInstallBanner } from './components/PwaInstallBanner'
import { WhatsAppNotifyModal } from './components/WhatsAppNotifyModal'
import { WhatsAppRedirectModal } from './components/WhatsAppRedirectModal'
import { VisaoGeralPanel } from './components/VisaoGeralPanel'
import { VisaoEquipePanel } from './components/VisaoEquipePanel'
import { SystemStatusPanel } from './components/SystemStatusPanel'
import { ShopifySetupPanel } from './components/ShopifySetupPanel'
import { VendedoresOverviewPanel } from './components/VendedoresOverviewPanel'
import { VendedorPedidoPortalPage } from './components/VendedorPedidoPortalPage'
import { PortalFestaPreviewPage } from './components/PortalFestaPreviewPage'
import { PortalPedidoQuickLink } from './components/PortalPedidoQuickLink'
import { isPortalFestaPreviewRoute, isPortalPedidoRoute } from './portalPedidoRoute'
import { isRedirectRoute, redirectHref } from './redirectRoute'
import { WhatsAppRedirectPage } from './components/WhatsAppRedirectPage'
import { HistoricoAuditoriaPanel } from './components/HistoricoAuditoriaPanel'
import { setAuditActor } from './auditContext'
import { recordAudit } from './auditLog'
import { useBoard } from './hooks/useBoard'
import { contagemPedidos, pedidoVisivelNoKanban } from './pedidosPolicy'
import { pedidoGravadoNoServidor } from './pedidoSaveResult'
import { isRemoteSyncEnabled } from './remoteBoard'
import { diffBoardAlerts } from './boardNotifyDiff'
import {
  mostrarAvisosQuadro,
  registerVestfirmaServiceWorker,
  webNotifyActive,
} from './webNotify'
import type { BoardState, OrderCard } from './types'

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
      <>
        <PwaInstallBanner />
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
      </>
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
  const shell = (node: ReactNode) => (
    <>
      <PwaInstallBanner />
      {node}
    </>
  )
  if (isPortalFestaPreviewRoute()) {
    return shell(<PortalFestaPreviewPage user={userLabel} onLogout={onLogout} />)
  }
  if (isPortalPedidoRoute()) {
    return shell(<VendedorPedidoPortalPage session={session} onLogout={onLogout} />)
  }
  if (isRedirectRoute()) {
    return shell(<WhatsAppRedirectPage user={userLabel} onLogout={onLogout} />)
  }
  return shell(<AuthenticatedApp session={session} onLogout={onLogout} />)
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
    refreshBoardFromServer,
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
    syncPedidoMidia,
    pushPedidoLocalServidor,
    archiveCard,
    restoreArchivedCard,
    permanentlyDeleteArchivedCard,
    moveCard,
  } = useBoard()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalSession, setModalSession] = useState(0)
  const [usuariosOpen, setUsuariosOpen] = useState(false)
  const [whatsappNotifyOpen, setWhatsappNotifyOpen] = useState(false)
  const [whatsappRedirectOpen, setWhatsappRedirectOpen] = useState(false)
  const [createSaveError, setCreateSaveError] = useState<string | null>(null)
  const [archiveConfirm, setArchiveConfirm] = useState<OrderCard | null>(null)
  const [pedidoSearchHighlightId, setPedidoSearchHighlightId] = useState<string | null>(null)
  const pedidoSearchHighlightTimer = useRef<number | null>(null)
  const boardNotifyPrev = useRef<BoardState | null>(null)
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [managedUsersReady, setManagedUsersReady] = useState(false)

  const refreshManagedUsers = useCallback(() => {
    if (!isAdmin(session)) return Promise.resolve()
    return fetchUsers()
      .then((users) => {
        setManagedUsers((prev) => {
          const merged = mergeManagedUsers(prev, users)
          syncVendedoresFromManagedUsers(merged)
          return merged
        })
        setManagedUsersReady(true)
      })
      .catch((err) => {
        console.warn('[vestfirma] falha ao carregar usuários:', err)
      })
  }, [session, syncVendedoresFromManagedUsers])

  const handleUsersLoaded = useCallback(
    (users: ManagedUser[]) => {
      setManagedUsers((prev) => {
        const merged = mergeManagedUsers(prev, users)
        syncVendedoresFromManagedUsers(merged)
        return merged
      })
      setManagedUsersReady(true)
    },
    [syncVendedoresFromManagedUsers],
  )

  const handleUserCreated = useCallback(
    (user: ManagedUser, contato?: VendedorContatoPatch) => {
      upsertVendedorFromManagedUser(user, contato)
      setManagedUsers((prev) => mergeManagedUsers(prev, [user]))
      setManagedUsersReady(true)
    },
    [upsertVendedorFromManagedUser],
  )

  useEffect(() => {
    if (!ready || !session || !canPlaceOrders(session.role)) return
    if (sync.remote && sync.status === 'error') return
    upsertVendedorFromSession(session)
  }, [ready, session, sync.remote, sync.status, upsertVendedorFromSession])

  const preferredVendedorId = useMemo(
    () => (session ? findVendedorIdForSession(board, session) : null),
    [board, session],
  )

  const vendedoresNoPedido = useMemo(() => {
    if (!session) return vendedoresParaAtribuirPedido(board.vendedores, session)
    if (isAdmin(session) && managedUsersReady) {
      return vendedoresSelectParaPedidoAdmin(board, managedUsers, session)
    }
    if (isAdmin(session)) {
      return vendedoresParaAtribuirPedidoComAdmin(board, session)
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

  const vendedoresCadastrados = useMemo(
    () => managedUsers.filter((u) => u.role === 'vendedor'),
    [managedUsers],
  )

  const boardPainelAdmin = board

  const pedidosArquivadosTotal = useMemo(
    () => board.cards.filter((c) => c.arquivadoEm).length,
    [board.cards],
  )

  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
  const [editingCard, setEditingCard] = useState<OrderCard | undefined>()

  const lockVendedorToSession = session?.role === 'vendedor'

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
      pushPedidoLocalServidor(card.id)
    },
    [board, session, pushPedidoLocalServidor],
  )

  const boardKanban = isAdmin(session) ? boardPainelAdmin : boardForSession

  const [view, setView] = useState<
    'kanban' | 'visao' | 'status' | 'shopify' | 'vendedores' | 'historico' | 'equipe'
  >(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (
      hash === 'status' ||
      hash === 'shopify' ||
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
    document.body.classList.toggle('vestfirma-tv', visaoTvMode)
    return () => document.body.classList.remove('vestfirma-tv')
  }, [visaoTvMode])

  useEffect(() => {
    if ((view === 'historico' || view === 'equipe') && !isAdmin(session)) {
      setView('kanban')
    }
  }, [view, session])

  useEffect(() => {
    if (!ready || !session) return
    if (view === 'vendedores' || view === 'kanban' || view === 'visao') {
      void refreshBoardFromServer()
    }
  }, [view, ready, session, refreshBoardFromServer])

  useEffect(() => {
    if (!ready || !session) return
    const tick = () => {
      const hidden = document.visibilityState !== 'visible'
      if (hidden && !webNotifyActive()) return
      if (
        hidden ||
        view === 'kanban' ||
        view === 'visao' ||
        view === 'vendedores'
      ) {
        void refreshBoardFromServer()
      }
    }
    const id = window.setInterval(tick, 4_000)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    window.addEventListener('pageshow', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
      window.removeEventListener('pageshow', tick)
    }
  }, [ready, session, view, refreshBoardFromServer])

  useEffect(() => {
    void registerVestfirmaServiceWorker()
  }, [])

  useEffect(() => {
    if (!ready) return
    const prev = boardNotifyPrev.current
    if (!prev) {
      boardNotifyPrev.current = board
      return
    }
    const alerts = diffBoardAlerts(prev, board)
    boardNotifyPrev.current = board
    if (!alerts.length) return
    if (document.visibilityState === 'visible' && document.hasFocus()) return
    void mostrarAvisosQuadro(alerts)
  }, [board, ready])

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
    setCreateSaveError(null)
    setModalSession((n) => n + 1)
    setModalMode('create')
    setActiveColumnId(columnId)
    setEditingCard(undefined)
    setModalOpen(true)
  }

  const localizarPedidoNoKanban = useCallback(
    (card: OrderCard) => {
      if (!vendedorPodeAcessarPedido(board, session, card)) return
      setView('kanban')
      setPedidoSearchHighlightId(card.id)
      if (pedidoSearchHighlightTimer.current != null) {
        window.clearTimeout(pedidoSearchHighlightTimer.current)
      }
      pedidoSearchHighlightTimer.current = window.setTimeout(() => {
        setPedidoSearchHighlightId(null)
        pedidoSearchHighlightTimer.current = null
      }, 5000)
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          document
            .querySelector(`[data-pedido-id="${card.id}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        })
      })
    },
    [board, session],
  )

  useEffect(() => {
    return () => {
      if (pedidoSearchHighlightTimer.current != null) {
        window.clearTimeout(pedidoSearchHighlightTimer.current)
      }
    }
  }, [])

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
                {pedidosVisiveisNoKanban > 0 ? ` (${pedidosVisiveisNoKanban})` : ''}
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
              <button
                type="button"
                role="tab"
                id="tab-shopify"
                aria-selected={view === 'shopify'}
                aria-controls="panel-shopify"
                className={`nav-tab ${view === 'shopify' ? 'active' : ''}`}
                onClick={() => setView('shopify')}
              >
                Shopify
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
            {view === 'kanban' ? (
              <PedidoSearchBar
                board={boardKanban}
                onLocalizar={localizarPedidoNoKanban}
                onAbrirFicha={openEdit}
              />
            ) : null}
          </nav>
          <div className="brand brand-center">
            <div className="brand-logo-frame">
              <img
                src={`${import.meta.env.BASE_URL}vestfirma-logo.png`}
                alt="VestFirma"
                className="brand-logo"
              />
            </div>
            <p className="subtitle">
              {view === 'visao'
                ? 'Painel de produção'
                : view === 'status'
                  ? 'Diagnóstico do kanban'
                  : view === 'shopify'
                    ? 'Ligação com a loja Shopify'
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

            <a
              className="btn ghost"
              href={redirectHref()}
              title="Página Redirect WhatsApp — mensagens padrão"
            >
              <span className="btn-text-full">Redirect WhatsApp</span>
              <span className="btn-text-short">Redirect</span>
            </a>
            <button
              type="button"
              className="btn ghost wa-redirect-quick-btn"
              onClick={() => setWhatsappRedirectOpen(true)}
              title="Atalho rápido (popup)"
            >
              <span className="btn-text-full">Redirect rápido</span>
              <span className="btn-text-short">Rápido</span>
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setWhatsappNotifyOpen(true)}
              title="Avisos no grupo WhatsApp"
            >
              <span className="btn-text-full">Grupo WhatsApp</span>
              <span className="btn-text-short">Grupo</span>
            </button>
            <WebNotifyButton />
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
          {createSaveError ? (
            <div className="board-restore-banner board-sync-error-banner" role="alert">
              <p>
                <strong>Não foi possível criar o pedido:</strong> {createSaveError}
              </p>
            </div>
          ) : null}
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
          board={boardKanban}
          highlightPedidoId={pedidoSearchHighlightId}
          dragEnabled={!modalOpen && !usuariosOpen && !whatsappNotifyOpen && !whatsappRedirectOpen}
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
          <VisaoGeralPanel
            board={isAdmin(session) ? boardPainelAdmin : boardForSession}
            session={session}
            tvMode={visaoTvMode}
            onExitTv={sairModoTv}
          />
        </div>
      ) : view === 'vendedores' ? (
        <div id="panel-vendedores" className="app-panel" role="tabpanel" aria-labelledby="tab-vendedores">
          <VendedoresOverviewPanel
            board={isAdmin(session) ? boardPainelAdmin : boardForSession}
            managedVendedores={isAdmin(session) ? vendedoresCadastrados : undefined}
          />
        </div>
      ) : view === 'historico' ? (
        <div id="panel-historico" className="app-panel" role="tabpanel" aria-labelledby="tab-historico">
          <HistoricoAuditoriaPanel />
        </div>
      ) : view === 'equipe' ? (
        <div id="panel-equipe" className="app-panel" role="tabpanel" aria-labelledby="tab-equipe">
          <VisaoEquipePanel />
        </div>
      ) : view === 'shopify' ? (
        <div id="panel-shopify" className="app-panel" role="tabpanel" aria-labelledby="tab-shopify">
          <ShopifySetupPanel onImported={() => void refreshBoardFromServer()} />
        </div>
      ) : (
        <div id="panel-status" className="app-panel" role="tabpanel" aria-labelledby="tab-status">
          <SystemStatusPanel
            board={board}
            showArchived={isAdmin(session)}
            onRestoreArchived={restoreArchivedCard}
            onDeleteArchived={permanentlyDeleteArchivedCard}
            onBoardRestored={() => void refreshBoardFromServer()}
            onRestoreFromSnapshot={restoreFromPedidosSnapshot}
            onClearLocalSnapshot={() => void refreshBoardFromServer()}
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
        onMidiaChange={syncPedidoMidia}
        onClose={() => setModalOpen(false)}
        onOpenVendedores={() => {
          setModalOpen(false)
          setUsuariosOpen(true)
        }}
        onAddSegmento={addSegmento}
        onSubmit={async (data) => {
          if (modalMode === 'create' && activeColumnId) {
            setCreateSaveError(null)
            const result = await addCard(activeColumnId, data)
            if (
              !result.ok ||
              (isRemoteSyncEnabled() && !pedidoGravadoNoServidor(result))
            ) {
              setCreateSaveError(
                (!result.ok && result.error) ||
                  'Falha ao gravar no servidor. O pedido não foi confirmado.',
              )
              return
            }
            setModalOpen(false)
          } else if (modalMode === 'edit' && editingCardLive) {
            updateCard(editingCardLive.id, data)
          }
        }}
      />

      <UsuariosModal
        open={usuariosOpen}
        onClose={() => setUsuariosOpen(false)}
        vendedores={board.vendedores}
        seedUsers={managedUsers}
        canDeleteUsers={isAdmin(session)}
        onUsersLoaded={handleUsersLoaded}
        onUserCreated={handleUserCreated}
        onEnsureVendedor={upsertVendedorFromManagedUser}
        onUpdateVendedorContato={updateVendedorContato}
        onUserDeleted={(user) => removeVendedorForManagedUser(user.id)}
      />

      <WhatsAppNotifyModal
        open={whatsappNotifyOpen}
        onClose={() => setWhatsappNotifyOpen(false)}
      />

      <WhatsAppRedirectModal
        open={whatsappRedirectOpen}
        onClose={() => setWhatsappRedirectOpen(false)}
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
