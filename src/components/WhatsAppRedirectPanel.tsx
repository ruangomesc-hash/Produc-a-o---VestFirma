import { useEffect, useMemo, useState } from 'react'
import { formatTelefoneBr, telefoneBrCompleto } from '../telefoneBr'
import {
  buildWhatsAppRedirectUrl,
  loadWhatsAppMensagensPadrao,
  openWhatsAppRedirect,
  saveWhatsAppMensagensPadrao,
  type WhatsAppMensagemPadrao,
} from '../whatsappRedirect'

type Props = {
  /** page = layout largo na rota /redirect; modal = dentro do popup */
  layout?: 'page' | 'modal'
  onClose?: () => void
}

export function WhatsAppRedirectPanel({ layout = 'page', onClose }: Props) {
  const [numero, setNumero] = useState('')
  const [templates, setTemplates] = useState<WhatsAppMensagemPadrao[]>(() =>
    loadWhatsAppMensagensPadrao(),
  )
  const [selectedId, setSelectedId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState(false)

  useEffect(() => {
    const loaded = loadWhatsAppMensagensPadrao()
    setTemplates(loaded)
    setSelectedId(loaded[0]?.id ?? '')
  }, [])

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? templates[0] ?? null,
    [templates, selectedId],
  )

  const previewUrl = useMemo(() => {
    if (!selected || !telefoneBrCompleto(numero)) return null
    return buildWhatsAppRedirectUrl(numero, selected.texto)
  }, [numero, selected])

  const persistTemplates = (next: WhatsAppMensagemPadrao[]) => {
    setTemplates(next)
    saveWhatsAppMensagensPadrao(next)
    setSavedHint(true)
    window.setTimeout(() => setSavedHint(false), 2200)
  }

  const updateTemplate = (
    id: string,
    patch: Partial<Pick<WhatsAppMensagemPadrao, 'nome' | 'texto'>>,
  ) => {
    persistTemplates(templates.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  const addTemplate = () => {
    const next: WhatsAppMensagemPadrao = {
      id: crypto.randomUUID(),
      nome: `Mensagem padrão ${templates.length + 1}`,
      texto: '',
    }
    persistTemplates([...templates, next])
    setSelectedId(next.id)
  }

  const removeTemplate = (id: string) => {
    if (templates.length <= 1) return
    const next = templates.filter((t) => t.id !== id)
    persistTemplates(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? '')
  }

  const enviar = () => {
    setError(null)
    if (!telefoneBrCompleto(numero)) {
      setError('Informe o WhatsApp do cliente com DDD + 9 dígitos (11 números).')
      return
    }
    if (!selected) {
      setError('Cadastre pelo menos uma mensagem padrão.')
      return
    }
    const url = buildWhatsAppRedirectUrl(numero, selected.texto)
    if (!url) {
      setError('Não foi possível montar o link. Confira o número.')
      return
    }
    openWhatsAppRedirect(url)
  }

  return (
    <div className={`wa-redirect-panel wa-redirect-panel--${layout}`}>
      <section className="wa-redirect-send" aria-labelledby="wa-redirect-send-title">
        <h2 id="wa-redirect-send-title" className="wa-redirect-section-title">
          Enviar para o cliente
        </h2>
        <p className="field-hint">
          Digite o número, escolha a mensagem e abra o WhatsApp com o texto já preenchido.
        </p>

        <label className="field">
          <span>WhatsApp do cliente</span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={numero}
            placeholder="(11) 99999-9999"
            maxLength={16}
            onChange={(e) => {
              setError(null)
              setNumero(formatTelefoneBr(e.target.value))
            }}
          />
        </label>

        <fieldset className="wa-redirect-messages-pick">
          <legend>Mensagem</legend>
          {templates.length === 0 ? (
            <p className="field-hint">Cadastre uma mensagem padrão abaixo.</p>
          ) : (
            templates.map((t) => (
              <label key={t.id} className="wa-redirect-message-option">
                <input
                  type="radio"
                  name="wa-redirect-template"
                  checked={selectedId === t.id}
                  onChange={() => setSelectedId(t.id)}
                />
                <span className="wa-redirect-message-option-label">
                  <strong>{t.nome.trim() || 'Sem nome'}</strong>
                  {t.texto.trim() ? (
                    <span className="wa-redirect-message-preview">
                      {t.texto.trim().slice(0, 120)}
                      {t.texto.trim().length > 120 ? '…' : ''}
                    </span>
                  ) : (
                    <span className="wa-redirect-message-preview wa-redirect-message-preview--empty">
                      (texto vazio — só abre a conversa)
                    </span>
                  )}
                </span>
              </label>
            ))
          )}
        </fieldset>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="wa-redirect-send-actions">
          <button
            type="button"
            className="btn primary wa-redirect-open-btn"
            onClick={enviar}
            disabled={!templates.length}
          >
            Abrir no WhatsApp
          </button>
          {previewUrl ? (
            <a
              className="btn ghost wa-redirect-link-copy"
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ver link
            </a>
          ) : null}
        </div>
      </section>

      <section className="wa-redirect-templates" aria-labelledby="wa-redirect-templates-title">
        <div className="wa-redirect-templates-head">
          <h2 id="wa-redirect-templates-title" className="wa-redirect-section-title">
            Mensagens padrão
          </h2>
          <button type="button" className="btn secondary" onClick={addTemplate}>
            + Nova mensagem
          </button>
        </div>
        {savedHint ? (
          <p className="wa-redirect-saved-hint" role="status">
            Mensagens salvas neste aparelho.
          </p>
        ) : null}
        <p className="field-hint">
          Edite o nome e o texto. Ficam gravadas no navegador — pode cadastrar quantas quiser.
        </p>

        <ul className="wa-redirect-template-list">
          {templates.map((t, index) => (
            <li key={t.id} className="wa-redirect-template-item">
              <label className="field">
                <span>Nome {index + 1}</span>
                <input
                  value={t.nome}
                  onChange={(e) => updateTemplate(t.id, { nome: e.target.value })}
                  placeholder={`Mensagem padrão ${index + 1}`}
                />
              </label>
              <label className="field">
                <span>Texto</span>
                <textarea
                  rows={4}
                  value={t.texto}
                  onChange={(e) => updateTemplate(t.id, { texto: e.target.value })}
                  placeholder="Olá! Segue informação do seu pedido…"
                />
              </label>
              {templates.length > 1 ? (
                <button
                  type="button"
                  className="btn-text wa-redirect-remove-btn"
                  onClick={() => removeTemplate(t.id)}
                >
                  Remover mensagem
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {onClose ? (
        <div className="wa-redirect-footer">
          <button type="button" className="btn ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
      ) : null}
    </div>
  )
}
