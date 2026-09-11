import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { mesclarSegmentos } from '../segmentosEmpresa'
import type { CardFormData, OrderCard, PedidoComentario, SalesChannel, SegmentoEmpresa, Vendedor } from '../types'
import type { ComentarioAutor } from '../pedidoComentarios'
import { AlertModal } from './AlertModal'
import { LogoUploadField } from './LogoUploadField'
import { LogoLocalPicker } from './LogoLocalPicker'
import { CardHistoricoTimeline } from './CardHistoricoTimeline'
import { CardComentariosSection } from './CardComentariosSection'
import { formatTelefoneBr, telefoneBrCompleto } from '../telefoneBr'
import { prepararAudioVenda } from '../vendaSino'

const ADD_SEGMENTO = '__novo_segmento__'

function buildForm(
  mode: 'create' | 'edit',
  initial: OrderCard | undefined,
  vendedores: Vendedor[],
  preferredVendedorId?: string | null,
): CardFormData {
  if (mode === 'edit' && initial) {
    return {
      cliente: initial.cliente,
      whatsappCliente: formatTelefoneBr(initial.whatsappCliente ?? ''),
      vendedorId: initial.vendedorId ?? null,
      segmentoId: initial.segmentoId ?? null,
      quantidade: initial.quantidade,
      numeroPedido: initial.numeroPedido,
      canal: initial.canal,
      endereco: initial.endereco,
      dataPedido: initial.dataPedido,
      dataPagamento: initial.dataPagamento,
      logoEnviadaCliente: initial.logoEnviadaCliente,
      logoProntaImpressao: initial.logoProntaImpressao,
      previewAprovacaoCliente: initial.previewAprovacaoCliente ?? null,
      localLogo: initial.localLogo,
    }
  }
  const base: CardFormData = {
    cliente: '',
    whatsappCliente: '',
    vendedorId: null,
    segmentoId: null,
    quantidade: 1,
    numeroPedido: '',
    canal: 'whatsapp',
    endereco: '',
    dataPedido: new Date().toISOString().slice(0, 10),
    dataPagamento: '',
    logoEnviadaCliente: null,
    logoProntaImpressao: null,
    previewAprovacaoCliente: null,
    localLogo: null,
  }
  if (preferredVendedorId && vendedores.some((v) => v.id === preferredVendedorId)) {
    base.vendedorId = preferredVendedorId
  } else if (vendedores.length === 1) {
    base.vendedorId = vendedores[0].id
  }
  return base
}

type Props = {
  open: boolean
  session: number
  mode: 'create' | 'edit'
  initial?: OrderCard
  vendedores: Vendedor[]
  segmentos: SegmentoEmpresa[]
  onClose: () => void
  onSubmit: (data: CardFormData) => void
  onOpenVendedores: () => void
  onAddSegmento: (nome: string) => string | null
  allowVendedorCadastro?: boolean
  /** Portal do vendedor: pré-seleciona o vendedor ligado ao login */
  preferredVendedorId?: string | null
  /** Vendedor logado: campo fixo no nome dele (sem lista) */
  lockVendedorToSession?: boolean
  /** Portal: dispara o sino no clique de enviar (antes de gravar). */
  onVendaCelebrar?: () => void
  comentarios?: PedidoComentario[]
  onAddComentario?: (texto: string) => void
  comentarioAutor?: import('../pedidoComentarios').ComentarioAutor | null
  podeComentarPedido?: boolean
  /** @deprecated use comentarioAutor */
  comentarioAutorNome?: string
}

