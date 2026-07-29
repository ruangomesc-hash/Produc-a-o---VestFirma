import { useEffect, useState } from 'react'
import { AlertModal } from './AlertModal'

type VendedorRow = {
  id: string
  nome: string
  whatsapp?: string
  grupoWhatsapp?: string
}

type Props = {
  open: boolean
  vendedores: VendedorRow[]
  onClose: () => void
  onAdd: (nome: string, whatsapp?: string, grupoWhatsapp?: string) => boolean
  onUpdateContato: (
    id: string,
    patch: { whatsapp?: string; grupoWhatsapp?: string },
  ) => void
  onRemove: (id: string) => void
}

export function VendedoresModal({
  open,
  vendedores,
  onClose,
  onAdd,
  onUpdateContato,
  onRemove,
}: Props) {
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const nome = String(fd.get('nome') ?? '').trim()
    const whatsapp = String(fd.get('whatsapp') ?? '').trim()
    const grupoWhatsapp = String(fd.get('grupoWhatsapp') ?? '').trim()
    if (!nome) return
    const ok = onAdd(nome, whatsapp || undefined, grupoWhatsapp || undefined)
    if (!ok) {
      setAlertMessage('Este vendedor já está cadastrado.')
      return
    }
    e.currentTarget.reset()
  }

  if (!open && !alertMessage) return null

  return (
    <>
      {open ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal modal-narrow modal-pedido"
        role="dialog"
        aria-labelledby="vendedores-title"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="vendedores-title">Vendedores</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="vendedores-body">
          <p className="vendedores-hint">
            Cada vendedor pode ter um <strong>grupo WhatsApp só dele</strong>. No campo abaixo use o{' '}
            <strong>ID do grupo</strong> (termina em <code>@g.us</code>) —{' '}
            <strong>não</strong> use link <code>chat.whatsapp.com/…</code> (convite serve só para
            entrar no grupo). O n8n/Evolution usa esse ID para enviar os avisos.
          </p>

          <form className="vendedores-add vendedores-add-stack" onSubmit={handleAdd}>
            <input name="nome" placeholder="Nome do vendedor" required />
            <input
              name="whatsapp"
              type="tel"
              inputMode="tel"
              placeholder="WhatsApp pessoal (para marcar no grupo)"
              autoComplete="tel"
            />
            <input
              name="grupoWhatsapp"
              placeholder="ID: 120363012345678901@g.us (não cole link de convite)"
              autoComplete="off"
            />
            <button type="submit" className="btn primary">
              Cadastrar
            </button>
          </form>

          {vendedores.length === 0 ? (
            <p className="vendedores-empty">Nenhum vendedor cadastrado ainda.</p>
          ) : (
            <ul className="vendedores-list">
              {vendedores.map((v) => (
                <VendedorContatoEditor
                  key={v.id}
                  vendedor={v}
                  onSave={onUpdateContato}
                  onRemove={onRemove}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
      ) : null}
      <AlertModal
        open={!!alertMessage}
        title="Vendedores"
        message={alertMessage ?? ''}
        onClose={() => setAlertMessage(null)}
      />
    </>
  )
}

function VendedorContatoEditor({
  vendedor,
  onSave,
  onRemove,
}: {
  vendedor: VendedorRow
  onSave: Props['onUpdateContato']
  onRemove: Props['onRemove']
}) {
  const [whatsapp, setWhatsapp] = useState(vendedor.whatsapp ?? '')
  const [grupoWhatsapp, setGrupoWhatsapp] = useState(vendedor.grupoWhatsapp ?? '')
  const [savedHint, setSavedHint] = useState(false)

  useEffect(() => {
    setWhatsapp(vendedor.whatsapp ?? '')
    setGrupoWhatsapp(vendedor.grupoWhatsapp ?? '')
  }, [vendedor.id, vendedor.whatsapp, vendedor.grupoWhatsapp])

  const savedWhatsapp = (vendedor.whatsapp ?? '').trim()
  const savedGrupo = (vendedor.grupoWhatsapp ?? '').trim()
  const dirty =
    whatsapp.trim() !== savedWhatsapp || grupoWhatsapp.trim() !== savedGrupo

  const handleSave = () => {
    onSave(vendedor.id, { whatsapp, grupoWhatsapp })
    setSavedHint(true)
    window.setTimeout(() => setSavedHint(false), 2200)
  }

  useEffect(() => {
    if (dirty) setSavedHint(false)
  }, [dirty])

  return (
    <li className="vendedores-list-item">
      <div className="vendedor-row-main">
        <span className="vendedor-nome">{vendedor.nome}</span>
        <label className="vendedor-wa-edit">
          <span className="vendedor-field-label">WhatsApp</span>
          <input
            type="tel"
            inputMode="tel"
            placeholder="Número para marcar"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </label>
        <label className="vendedor-wa-edit">
          <span className="vendedor-field-label">Grupo WhatsApp (ID)</span>
          <input
            type="text"
            placeholder="120363…@g.us"
            value={grupoWhatsapp}
            onChange={(e) => setGrupoWhatsapp(e.target.value)}
          />
        </label>
      </div>
      <div className="vendedor-row-actions">
        <button
          type="button"
          className="btn primary btn-sm"
          disabled={!dirty}
          onClick={handleSave}
        >
          Salvar
        </button>
        {savedHint ? (
          <span className="vendedor-saved-hint" aria-live="polite">
            Salvo
          </span>
        ) : null}
        <button
          type="button"
          className="link-btn danger"
          onClick={() => {
            if (confirm('Excluir ' + vendedor.nome + '? Pedidos ficam sem vendedor.')) {
              onRemove(vendedor.id)
            }
          }}
        >
          Excluir
        </button>
      </div>
    </li>
  )
}
