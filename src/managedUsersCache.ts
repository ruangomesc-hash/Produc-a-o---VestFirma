import type { ManagedUser } from './userRoles'
import { mergeManagedUsers } from './mergeManagedUsers'

const DB_NAME = 'vestfirma-kanban'
const DB_VERSION = 1
const STORE = 'board'
const KEY = 'managed-users'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
  })
}

export async function loadManagedUsersFromIdb(): Promise<ManagedUser[]> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(KEY)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const value = request.result as ManagedUser[] | undefined
        resolve(Array.isArray(value) ? value.filter((u) => u?.id && u?.email) : [])
      }
    })
  } catch {
    return []
  }
}

export async function saveManagedUsersToIdb(users: ManagedUser[]): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const request = tx.objectStore(STORE).put(users, KEY)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } catch {
    /* ignore */
  }
}

export async function rememberManagedUser(user: ManagedUser): Promise<void> {
  const cached = await loadManagedUsersFromIdb()
  await saveManagedUsersToIdb(mergeManagedUsers(cached, [user]))
}

export async function rememberManagedUsers(users: ManagedUser[]): Promise<void> {
  const cached = await loadManagedUsersFromIdb()
  await saveManagedUsersToIdb(mergeManagedUsers(cached, users))
}

export function usersMissingOnServer(cached: ManagedUser[], server: ManagedUser[]): ManagedUser[] {
  const serverIds = new Set(server.map((u) => u.id))
  const serverEmails = new Set(server.map((u) => u.email.trim().toLowerCase()))
  return cached.filter(
    (u) => !serverIds.has(u.id) && !serverEmails.has(u.email.trim().toLowerCase()),
  )
}
