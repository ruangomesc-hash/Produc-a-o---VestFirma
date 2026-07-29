import type { UserRole } from './userRoles'
import { USER_ROLE_LABELS } from './userRoles'
import type { PedidoComentario } from './types'

export type ComentarioAutor = {
  nome: string
  email: string
  role?: UserRole
}

export function rotuloAutorComentario(c: PedidoComentario): string {
  const role = c.autorRole ? USER_ROLE_LABELS[c.autorRole as UserRole] : null
  const nome = c.autorNome?.trim() || c.autorEmail?.trim() || 'Equipe'
  if (role) return `${nome} · ${role}`
  return nome
}

export function placeholderNovoComentario(_autor: ComentarioAutor): string {
  return 'Escreva aqui — atualização, atraso, dúvida ou combinação sobre este pedido…'
}

export function introVisibilidadeComentarios(role: UserRole | undefined): string {
  switch (role) {
    case 'admin':
      return 'Você vê todos os pedidos. Cada comentário fica registrado com o nome de quem escreveu.'
    case 'vendedor':
      return 'Comentários nos seus pedidos — visíveis para produção e administrador. Só você vê pedidos atrelados ao seu login.'
    case 'gerente':
      return 'Comentários neste pedido ficam visíveis para quem tem acesso ao quadro de produção.'
    case 'expedicao':
    case 'impressao':
      return 'Registre atrasos e combinações neste pedido. Quem acessa o kanban conforme sua função pode ler.'
    default:
      return 'Cada comentário fica no nome de quem escreveu. A leitura segue o acesso ao pedido no quadro.'
  }
}

export function autorComentarioFromSession(
  session: { user?: string; email?: string; role?: UserRole } | null,
  fallback?: ComentarioAutor,
): ComentarioAutor {
  return {
    nome: session?.user?.trim() || fallback?.nome?.trim() || 'Equipe',
    email: session?.email?.trim() || fallback?.email?.trim() || '',
    role: session?.role ?? fallback?.role,
  }
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
