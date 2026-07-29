import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchUsers } from '../usersApi'
import type { ManagedUser, UserRole } from '../userRoles'
import { USER_ROLE_LABELS } from '../userRoles'

const SETORES_ORDEM: UserRole[] = ['admin', 'gerente', 'impressao', 'expedicao', 'vendedor']

const TEMA_POR_SETOR: Record<UserRole, string> = {
  admin: 'visao-card--equipe-admin',
  gerente: 'visao-card--equipe-gerente',
  impressao: 'visao-card--producao',
  expedicao: 'visao-card--logistica',
  vendedor: 'visao-card--equipe-vendedor',
}

function rotuloPessoa(u: ManagedUser): string {
  const nome = u.name?.trim()
  return nome || u.email
}

export function VisaoEquipePanel() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setLoading(true)
    setError(null)
    void fetchUsers()
      .then(setUsers)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar equipe')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const porSetor = useMemo(() => {
    const map = new Map<UserRole, ManagedUser[]>()
    for (const role of SETORES_ORDEM) map.set(role, [])
    for (const u of users) {
      const lista = map.get(u.role)
      if (lista) lista.push(u)
      else map.set(u.role, [u])
    }
    for (const [, lista] of map) {
      lista.sort((a, b) => rotuloPessoa(a).localeCompare(rotuloPessoa(b), 'pt-BR'))
    }
    return map
  }, [users])

  const totalPessoas = users.length

  return (
    <div className="visao-geral visao-equipe">
      <div className="visao-geral-inner">
        <header className="visao-geral-top visao-equipe-top">
          <div className="visao-geral-brand">
            <h1 className="visao-geral-title">Equipe</h1>
            <p className="visao-equipe-sub">
              Visão por setor (perfis de acesso). Somente administrador vê esta tela.
            </p>
          </div>
          <div className="visao-equipe-top-actions">
            <div className="visao-geral-totais">
              <span className="visao-total-pill visao-equipe-total">
                {loading ? '…' : totalPessoas}{' '}
                {totalPessoas === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas'}
              </span>
            </div>
            <button type="button" className="btn ghost btn-sm" onClick={carregar} disabled={loading}>
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
        </header>

        {error ? (
          <p className="visao-equipe-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="visao-grid visao-equipe-grid">
          {SETORES_ORDEM.map((role) => {
            const lista = porSetor.get(role) ?? []
            const tema = TEMA_POR_SETOR[role] ?? 'visao-card--extra'
            return (
              <article key={role} className={`visao-card ${tema}`}>
                <h2 className="visao-card-title">{USER_ROLE_LABELS[role]}</h2>
                <div className="visao-card-logistica visao-equipe-count-block">
                  <span className="visao-metric-value solo">{loading ? '—' : lista.length}</span>
                  <span className="visao-metric-label">
                    {lista.length === 1 ? 'Pessoa neste setor' : 'Pessoas neste setor'}
                  </span>
                </div>
                {!loading && lista.length > 0 ? (
                  <ul className="visao-equipe-list">
                    {lista.map((u) => (
                      <li key={u.id}>
                        <span className="visao-equipe-nome">{rotuloPessoa(u)}</span>
                        {u.name?.trim() ? (
                          <code className="visao-equipe-email">{u.email}</code>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : !loading ? (
                  <p className="visao-equipe-vazio">Ninguém com este perfil ainda.</p>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