export function CardModal({
  open,
  session,
  mode,
  initial,
  vendedores,
  segmentos,
  onClose,
  onSubmit,
  onOpenVendedores,
  onAddSegmento,
  allowVendedorCadastro = true,
  preferredVendedorId = null,
  lockVendedorToSession = false,
  onVendaCelebrar,
  comentarios = [],
  onAddComentario,
  comentarioAutor = null,
  podeComentarPedido = true,
  comentarioAutorNome,
}: Props) {
  const [form, setForm] = useState<CardFormData>(() =>
    buildForm(mode, initial, vendedores, preferredVendedorId),
  )
  const [quantidadeInput, setQuantidadeInput] = useState(() =>
    String(mode === 'edit' && initial ? initial.quantidade : 1),
  )
  const [logoError, setLogoError] = useState<string | null>(null)
  const [imageUploads, setImageUploads] = useState<Record<string, boolean>>({})
  const imagesUploading = Object.values(imageUploads).some(Boolean)
  const [addingSegmento, setAddingSegmento] = useState(false)
  const [novoSegmentoNome, setNovoSegmentoNome] = useState('')
  const [alert, setAlert] = useState<{ title?: string; message: string } | null>(null)
  const initSession = useRef(-1)

  const segmentoOptions = useMemo(() => mesclarSegmentos(segmentos), [segmentos])

  const showAlert = (message: string, title?: string) => setAlert({ message, title })

  useEffect(() => {
    if (!open || initSession.current === session) return
    initSession.current = session
    const next = buildForm(mode, initial, vendedores, preferredVendedorId)
    setForm(next)
    setQuantidadeInput(String(next.quantidade))
    setLogoError(null)
    setImageUploads({})
    setAddingSegmento(false)
    setNovoSegmentoNome('')
    setAlert(null)
  }, [open, session, mode, initial, vendedores, preferredVendedorId])

  useEffect(() => {
    if (!open || mode !== 'create') return
    const id =
      preferredVendedorId && vendedores.some((v) => v.id === preferredVendedorId)
        ? preferredVendedorId
        : lockVendedorToSession && vendedores.length === 1
          ? vendedores[0].id
          : null
    if (!id) return
    if (lockVendedorToSession) {
      setForm((f) => (f.vendedorId === id ? f : { ...f, vendedorId: id }))
      return
    }
    // Admin escolhe no select — só pré-seleciona se ainda não tiver vendedor.
    setForm((f) => (f.vendedorId ? f : { ...f, vendedorId: id }))
  }, [open, mode, lockVendedorToSession, preferredVendedorId, vendedores])

  useEffect(() => {
    if (open && mode === 'create' && onVendaCelebrar) prepararAudioVenda()
  }, [open, mode, onVendaCelebrar])

  useEffect(() => {
    if (!open) setAlert(null)
  }, [open])

  const parseQuantidade = () => Math.max(1, parseInt(quantidadeInput.replace(/\D/g, ''), 10) || 1)

  const salvarNovoSegmento = () => {
    const nome = novoSegmentoNome.trim()
    if (!nome) {
      showAlert('Informe o nome do novo segmento.', 'Segmento da empresa')
      return
    }
    const id = onAddSegmento(nome)
    if (!id) return
    setForm((f) => ({ ...f, segmentoId: id }))
    setAddingSegmento(false)
    setNovoSegmentoNome('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (imagesUploading) return
    if (!form.cliente.trim() || !form.numeroPedido.trim()) return
    const vendedorIdEfetivo =
      lockVendedorToSession && preferredVendedorId
        ? preferredVendedorId
        : lockVendedorToSession && form.vendedorId
          ? form.vendedorId
          : form.vendedorId
    if (vendedores.length > 0 && !vendedorIdEfetivo) {
      showAlert(
        allowVendedorCadastro
          ? 'Selecione um vendedor ou cadastre um em Usuários.'
          : 'Selecione seu nome na lista de vendedores.',
        'Vendedor',
      )
      return
    }
    if (addingSegmento) {
      showAlert('Salve o novo segmento ou escolha um segmento existente.', 'Segmento da empresa')
      return
    }
    if (!form.segmentoId) {
      showAlert('Selecione o segmento da empresa.', 'Segmento da empresa')
      return
    }
    if (!form.localLogo) {
      showAlert(
        'Escolha uma opção: Frente, Costas ou Frente e costas.',
        'Local da logo',
      )
      return
    }
    if (form.whatsappCliente.trim() && !telefoneBrCompleto(form.whatsappCliente)) {
      showAlert(
        'Informe o DDD (2 dígitos) e os 9 dígitos do celular — no máximo 11 números.',
        'WhatsApp do cliente',
      )
      return
    }
    if (mode === 'create') onVendaCelebrar?.()
    onSubmit({
      ...form,
      vendedorId: vendedorIdEfetivo,
      whatsappCliente: formatTelefoneBr(form.whatsappCliente),
      quantidade: parseQuantidade(),
    })
    onClose()
  }

  const autorComentario: ComentarioAutor | null =
    comentarioAutor ??
    (comentarioAutorNome
      ? { nome: comentarioAutorNome, email: '', role: undefined }
      : null)

  const vendedorLockedNome =
    lockVendedorToSession && form.vendedorId
      ? (vendedores.find((v) => v.id === form.vendedorId)?.nome ??
        autorComentario?.nome ??
        'Vendedor')
      : lockVendedorToSession
        ? (autorComentario?.nome ?? 'Vendedor')
        : null

  if (!open && !alert) return null

  const showComentariosAside = mode === 'edit' && Boolean(initial)

  const dialog = open ? (
    <div className="modal-backdrop modal-backdrop-pedido" role="presentation">
      <div
        className={`modal modal-pedido ${showComentariosAside ? 'modal-pedido--wide' : ''}`}
        role="dialog"
        aria-labelledby="card-modal-title"
      >
        <header className="modal-header">
          <h2 id="card-modal-title">
            {mode === 'create' ? 'Novo pedido' : 'Editar pedido'}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div
            className={`modal-pedido-body ${showComentariosAside ? 'modal-pedido-body--split' : ''}`}
          >
            <div className="modal-pedido-main">
              <div className="form-grid">
            <label className="field span-2">
              <span>Cliente *</span>
              <input
                value={form.cliente}
                onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                required
                placeholder="Nome do cliente"
              />
            </label>

            <label className="field span-2">
              <span>WhatsApp do cliente</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={form.whatsappCliente}
                onChange={(e) =>
                  setForm({ ...form, whatsappCliente: formatTelefoneBr(e.target.value) })
                }
                placeholder="(11) 99999-9999"
                maxLength={16}
                aria-describedby="whatsapp-cliente-hint"
              />
              <span id="whatsapp-cliente-hint" className="field-hint">
                DDD + 9 dígitos (máx. 11 números)
              </span>
            </label>

            <div className="field span-2">
              <span>Segmento da empresa *</span>
              <select
                value={addingSegmento ? ADD_SEGMENTO : (form.segmentoId ?? '')}
                required={!addingSegmento}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === ADD_SEGMENTO) {
                    setAddingSegmento(true)
                    return
                  }
                  setAddingSegmento(false)
                  setNovoSegmentoNome('')
                  setForm({ ...form, segmentoId: v || null })
                }}
              >
                <option value="">Selecione…</option>
                {segmentoOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
                <option value={ADD_SEGMENTO}>+ Adicionar novo segmento…</option>
              </select>
              {addingSegmento && (
                <div className="segmento-add-row">
                  <input
                    value={novoSegmentoNome}
                    onChange={(e) => setNovoSegmentoNome(e.target.value)}
                    placeholder="Nome do segmento (ex.: Cooperativa de crédito)"
                    autoFocus
                  />
                  <button type="button" className="btn ghost segmento-add-btn" onClick={salvarNovoSegmento}>
                    Salvar segmento
                  </button>
                </div>
              )}
              <p className="field-hint">
                Novos segmentos ficam salvos no quadro e aparecem em todos os pedidos.
              </p>
            </div>

            <div className="field">
              <span>Vendedor{vendedores.length > 0 && !lockVendedorToSession ? ' *' : ''}</span>
              {lockVendedorToSession ? (
                <>
                  <input
                    className="vendedor-locked-field"
                    readOnly
                    value={vendedorLockedNome ?? 'Carregando…'}
                    aria-readonly="true"
                  />
                  <p className="field-hint">Vinculado ao seu login — o pedido fica no seu nome.</p>
                </>
              ) : vendedores.length === 0 ? (
                <div className="vendedor-empty-field">
                  <select disabled>
                    <option>Nenhum cadastrado</option>
                  </select>
                  {allowVendedorCadastro ? (
                    <button type="button" className="link-btn" onClick={onOpenVendedores}>
                      Cadastrar em Usuários
                    </button>
                  ) : (
                    <p className="field-hint">
                      Peça à produção para cadastrar vendedores no painel principal.
                    </p>
                  )}
                </div>
              ) : (
                <select
                  value={form.vendedorId ?? ''}
                  required
                  onChange={(e) =>
                    setForm({
                      ...form,
                      vendedorId: e.target.value ? e.target.value : null,
                    })
                  }
                >
                  <option value="">Selecione…</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <label className="field">
              <span>Nº do pedido *</span>
              <input
                value={form.numeroPedido}
                onChange={(e) => setForm({ ...form, numeroPedido: e.target.value })}
                required
                placeholder="Ex: 10482"
              />
            </label>

            <div className="field">
              <span>Quantidade de peças</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                name="quantidade-pecas"
                className="input-quantidade"
                value={quantidadeInput}
                placeholder="Digite a quantidade (ex: 52)"
                onChange={(e) => setQuantidadeInput(e.target.value.replace(/[^\d]/g, ''))}
                onBlur={() => {
                  const n = parseQuantidade()
                  setQuantidadeInput(String(n))
                }}
              />
            </div>

            <label className="field">
              <span>Canal</span>
              <select
                value={form.canal}
                onChange={(e) => setForm({ ...form, canal: e.target.value as SalesChannel })}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="ecommerce">E-commerce</option>
              </select>
            </label>

            <label className="field span-2">
              <span>Endereço</span>
              <textarea
                rows={2}
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                placeholder="Rua, número, bairro, cidade — CEP"
              />
            </label>

            <label className="field">
              <span>Data do pedido</span>
              <input
                type="date"
                value={form.dataPedido}
                onChange={(e) => setForm({ ...form, dataPedido: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Data do pagamento</span>
              <input
                type="date"
                value={form.dataPagamento}
                onChange={(e) => setForm({ ...form, dataPagamento: e.target.value })}
              />
            </label>

            <LogoLocalPicker
              value={form.localLogo}
              onChange={(localLogo) => setForm((f) => ({ ...f, localLogo }))}
            />

            <LogoUploadField
              key={`cliente-${session}`}
              label="Logo enviada pelo cliente"
              hint="Anexe a arte que o cliente mandou (PNG, JPG ou WEBP)."
              value={form.logoEnviadaCliente}
              onError={setLogoError}
              onBusyChange={(busy) => setImageUploads((s) => ({ ...s, cliente: busy }))}
              onChange={(dataUrl) => setForm((f) => ({ ...f, logoEnviadaCliente: dataUrl }))}
            />

            <LogoUploadField
              key={`impressao-${session}`}
              label="Logo pronta para impressão"
              hint="Arquivo tratado pela produção para rodar na máquina (PNG, JPG ou WEBP)."
              value={form.logoProntaImpressao}
              onError={setLogoError}
              onBusyChange={(busy) => setImageUploads((s) => ({ ...s, impressao: busy }))}
              onChange={(dataUrl) => setForm((f) => ({ ...f, logoProntaImpressao: dataUrl }))}
            />

            <LogoUploadField
              key={`aprovacao-${session}`}
              label="Preview aprovado pelo cliente"
              hint="Anexe a imagem da peça com a logo, aprovada pelo cliente. Ela orienta a equipe sobre posição, tamanho e resultado da aplicação."
              value={form.previewAprovacaoCliente}
              onError={setLogoError}
              onBusyChange={(busy) => setImageUploads((s) => ({ ...s, aprovacao: busy }))}
              onChange={(imageUrl) => setForm((f) => ({ ...f, previewAprovacaoCliente: imageUrl }))}
            />

            {logoError && (
              <p className="form-error span-2" style={{ gridColumn: 'span 2' }}>
                {logoError}
              </p>
            )}

            {mode === 'edit' && initial?.historicoEtapa?.length ? (
              <div className="field span-2 modal-historico-wrap">
                <CardHistoricoTimeline entries={initial.historicoEtapa} defaultOpen />
              </div>
            ) : null}
              </div>
            </div>

            {showComentariosAside ? (
              <aside className="modal-pedido-comentarios" aria-label="Comentários do pedido">
                <CardComentariosSection
                  layout="aside"
                  comentarios={comentarios}
                  onAdd={onAddComentario}
                  comentarioAutor={autorComentario}
                  podeComentar={podeComentarPedido && Boolean(onAddComentario)}
                />
              </aside>
            ) : null}
          </div>

          <footer className="modal-footer">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={imagesUploading}>
              {imagesUploading ? 'Aguarde o envio das imagens…' : mode === 'create' ? 'Adicionar ao quadro' : 'Salvar alterações'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  ) : null

  return (
    <>
      {dialog ? createPortal(dialog, document.body) : null}
      <AlertModal
        open={!!alert}
        title={alert?.title}
        message={alert?.message ?? ''}
        onClose={() => setAlert(null)}
      />
    </>
  )
}
