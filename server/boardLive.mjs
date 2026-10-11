/** Quem está com o painel aberto recebe um aviso no instante em que o quadro é gravado. */
const clients = new Set()

export function addBoardLiveClient(res) {
  clients.add(res)
  return () => {
    clients.delete(res)
  }
}

export function notifyBoardChanged() {
  const line = `event: board\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`
  for (const res of clients) {
    try {
      res.write(line)
    } catch {
      clients.delete(res)
    }
  }
}
