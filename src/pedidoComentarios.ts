import type { UserRole } from './userRoles'
import type { PedidoComentario } from './types'

export type ComentarioAutor = {
  nome: string
  email: string
  role?: UserRole
}

export function criarComentarioPedido(texto: string, autor: ComentarioAutor): PedidoComentario {
  const trimmed = texto.trim()
  return {
    id: crypto.randomUUID(),
    texto: trimmed,
    autorNome: autor.nome.trim() || 'Equipe',
    autorEmail: autor.email.trim(),
    autorRole: autor.role,
    at: new Date().toISOString(),
  }
}

export function ordenarComentariosPedido(comentarios: PedidoComentario[]): PedidoComentario[] {
  return [...comentarios].sort((a, b) => a.at.localeCompare(b.at))
}
