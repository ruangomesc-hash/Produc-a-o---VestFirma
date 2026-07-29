import { LOGO_LOCAL_OPCOES, type LogoLocal } from '../logoLocal'

type Props = {
  value: LogoLocal | null
  onChange: (value: LogoLocal) => void
}

export function LogoLocalPicker({ value, onChange }: Props) {
  return (
    <div className="field span-2 logo-local-field">
      <span>Local da logo *</span>
      <div className="logo-local-tabs" role="group" aria-label="Local da logo">
        {LOGO_LOCAL_OPCOES.map((opcao) => (
          <button
            key={opcao.value}
            type="button"
            className={`logo-local-tab ${value === opcao.value ? 'active' : ''}`}
            aria-pressed={value === opcao.value}
            onClick={() => onChange(opcao.value)}
          >
            {opcao.label}
          </button>
        ))}
      </div>
    </div>
  )
}
