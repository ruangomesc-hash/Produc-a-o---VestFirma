import { useState } from 'react'
import { compressLogoFile } from '../logoUtils'

type Props = {
  label: string
  hint: string
  value: string | null
  onChange: (dataUrl: string | null) => void
  onError: (msg: string | null) => void
}

export function LogoUploadField({ label, hint, value, onChange, onError }: Props) {
  const [loading, setLoading] = useState(false)

  const handleFile = async (file: File | null) => {
    if (!file) return
    onError(null)
    setLoading(true)
    try {
      const dataUrl = await compressLogoFile(file)
      onChange(dataUrl)
    } catch {
      onError('Não foi possível carregar a imagem. Tente outro arquivo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="field span-2 logo-field">
      <span>{label}</span>
      <div className="logo-upload">
        {value ? (
          <div className="logo-preview-wrap">
            <img src={value} alt="" className="logo-preview" />
            <button type="button" className="btn-text" onClick={() => onChange(null)}>
              Remover logo
            </button>
          </div>
        ) : (
          <p className="logo-hint">{hint}</p>
        )}
        <label className="btn secondary file-btn">
          {loading ? 'Processando…' : value ? 'Trocar logo' : 'Enviar logo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </div>
  )
}
