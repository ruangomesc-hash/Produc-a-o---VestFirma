import { useEffect, useRef, useState } from 'react'
import { IMAGE_ACCEPT, MAX_IMAGE_MB } from '../logoUtils'
import { uploadOriginalImage } from '../imageUploads'
import { ImageActions } from './ImageActions'

type Props = {
  label: string
  hint: string
  value: string[]
  onChange: (urls: string[]) => void
  onError: (msg: string | null) => void
  onBusyChange?: (busy: boolean) => void
}

export function LogoUploadField({ label, hint, value, onChange, onError, onBusyChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const upload = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => () => upload.current?.abort(), [])

  useEffect(() => {
    onBusyChange?.(loading)
  }, [loading, onBusyChange])

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files?.length || upload.current) return
    const list = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (list.length === 0) {
      onError('Selecione arquivos de imagem (PNG, JPG, WEBP ou GIF).')
      return
    }

    const controller = new AbortController()
    upload.current = controller
    onError(null)
    setLoading(true)
    try {
      const novas: string[] = []
      for (const file of list) {
        if (controller.signal.aborted) break
        const imageUrl = await uploadOriginalImage(file, controller.signal)
        if (!controller.signal.aborted) novas.push(imageUrl)
      }
      if (!controller.signal.aborted && novas.length > 0) {
        onChange([...value, ...novas])
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        onError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar a imagem. Tente outro arquivo.',
        )
      }
    } finally {
      if (!controller.signal.aborted) {
        upload.current = null
        setLoading(false)
      }
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={IMAGE_ACCEPT}
      multiple
      aria-label={`Anexar ${label.toLowerCase()}`}
      disabled={loading}
      hidden
      onChange={(e) => {
        void handleFiles(e.target.files)
        e.target.value = ''
      }}
    />
  )

  const hasImages = value.length > 0

  return (
    <div className="field span-2 logo-field">
      <span>{label}</span>
      <div
        className={`logo-upload${dragging ? ' logo-upload--dragging' : ''}${!hasImages ? ' logo-upload--empty' : ''}`}
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
          void handleFiles(event.dataTransfer.files)
        }}
      >
        {hasImages ? (
          <ul className="logo-upload-gallery" aria-label={`Imagens — ${label}`}>
            {value.map((src, index) => (
              <li key={`${src}-${index}`} className="logo-upload-gallery-item">
                <div className="logo-preview-wrap">
                  <img src={src} alt={`${label} ${index + 1}`} className="logo-preview" />
                  <ImageActions src={src} label={`${label} ${index + 1}`} />
                  <button
                    type="button"
                    className="btn-text"
                    disabled={loading}
                    onClick={() => onChange(value.filter((_, i) => i !== index))}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <label className={`logo-upload-dropzone${hasImages ? ' logo-upload-dropzone--compact' : ''}`}>
          <span className="logo-upload-dropzone-title">
            {hasImages ? 'Arraste mais imagens para cá' : 'Arraste a imagem para cá'}
          </span>
          <span className="logo-upload-dropzone-sub">
            {hasImages ? 'ou clique para adicionar outra' : 'ou clique para escolher — pode selecionar várias'}
          </span>
          {fileInput}
        </label>

        <p className="logo-hint">
          {hint} PNG, JPG, WEBP ou GIF, até {MAX_IMAGE_MB} MB cada. Resolução e transparência originais
          preservadas.
        </p>
      </div>
    </div>
  )
}
