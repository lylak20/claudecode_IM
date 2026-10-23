// Server-only: history lives in data/history.json on this machine so it
// survives browser resets, port changes and restarts. The folder is gitignored
// because the repo is public.
import { promises as fs } from 'fs'
import path from 'path'
import { normalizeUrl, type HistoryItem } from './history'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'history.json')

export async function readHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function writeHistory(items: HistoryItem[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  // Write to a temp file then rename, so a crash mid-write can't corrupt history
  const tmp = FILE + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(items, null, 2), 'utf8')
  await fs.rename(tmp, FILE)
}

// Adds items whose URL isn't already in history. With `replace`, an item for an
// existing URL overwrites it (used when the user explicitly regenerates a memo).
export async function addToHistory(
  incoming: HistoryItem[],
  { replace = false }: { replace?: boolean } = {},
): Promise<{ items: HistoryItem[]; added: HistoryItem[] }> {
  let items = await readHistory()
  const added: HistoryItem[] = []
  for (const item of incoming) {
    const key = normalizeUrl(item.url)
    const existing = items.find((h) => normalizeUrl(h.url) === key)
    if (existing && !replace) continue
    if (existing) items = items.filter((h) => h !== existing)
    items = [item, ...items]
    added.push(item)
  }
  if (added.length > 0) await writeHistory(items)
  return { items, added }
}
