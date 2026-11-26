/** ZIP sem compressão. Os PDFs já vêm compactados; aqui só entram juntos num arquivo. */

const CRC_TABELA = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABELA[n] = c >>> 0
}

function crc32(dados) {
  let crc = 0xffffffff
  for (let i = 0; i < dados.length; i += 1) crc = (crc >>> 8) ^ CRC_TABELA[(crc ^ dados[i]) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

function nomeSeguro(nome) {
  const limpo = String(nome || '')
    .replace(/[\\/]/g, '-')
    .replace(/^\.+/, '')
    .trim()
  return limpo || 'arquivo'
}

function u16(valor) {
  return Uint8Array.of(valor & 0xff, (valor >> 8) & 0xff)
}

function u32(valor) {
  return Uint8Array.of(valor & 0xff, (valor >> 8) & 0xff, (valor >> 16) & 0xff, (valor >>> 24) & 0xff)
}

function juntar(partes) {
  const total = partes.reduce((soma, parte) => soma + parte.length, 0)
  const saida = new Uint8Array(total)
  let offset = 0
  for (const parte of partes) {
    saida.set(parte, offset)
    offset += parte.length
  }
  return saida
}

function dataDos(agora = new Date()) {
  const ano = Math.min(2107, Math.max(1980, agora.getFullYear()))
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | Math.floor(agora.getSeconds() / 2)
  const dia = ((ano - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate()
  return { hora, dia }
}

export async function zipArquivos(arquivos) {
  const encoder = new TextEncoder()
  const { hora, dia } = dataDos()
  const locais = []
  const centrais = []
  let offset = 0
  for (const arquivo of arquivos || []) {
    const nome = encoder.encode(nomeSeguro(arquivo?.nome))
    const dados =
      arquivo?.dados instanceof Uint8Array
        ? arquivo.dados
        : new Uint8Array(await arquivo.blob.arrayBuffer())
    const crc = crc32(dados)
    const local = juntar([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(hora),
      u16(dia),
      u32(crc),
      u32(dados.length),
      u32(dados.length),
      u16(nome.length),
      u16(0),
      nome,
      dados,
    ])
    const central = juntar([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(hora),
      u16(dia),
      u32(crc),
      u32(dados.length),
      u32(dados.length),
      u16(nome.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nome,
    ])
    locais.push(local)
    centrais.push(central)
    offset += local.length
  }
  const central = juntar(centrais)
  const fim = juntar([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(locais.length),
    u16(locais.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ])
  return new Blob([juntar(locais), central, fim], { type: 'application/zip' })
}
