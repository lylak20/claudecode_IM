'use client'

import { ALL_SECTIONS } from '@/lib/types'

interface SectionChecklistProps {
  selected: Set<string>
  onToggle: (section: string) => void
  notes: Record<string, string>
  onNoteChange: (section: string, note: string) => void
  /** Replaces the textarea for specific sections. Content is always shown (not just when selected). */
  customContent?: Record<string, React.ReactNode>
  /** Sections whose checkbox cannot be manually toggled (driven by external state). */
  lockedSections?: Set<string>
}

export default function SectionChecklist({
  selected,
  onToggle,
  notes,
  onNoteChange,
  customContent = {},
  lockedSections = new Set(),
}: SectionChecklistProps) {
  const allSelected = selected.size === ALL_SECTIONS.length

  const toggleAll = () => {
    ALL_SECTIONS.forEach((s) => {
      const has = selected.has(s)
      if (allSelected && has) onToggle(s)
      if (!allSelected && !has) onToggle(s)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-stone-900">Choose which sections</h2>
        <button
          onClick={toggleAll}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <p className="text-xs text-stone-400 mb-4">
        Check a section to include it. Add notes to override the default analysis.
      </p>

      <div className="space-y-3">
        {ALL_SECTIONS.map((section) => {
          const isSelected = selected.has(section)
          const isLocked = lockedSections.has(section)
          const hasCustom = section in customContent

          return (
            <div key={section} className={`rounded-xl border transition-all ${isSelected ? 'border-blue-200 bg-blue-50/50' : 'border-stone-200 bg-white'}`}>
              {/* Checkbox row */}
              <label className={`flex items-center gap-3 px-4 py-3 select-none ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}>
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-stone-300 bg-white'
                  } ${isLocked ? 'opacity-80' : ''}`}
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
                  onChange={() => !isLocked && onToggle(section)}
                />
                <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-stone-600'}`}>
                  {section}
                </span>
                {isLocked && (
                  <span className="ml-auto text-xs text-stone-400 italic">
                    {isSelected ? 'auto-enabled' : 'fill fields below to enable'}
                  </span>
                )}
              </label>

              {/* Custom content (always shown, replaces textarea) */}
              {hasCustom && (
                <div className="px-4 pb-3">
                  {customContent[section]}
                </div>
              )}

              {/* Notes textarea — only for selected sections without custom content */}
              {isSelected && !hasCustom && (
                <div className="px-4 pb-3">
                  <textarea
                    value={notes[section] || ''}
                    onChange={(e) => onNoteChange(section, e.target.value)}
                    placeholder="Optional: add specific focus areas or override default analysis…"
                    rows={2}
                    className="w-full text-xs text-stone-700 placeholder-stone-400 bg-white border border-stone-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-300 transition-all"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
