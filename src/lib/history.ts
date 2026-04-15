export interface HistoryItem {
  id: string
  companyName: string
  url: string
  date: string
  memoText: string
}

const KEY = 'lyla_history'
const MAX_ITEMS = 30

export function saveToHistory(item: Omit<HistoryItem, 'id'>): HistoryItem {
  const newItem: HistoryItem = { ...item, id: Date.now().toString() }
  const existing = loadHistory().filter((h) => h.url !== item.url) // dedupe by URL
  const updated = [newItem, ...existing].slice(0, MAX_ITEMS)
  try { localStorage.setItem(KEY, JSON.stringify(updated)) } catch {}
  return newItem
}

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as HistoryItem[]) : []
  } catch {
    return []
  }
}

export function deleteFromHistory(id: string): void {
  const updated = loadHistory().filter((h) => h.id !== id)
  try { localStorage.setItem(KEY, JSON.stringify(updated)) } catch {}
}
