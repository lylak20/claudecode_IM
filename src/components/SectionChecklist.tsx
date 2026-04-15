'use client'

import { ALL_SECTIONS } from '@/lib/types'

interface SectionChecklistProps {
  selected: Set<string>
  onToggle: (section: string) => void
}

export default function SectionChecklist({ selected, onToggle }: SectionChecklistProps) {
  const allSelected = selected.size === ALL_SECTIONS.length

  const toggleAll = () => {
    if (allSelected) {
      ALL_SECTIONS.forEach((s) => {
        if (selected.has(s)) onToggle(s)
      })
    } else {
      ALL_SECTIONS.forEach((s) => {
        if (!selected.has(s)) onToggle(s)
      })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-900">Memo Sections</h2>
        <button
          onClick={toggleAll}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Choose which sections to include in the memo.
      </p>

      <div className="grid grid-cols-1 gap-2">
        {ALL_SECTIONS.map((section) => {
          const isSelected = selected.has(section)
          return (
            <label
              key={section}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                  isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                }`}
              >
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={isSelected}
                onChange={() => onToggle(section)}
              />
              <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                {section}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
