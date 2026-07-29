import { useState } from 'react'
import { login } from '../authSession'
import type { SessionProfile } from '../authSession'

type Props = {
  onSuccess: (profile: SessionProfile) => void
}

export function LoginPage({ onSuccess }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
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
      setError(result.error)
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
        <p className="login-subtitle">Entre para acessar o kanban e o painel.</p>

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
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-submit btn primary" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
