import { NextRequest, NextResponse } from 'next/server'
import { readHistory, writeHistory, addToHistory } from '@/lib/historyStore'
import type { HistoryItem } from '@/lib/history'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ items: await readHistory() })
}

// Body: { item, replace? } to save one memo, or { items } to import many
// (already-known URLs are skipped).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (Array.isArray(body.items)) {
    const { added } = await addToHistory(body.items as HistoryItem[])
    return NextResponse.json({ added: added.length })
  }
  if (!body.item?.url || !body.item?.memoText) {
    return NextResponse.json({ error: 'item with url and memoText required' }, { status: 400 })
  }
  const { items } = await addToHistory([body.item as HistoryItem], { replace: !!body.replace })
  return NextResponse.json({ item: items[0] })
}

// Body: { id, memoText }
export async function PATCH(req: NextRequest) {
  const { id, memoText } = await req.json().catch(() => ({}))
  if (!id || typeof memoText !== 'string') {
    return NextResponse.json({ error: 'id and memoText required' }, { status: 400 })
  }
  const items = await readHistory()
  if (!items.some((h) => h.id === id)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  await writeHistory(items.map((h) => (h.id === id ? { ...h, memoText } : h)))
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const items = await readHistory()
  await writeHistory(items.filter((h) => h.id !== id))
  return NextResponse.json({ ok: true })
}
