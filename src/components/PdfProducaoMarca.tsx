export function PdfProducaoMarca({ em }: { em?: string | null }) {
  if (!em) return null
  const quando = new Date(em)
  const titulo = Number.isNaN(quando.getTime())
    ? 'PDF enviado para produção'
    : `PDF enviado para produção em ${quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
  return (
    <span className="card-pdf-producao" title={titulo} aria-label={titulo}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="card-pdf-producao-icone">
        <path
          d="M7 3.5h7.2L19 8.2V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1.5-1.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path d="M14 3.8V8.4h4.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <text x="12" y="16.8" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="currentColor">
          PDF
        </text>
      </svg>
    </span>
  )
}
