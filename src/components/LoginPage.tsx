import { useState } from 'react'
import { login, loginFailureTitle } from '../authSession'
import type { SessionProfile } from '../authSession'

type Props = {
  onSuccess: (profile: SessionProfile) => void
}

export function LoginPage({ onSuccess }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<{
    title: string
    message: string
    fix?: string
    detail?: string
    meta?: string
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.ok) {
      onSuccess(result.profile)
    } else {
      const metaParts: string[] = []
      if (result.httpStatus) metaParts.push(`HTTP ${result.httpStatus}`)
      if (result.code) metaParts.push(result.code)
      if (result.requestUrl) metaParts.push(result.requestUrl)
      setError({
        title: loginFailureTitle(result.code, result.error),
        message: result.error,
        fix: result.fix,
        detail: result.detail,
        meta: metaParts.length ? metaParts.join(' · ') : undefined,
      })
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img
          src={`${import.meta.env.BASE_URL}vestfirma-logo.png`}
          alt="VestFirma"
          className="login-logo"
        />
        <h1 className="login-title">Produção VestFirma</h1>
        <p className="login-subtitle">
          Entre para acessar o kanban e o painel. Novos acessos só o administrador cria (botão
          Usuários).
        </p>

        <form className="login-form" onSubmit={submit}>
          <label className="login-field">
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="login-field">
            <span>Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <div className="login-error-panel" role="alert">
              <p className="login-error-title">{error.title}</p>
              <p className="login-error-message">{error.message}</p>
              {error.fix && (
                <p className="login-error-fix">
                  <strong>Como corrigir:</strong> {error.fix}
                </p>
              )}
              {error.detail && <p className="login-error-detail">{error.detail}</p>}
              {error.meta && <p className="login-error-meta">{error.meta}</p>}
            </div>
          )}
          <button type="submit" className="login-submit btn primary" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
