import { useState } from 'react'
import { login } from '../authSession'

type Props = {
  onSuccess: (user: string) => void
}

export function LoginPage({ onSuccess }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await login(username, password)
    setLoading(false)
    if (result.ok) {
      onSuccess(result.user)
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
            <span>Usuário</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
