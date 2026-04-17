'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMemoStream } from '@/hooks/useMemoStream'
import MemoDisplay from '@/components/MemoDisplay'
import IRACalculator from '@/components/IRACalculator'
import UnitEconomicsCharts from '@/components/UnitEconomicsCharts'
import type { ChartSpec } from '@/components/UnitEconomicsCharts'
import HistorySidebar from '@/components/HistorySidebar'
import AiChat from '@/components/AiChat'
import DataAssistant from '@/components/DataAssistant'
import { saveToHistory, updateHistoryMemoText } from '@/lib/history'
import type { HistoryItem } from '@/lib/history'
import type { MemoConfig, ScrapeResult } from '@/lib/types'

type Phase = 'researching' | 'generating' | 'done' | 'error'

const RESEARCH_STEPS = [
  'Scraping company website & subpages…',
  'Searching recent news…',
  'Scanning Reddit & Hacker News…',
  'Building research brief…',
]

export default function MemoPage() {
  const router = useRouter()
  const { memoText, isStreaming, error, startStream } = useMemoStream()
  const [companyName, setCompanyName] = useState('')
  const [phase, setPhase] = useState<Phase>('researching')
  const [researchStep, setResearchStep] = useState(0)
  const [fileContent, setFileContent] = useState('')
  const [currentHistoryId, setCurrentHistoryId] = useState<string | undefined>()
  const [historySaved, setHistorySaved] = useState(false)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [activeTab, setActiveTab] = useState<'ai' | 'data'>('ai')

  // History mode: viewing a saved memo instead of streaming a new one
  const [historyMode, setHistoryMode] = useState(false)
  const [historyMemoText, setHistoryMemoText] = useState('')

  // Allows overriding memoText after user edits a freshly generated memo
  const [memoOverride, setMemoOverride] = useState<string | null>(null)

  // Edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  // AI Chat selection
  const [selectedText, setSelectedText] = useState('')
  const memoContainerRef = useRef<HTMLDivElement>(null)

  // Floating "Ask AI" button position
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  // IRA calculator params (parsed from memo marker)
  const [iraData, setIraData] = useState<{
    entryRevenue: number
    investmentAmount: number
    valuation: number
  } | null>(null)

  // useRef guard — prevents React 18 StrictMode from calling startStream twice
  const startedRef = useRef(false)

  const displayText = historyMode ? historyMemoText : (memoOverride ?? memoText)
  const displayCompany = companyName
  const activePhase = historyMode ? 'done' : phase

  // ── Parse memo into segments (markdown / ue-charts / fin-charts / ira) ──────
  type Segment =
    | { type: 'markdown'; text: string }
    | { type: 'ue-charts'; charts: ChartSpec[] }
    | { type: 'fin-charts'; charts: ChartSpec[] }
    | { type: 'peer-charts'; charts: ChartSpec[] }
    | { type: 'ira'; data: { entryRevenue: number; investmentAmount: number; valuation: number } }

  const IRA_RE = /<!--\s*IRA_CALCULATOR:(\{[\s\S]*?\})\s*-->/
  const UE_RE = /<ue-charts>([\s\S]*?)<\/ue-charts>/
  const FIN_RE = /<fin-charts>([\s\S]*?)<\/fin-charts>/
  const PEER_RE = /<peer-charts>([\s\S]*?)<\/peer-charts>/

  function parseSegments(text: string): Segment[] {
    const out: Segment[] = []
    let remaining = text

    while (remaining.length > 0) {
      const iraMatch = IRA_RE.exec(remaining)
      const ueMatch = UE_RE.exec(remaining)
      const finMatch = FIN_RE.exec(remaining)
      const peerMatch = PEER_RE.exec(remaining)

      const iraIdx = iraMatch ? iraMatch.index : Infinity
      const ueIdx = ueMatch ? ueMatch.index : Infinity
      const finIdx = finMatch ? finMatch.index : Infinity
      const peerIdx = peerMatch ? peerMatch.index : Infinity

      const minIdx = Math.min(ueIdx, finIdx, peerIdx, iraIdx)

      if (minIdx === Infinity) {
        out.push({ type: 'markdown', text: remaining })
        break
      }

      if (minIdx > 0) out.push({ type: 'markdown', text: remaining.slice(0, minIdx) })

      if (minIdx === ueIdx && ueMatch) {
        try {
          const charts = JSON.parse(ueMatch[1].trim()) as ChartSpec[]
          if (Array.isArray(charts) && charts.length > 0) out.push({ type: 'ue-charts', charts })
        } catch { /* malformed JSON — skip */ }
        remaining = remaining.slice(ueMatch.index + ueMatch[0].length)
      } else if (minIdx === finIdx && finMatch) {
        try {
          const charts = JSON.parse(finMatch[1].trim()) as ChartSpec[]
          if (Array.isArray(charts) && charts.length > 0) out.push({ type: 'fin-charts', charts })
        } catch { /* malformed JSON — skip */ }
        remaining = remaining.slice(finMatch.index + finMatch[0].length)
      } else if (minIdx === peerIdx && peerMatch) {
        try {
          const charts = JSON.parse(peerMatch[1].trim()) as ChartSpec[]
          if (Array.isArray(charts) && charts.length > 0) out.push({ type: 'peer-charts', charts })
        } catch { /* malformed JSON — skip */ }
        remaining = remaining.slice(peerMatch.index + peerMatch[0].length)
      } else if (minIdx === iraIdx && iraMatch) {
        try {
          const data = JSON.parse(iraMatch[1]) as { entryRevenue: number; investmentAmount: number; valuation: number }
          out.push({ type: 'ira', data })
        } catch { /* malformed JSON — skip */ }
        remaining = remaining.slice(iraMatch.index + iraMatch[0].length)
      }
    }

    return out
  }

  const segments = parseSegments(displayText)

  // Auto-grow textarea height as content changes
  useEffect(() => {
    const el = editTextareaRef.current
    if (!el || !isEditing) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [editText, isEditing])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const url = sessionStorage.getItem('lyla_url')
    const sectionsRaw = sessionStorage.getItem('lyla_sections')
    const scrapeRaw = sessionStorage.getItem('lyla_scrape')
    const fileContent = sessionStorage.getItem('lyla_filetext') || undefined
    const sectionNotesRaw = sessionStorage.getItem('lyla_section_notes')
    setFileContent(fileContent || '')
    const investmentAmount = sessionStorage.getItem('lyla_investment_amount') || undefined
    const valuation = sessionStorage.getItem('lyla_valuation') || undefined
    const tone = (sessionStorage.getItem('lyla_tone') || 'prose') as 'bullets' | 'prose'

    if (!url || !sectionsRaw) {
      router.replace('/')
      return
    }

    let sections: string[] = []
    let scrapeResult: ScrapeResult | undefined

    try { sections = JSON.parse(sectionsRaw) } catch {}
    try { if (scrapeRaw) scrapeResult = JSON.parse(scrapeRaw) } catch {}

    let sectionNotes: Record<string, string> = {}
    try { if (sectionNotesRaw) sectionNotes = JSON.parse(sectionNotesRaw) } catch {}

    const name = scrapeResult?.companyName || (() => {
      try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
    })()
    setCompanyName(name)

    const run = async () => {
      try {
        setPhase('researching')
        let stepIdx = 0
        const stepTimer = setInterval(() => {
          stepIdx = Math.min(stepIdx + 1, RESEARCH_STEPS.length - 1)
          setResearchStep(stepIdx)
        }, 1800)

        const researchRes = await fetch('/api/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            companyName: name,
            homepageHtml: scrapeResult?.rawText || '',
          }),
        })
        clearInterval(stepTimer)
        setResearchStep(RESEARCH_STEPS.length - 1)

        const resData = await researchRes.json().catch(() => ({ research: '', screenshotUrls: {} }))
        const research = resData.research || ''
        const screenshotUrls = resData.screenshotUrls || {}

        setPhase('generating')
        const config: MemoConfig = {
          url,
          sections,
          sectionNotes,
          scrapeResult,
          fileContent: fileContent || undefined,
          research: research || '',
          investmentAmount,
          valuation,
          screenshotUrls,
          tone,
        }
        await startStream(config)
        setPhase('done')
      } catch {
        setPhase('error')
      }
    }

    run()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save to history once streaming is done
  useEffect(() => {
    if (phase === 'done' && memoText && companyName && !historySaved && !historyMode) {
      const url = sessionStorage.getItem('lyla_url') || ''
      const saved = saveToHistory({
        companyName,
        url,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        memoText,
      })
      setCurrentHistoryId(saved.id)
      setHistorySaved(true)
      setHistoryRefresh(n => n + 1)
    }
  }, [phase, memoText, companyName, historySaved, historyMode])

  // Auto-enter edit mode once streaming finishes (so memo is immediately editable)
  useEffect(() => {
    if (phase === 'done' && memoText && !historyMode && !isEditing) {
      setEditText(memoText)
      setIsEditing(true)
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── CSS Custom Highlight helper (Chrome/Edge ≥ 105) ──────────────────────
  const applyCSSHighlight = useCallback((range: Range) => {
    if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = new (window as any).Highlight(range.cloneRange())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(CSS as any).highlights.set('memo-selection', h)
  }, [])

  const clearCSSHighlight = useCallback(() => {
    if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(CSS as any).highlights.delete('memo-selection')
  }, [])

  // Text selection detection — disabled in edit mode
  const handleMouseUp = useCallback(() => {
    if (isEditing) return
    const selection = window.getSelection()
    const text = selection?.toString().trim() || ''
    if (text.length > 10 && memoContainerRef.current?.contains(selection?.anchorNode ?? null)) {
      const range = selection!.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelectedText(text)
      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
      // Persist the highlight visually even after the native selection clears
      applyCSSHighlight(range)
    }
    // Do NOT clear tooltip/selectedText on empty selection — let it persist
    // until the user explicitly dismisses or makes a new selection
  }, [isEditing, applyCSSHighlight])

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseUp])

  const handleAskAI = () => {
    setTooltipPos(null)
    // Keep CSS highlight so user can still see what they selected while chatting
    // It clears when they make a new selection
  }

  // Clicking inside memo re-triggers handleMouseUp; clicking the memo background
  // (not on text) clears the persisted highlight
  const handleMemoClick = useCallback((e: React.MouseEvent) => {
    const sel = window.getSelection()
    if (!sel || sel.toString().trim().length === 0) {
      clearCSSHighlight()
      setSelectedText('')
      setTooltipPos(null)
    }
  }, [clearCSSHighlight])

  const handleApplySuggestion = (original: string, replacement: string) => {
    const newText = displayText.includes(original)
      ? displayText.replace(original, replacement)
      : displayText + '\n\n' + replacement // fallback: append if original not found
    if (historyMode) {
      setHistoryMemoText(newText)
    } else {
      setMemoOverride(newText)
    }
    if (currentHistoryId) {
      updateHistoryMemoText(currentHistoryId, newText)
    }
  }

  const handleHistorySelect = (item: HistoryItem) => {
    setIsEditing(false)
    setHistoryMode(true)
    setHistoryMemoText(item.memoText)
    setCompanyName(item.companyName)
    setCurrentHistoryId(item.id)
  }

  // ── Edit mode handlers ───────────────────────────────────────────
  const handleStartEdit = () => {
    setEditText(displayText)
    setIsEditing(true)
    setTooltipPos(null)
    // Focus after React renders
    setTimeout(() => editTextareaRef.current?.focus(), 50)
  }

  const handleSaveEdit = () => {
    const trimmed = editText.trim()
    // Push edited text back into the right state
    if (historyMode) {
      setHistoryMemoText(trimmed)
    } else {
      setMemoOverride(trimmed)
    }
    // Persist to localStorage
    if (currentHistoryId) {
      updateHistoryMemoText(currentHistoryId, trimmed)
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditText('')
  }

  const handleStartOver = () => {
    sessionStorage.removeItem('lyla_url')
    sessionStorage.removeItem('lyla_scrape')
    sessionStorage.removeItem('lyla_sections')
    sessionStorage.removeItem('lyla_filetext')
    sessionStorage.removeItem('lyla_section_notes')
    router.push('/')
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .memo-card { box-shadow: none; border: none; padding: 0; }
        }
        .edit-textarea {
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 0.9375rem;
          line-height: 1.75;
          color: #1c1917;
          caret-color: #3b82f6;
        }
        .edit-textarea::selection {
          background: #dbeafe;
        }
        /* Persistent CSS Custom Highlight (Chrome/Edge ≥105) */
        ::highlight(memo-selection) {
          background-color: #bfdbfe;
          color: inherit;
        }
        /* Hide number input spin buttons */
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>

      <div className="h-screen flex flex-col overflow-hidden bg-stone-50">
        {/* Top bar */}
        <div className="no-print border-b border-stone-200 bg-white px-6 py-3 flex items-center justify-between flex-shrink-0 z-10">
          <button
            onClick={() => router.push('/configure')}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-800 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          <span className="font-serif text-lg font-semibold text-stone-800">
            Lyla&rsquo;s Investment Memo
          </span>
          <div className="flex items-center gap-3">
            {activePhase === 'done' && displayText && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-stone-700 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Export PDF
              </button>
            )}
            <button
              onClick={handleStartOver}
              className="px-3 py-1.5 text-sm font-medium text-white bg-stone-800 rounded-lg hover:bg-stone-700 transition-colors"
            >
              New Memo
            </button>
          </div>
        </div>

        {/* Four-column body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: History sidebar */}
          <div className="no-print w-48 border-r border-stone-200 bg-white flex-shrink-0 overflow-hidden flex flex-col">
            <HistorySidebar
              currentId={currentHistoryId}
              onSelect={handleHistorySelect}
              refreshTrigger={historyRefresh}
            />
          </div>

          {/* Middle: Memo content */}
          <div className="flex-1 overflow-y-auto" ref={memoContainerRef} onClick={handleMemoClick}>
            <div className="max-w-3xl mx-auto px-6 py-8">

              {/* Memo header */}
              <div className="mb-6">
                <div className="text-xs font-semibold tracking-widest text-stone-400 uppercase mb-1">
                  Investment Memo
                </div>
                <h1 className="font-serif text-3xl font-bold text-stone-900">{displayCompany}</h1>
                <p className="text-stone-500 text-sm mt-1">
                  {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Memo content card */}
              <div className="memo-card bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">

                {/* Edit toolbar — only when done */}
                {activePhase === 'done' && displayText && (
                  <div className="no-print flex items-center justify-between px-8 py-3 border-b border-stone-100 bg-stone-50">
                    {isEditing ? (
                      <>
                        <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Editing memo
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 text-xs text-stone-500 hover:text-stone-800 border border-stone-200 rounded-md hover:bg-white transition-colors"
                          >
                            Preview
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Save
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-stone-400">Previewing rendered memo</span>
                        <button
                          onClick={handleStartEdit}
                          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-stone-600 border border-stone-200 rounded-md hover:bg-white hover:border-stone-300 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Edit memo
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="px-8 py-8">
                  {/* Research phase */}
                  {!historyMode && phase === 'researching' && (
                    <div className="py-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin flex-shrink-0" />
                        <span className="text-sm font-medium text-stone-700">Researching {companyName}…</span>
                      </div>
                      <div className="space-y-3 pl-8">
                        {RESEARCH_STEPS.map((step, i) => (
                          <div
                            key={step}
                            className={`flex items-center gap-2 text-sm transition-all duration-500 ${
                              i < researchStep
                                ? 'text-emerald-600'
                                : i === researchStep
                                ? 'text-stone-700'
                                : 'text-stone-300'
                            }`}
                          >
                            {i < researchStep ? (
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : i === researchStep ? (
                              <div className="w-4 h-4 border border-stone-400 border-t-stone-700 rounded-full animate-spin flex-shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-stone-200 flex-shrink-0" />
                            )}
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generating phase */}
                  {!historyMode && phase === 'generating' && !memoText && (
                    <div className="flex items-center gap-3 text-stone-500 py-4">
                      <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                      <span className="text-sm">Writing memo…</span>
                    </div>
                  )}

                  {/* Error state */}
                  {!historyMode && (phase === 'error' || error) && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                      <p className="text-sm font-medium text-red-800 mb-1">Generation failed</p>
                      <p className="text-sm text-red-700">{error || 'Something went wrong.'}</p>
                      <button
                        onClick={() => router.push('/configure')}
                        className="mt-3 text-sm text-red-700 underline hover:text-red-900"
                      >
                        Go back and try again
                      </button>
                    </div>
                  )}

                  {/* Edit mode: raw markdown textarea */}
                  {isEditing && (
                    <textarea
                      ref={editTextareaRef}
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="edit-textarea w-full resize-none outline-none bg-transparent border-0 p-0 m-0"
                      style={{ minHeight: '500px' }}
                      spellCheck
                    />
                  )}

                  {/* Read mode: render segments (markdown / charts / IRA calculator) */}
                  {!isEditing && displayText && (
                    <>
                      {segments.map((seg, i) => {
                        if (seg.type === 'markdown') {
                          const isLast = i === segments.length - 1
                          return (
                            <MemoDisplay
                              key={i}
                              text={seg.text}
                              isStreaming={isLast && !historyMode && isStreaming}
                            />
                          )
                        }
                        if (seg.type === 'ue-charts') {
                          return <UnitEconomicsCharts key={i} charts={seg.charts} />
                        }
                        if (seg.type === 'fin-charts') {
                          return <UnitEconomicsCharts key={i} charts={seg.charts} label="Financial Charts — auto-generated from uploaded data" />
                        }
                        if (seg.type === 'peer-charts') {
                          return <UnitEconomicsCharts key={i} charts={seg.charts} label="Peer Valuation Benchmarking — sourced from research data" />
                        }
                        if (seg.type === 'ira') {
                          return (
                            <IRACalculator
                              key={i}
                              investmentAmount={Number(seg.data.investmentAmount)}
                              preMoneyValuation={Number(seg.data.valuation)}
                              entryRevenue={Number(seg.data.entryRevenue)}
                            />
                          )
                        }
                        return null
                      })}
                    </>
                  )}
                </div>
              </div>

              {activePhase === 'done' && displayText && (
                <div className="no-print mt-6 flex justify-center">
                  <button
                    onClick={handleStartOver}
                    className="text-sm text-stone-500 hover:text-stone-800 underline transition-colors"
                  >
                    Analyze another company →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: tabbed AI Assistant / Data Assistant */}
          <div className="no-print w-80 border-l border-stone-200 bg-white flex-shrink-0 flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="flex flex-shrink-0 border-b border-stone-200 bg-stone-50">
              <button
                onClick={() => setActiveTab('ai')}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === 'ai'
                    ? 'bg-white text-stone-900 border-b-2 border-stone-800'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                AI Assistant
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === 'data'
                    ? 'bg-white text-stone-900 border-b-2 border-stone-800'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Data Assistant
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {activeTab === 'ai' ? (
                <AiChat
                  memoText={displayText}
                  companyName={displayCompany}
                  selectedText={selectedText}
                  onClearSelection={() => setSelectedText('')}
                  onApplySuggestion={handleApplySuggestion}
                />
              ) : (
                <DataAssistant fileContent={fileContent} />
              )}
            </div>
          </div>
        </div>

        {/* Floating "Ask AI" tooltip on text selection */}
        {tooltipPos && !isEditing && (
          <div
            className="no-print fixed z-50 transform -translate-x-1/2 -translate-y-full"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <button
              onClick={handleAskAI}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white text-xs font-medium rounded-full shadow-lg hover:bg-stone-700 transition-colors whitespace-nowrap"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Ask AI
            </button>
          </div>
        )}
      </div>
    </>
  )
}
