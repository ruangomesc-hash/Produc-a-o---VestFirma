/** Gera um PDF A4 a partir da ficha já desenhada. O lote sai num ZIP, um PDF por pedido. */

import { zipArquivos } from '../shared/zipArquivos.mjs'

export function nomesArquivoUnicos(nomes: string[]) {
  const usados = new Set<string>()
  return nomes.map((nome) => {
    const base = nome.toLowerCase().endsWith('.pdf') ? nome : `${nome}.pdf`
    let candidato = base
    let extra = 2
    while (usados.has(candidato)) {
      candidato = base.replace(/\.pdf$/i, ` (${extra}).pdf`)
      extra += 1
    }
    usados.add(candidato)
    return candidato
  })
}

export async function pdfDaFolha(folha: HTMLElement) {
  const { default: html2canvas } = await import('html2canvas')
  const { jsPDF } = await import('jspdf')
  const canvas = await html2canvas(folha, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const img = canvas.toDataURL('image/jpeg', 0.92)
  const imgHeight = (canvas.height * pageWidth) / canvas.width
  let heightLeft = imgHeight
  let position = 0
  pdf.addImage(img, 'JPEG', 0, position, pageWidth, imgHeight)
  heightLeft -= pageHeight
  while (heightLeft > 2) {
    position -= pageHeight
    pdf.addPage()
    pdf.addImage(img, 'JPEG', 0, position, pageWidth, imgHeight)
    heightLeft -= pageHeight
  }
  return pdf.output('blob')
}

export async function baixarZip(nome: string, arquivos: { nome: string; blob: Blob }[]) {
  const blob = await zipArquivos(arquivos)
  const arquivo = nome.toLowerCase().endsWith('.zip') ? nome : `${nome}.zip`
  baixarBlobs([{ nome: arquivo, blob }])
}

function baixarBlobs(arquivos: { nome: string; blob: Blob }[]) {
  const links = arquivos.map((arquivo) => {
    const url = URL.createObjectURL(arquivo.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = arquivo.nome
    link.style.display = 'none'
    document.body.appendChild(link)
    return { link, url }
  })
  for (const item of links) item.link.click()
  window.setTimeout(() => {
    for (const item of links) {
      item.link.remove()
      URL.revokeObjectURL(item.url)
    }
  }, 4000)
}
