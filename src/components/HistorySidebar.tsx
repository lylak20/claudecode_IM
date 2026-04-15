'use client'

import { useEffect, useState } from 'react'
import { loadHistory, deleteFromHistory } from '@/lib/history'
import type { HistoryItem } from '@/lib/history'

interface HistorySidebarProps {
  currentId?: string
  onSelect: (item: HistoryItem) => void
  refreshTrigger?: number
}

export default function HistorySidebar({ currentId, onSelect, refreshTrigger }: HistorySidebarProps) {
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    setHistory(loadHistory())
  }, [refreshTrigger])

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteFromHistory(id)
    setHistory(loadHistory())
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-stone-100 flex-shrink-0">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">History</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-stone-400">Memos you generate will appear here.</p>
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              className={`px-4 py-3 cursor-pointer border-b border-stone-100 group transition-colors ${
                currentId === item.id
                  ? 'bg-blue-50 border-l-2 border-l-blue-400'
                  : 'hover:bg-stone-50'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-800 truncate">{item.companyName}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{item.date}</p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, item.id)}
                  className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-400 flex-shrink-0 mt-0.5 transition-all"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
