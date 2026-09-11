import { useEffect, useRef, useState } from 'react'
import { IMAGE_ACCEPT, MAX_IMAGE_MB } from '../logoUtils'
import { uploadOriginalImage } from '../imageUploads'
import { ImageActions } from './ImageActions'

type Props = {
  label: string
  hint: string
  value: string | null
  onChange: (dataUrl: string | null) => void
  onError: (msg: string | null) => void
  onBusyChange?: (busy: boolean) => void
}

export function LogoUploadField({ label, hint, value, onChange, onError, onBusyChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const upload = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => () => upload.current?.abort(), [])

  const handleFile = async (file: File | null) => {
    if (!file || upload.current) return
    const controller = new AbortController()
    upload.current = controller
    onError(null)
    setLoading(true)
    onBusyChange?.(true)
    try {
      const imageUrl = await uploadOriginalImage(file, controller.signal)
      if (!controller.signal.aborted) onChange(imageUrl)
    } catch (err) {
      if (!controller.signal.aborted) {
        onError(err instanceof Error ? err.message : 'Não foi possível carregar a imagem. Tente outro arquivo.')
      }
    } finally {
      if (!controller.signal.aborted) {
        upload.current = null
        setLoading(false)
        onBusyChange?.(false)
      }
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={IMAGE_ACCEPT}
      aria-label={`Anexar ${label.toLowerCase()}`}
      disabled={loading}
      hidden
      onChange={(e) => {
        void handleFile(e.target.files?.[0] ?? null)
        e.target.value = ''
      }}
    />
  )

  return (
    <div className="field span-2 logo-field">
      <span>{label}</span>
      <div
        className={`logo-upload${dragging ? ' logo-upload--dragging' : ''}${!value ? ' logo-upload--empty' : ''}`}
        aria-busy={loading}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = loading ? 'none' : 'copy'
          setDragging(!loading)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setDragging(false)
          if (event.dataTransfer.files.length !== 1) {
            onError('Anexe uma imagem por campo.')
            return
          }
          void handleFile(event.dataTransfer.files[0])
        }}
      >
        {value ? (
          <div className="logo-preview-wrap">
            <img src={value} alt={label} className="logo-preview" />
            <ImageActions src={value} label={label} />
            <button type="button" className="btn-text" disabled={loading} onClick={() => onChange(null)}>
              Remover imagem
            </button>
          </div>
        ) : (
          <label className="logo-upload-dropzone">
            <span className="logo-upload-dropzone-title">Arraste a imagem para cá</span>
            <span className="logo-upload-dropzone-sub">ou clique para escolher arquivo</span>
            {fileInput}
          </label>
        )}
        {value ? (
          <label className="btn secondary file-btn">
            {loading ? 'Enviando original…' : 'Trocar imagem'}
            {fileInput}
          </label>
        ) : null}
        <p className="logo-hint">
          {hint} PNG, JPG, WEBP ou GIF, até {MAX_IMAGE_MB} MB. Resolução e transparência originais preservadas.
        </p>
      </div>
    </div>
  )
}
