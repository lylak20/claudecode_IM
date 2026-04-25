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
  /** Sections that are greyed out and unclickable, with a requirement hint shown. */
  disabledSections?: Set<string>
  /** Subset of sections to render. Defaults to ALL_SECTIONS. */
  sections?: readonly string[]
  /** Heading shown above the list. Defaults to "Choose Sections". */
  title?: string
  /** Subtitle/description under the heading. */
  subtitle?: string
  /** Hide the "Select all / Deselect all" toggle. */
  hideSelectAll?: boolean
}

export default function SectionChecklist({
  selected,
  onToggle,
  notes,
  onNoteChange,
  customContent = {},
  lockedSections = new Set(),
  disabledSections = new Set(),
  sections = ALL_SECTIONS,
  title = 'Choose Sections',
  subtitle = 'Check a section to include it. Add notes to override the default analysis.',
  hideSelectAll = false,
}: SectionChecklistProps) {
  // Count how many of THIS list's sections are currently selected (ignore others)
  const selectedHere = sections.filter(s => selected.has(s)).length
  const allSelected = selectedHere === sections.length

  const toggleAll = () => {
    sections.forEach((s) => {
      const has = selected.has(s)
      if (allSelected && has) onToggle(s)
      if (!allSelected && !has) onToggle(s)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        {!hideSelectAll && sections.length > 1 && (
          <button
            onClick={toggleAll}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>
      <p className="text-xs text-stone-400 mb-4">{subtitle}</p>

      <div className="space-y-3">
        {sections.map((section) => {
          const isSelected = selected.has(section)
          const isLocked = lockedSections.has(section)
          const isDisabled = disabledSections.has(section)
          const hasCustom = section in customContent
          const canInteract = !isLocked && !isDisabled

          return (
            <div key={section} className={`rounded-xl border transition-all ${
              isDisabled ? 'border-stone-100 bg-stone-50/50 opacity-60' :
              isSelected ? 'border-blue-200 bg-blue-50/50' : 'border-stone-200 bg-white'
            }`}>
              {/* Checkbox row */}
              <label className={`flex items-center gap-3 px-4 py-3 select-none ${canInteract ? 'cursor-pointer' : 'cursor-default'}`}>
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                    isSelected && !isDisabled ? 'bg-blue-600 border-blue-600' : 'border-stone-300 bg-white'
                  }`}
                >
                  {isSelected && !isDisabled && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isSelected && !isDisabled}
                  onChange={() => canInteract && onToggle(section)}
                />
                <span className={`text-sm font-medium ${isSelected && !isDisabled ? 'text-blue-900' : 'text-stone-500'}`}>
                  {section}
                </span>
                {isLocked && !isDisabled && (
                  <span className="ml-auto text-xs text-stone-400 italic">
                    {isSelected ? 'auto-enabled' : 'fill fields below to enable'}
                  </span>
                )}
              </label>

              {/* Disabled hint */}
              {isDisabled && (
                <p className="px-4 pb-3 text-xs text-stone-400 italic -mt-1">
                  Only included when a financial supporting document is uploaded.
                </p>
              )}

              {/* Custom content (always shown when not disabled, replaces textarea) */}
              {hasCustom && !isDisabled && (
                <div className="px-4 pb-3">
                  {customContent[section]}
                </div>
              )}

              {/* Notes textarea — only for selected, non-disabled sections without custom content */}
              {isSelected && !isDisabled && !hasCustom && (
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
