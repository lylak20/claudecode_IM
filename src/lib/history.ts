// Client helpers for memo history. The data itself is stored on disk by
// /api/history (see historyStore.ts), so it persists across browser sessions.
export interface HistoryItem {
  id: string
  companyName: string
  url: string
  date: string
  memoText: string
}

const LEGACY_KEY = 'lyla_history'

// "https://www.Acme.com/" and "acme.com" count as the same company
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const pathname = u.pathname.replace(/\/+$/, '')
    return host + pathname
  } catch {
    return url.trim().toLowerCase()
  }
}

let migrated = false

// One-time move of memos saved by the old localStorage version into the file
async function migrateLegacyHistory(): Promise<void> {
  if (migrated) return
  migrated = true
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return
    const items = JSON.parse(raw) as HistoryItem[]
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    if (res.ok) localStorage.removeItem(LEGACY_KEY)
  } catch {}
}

export async function loadHistory(): Promise<HistoryItem[]> {
  await migrateLegacyHistory()
  try {
    const res = await fetch('/api/history', { cache: 'no-store' })
    const data = await res.json()
    return Array.isArray(data.items) ? data.items : []
  } catch {
    return []
  }
}

export async function findHistoryByUrl(url: string): Promise<HistoryItem | undefined> {
  const key = normalizeUrl(url)
  return (await loadHistory()).find((h) => normalizeUrl(h.url) === key)
}

export async function saveToHistory(item: Omit<HistoryItem, 'id'>): Promise<HistoryItem> {
  const newItem: HistoryItem = { ...item, id: Date.now().toString() }
  // replace: reaching this point means the memo was deliberately (re)generated
  const res = await fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: newItem, replace: true }),
  })
  const data = await res.json().catch(() => ({}))
  return data.item ?? newItem
}

export async function deleteFromHistory(id: string): Promise<void> {
  await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
}

export async function updateHistoryMemoText(id: string, memoText: string): Promise<void> {
  await fetch('/api/history', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, memoText }),
  }).catch(() => {})
}
