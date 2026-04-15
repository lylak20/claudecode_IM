'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMemoStream } from '@/hooks/useMemoStream'
import MemoDisplay from '@/components/MemoDisplay'
import HistorySidebar from '@/components/HistorySidebar'
import AiChat from '@/components/AiChat'
import DataAssistant from '@/components/DataAssistant'
import { saveToHistory } from '@/lib/history'
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

  // History mode: viewing a saved memo instead of streaming a new one
  const [historyMode, setHistoryMode] = useState(false)
  const [historyMemoText, setHistoryMemoText] = useState('')

  // AI Chat selection
  const [selectedText, setSelectedText] = useState('')
  const memoContainerRef = useRef<HTMLDivElement>(null)

  // Floating "Ask AI" button position
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  // useRef guard — prevents React 18 StrictMode from calling startStream twice
  const startedRef = useRef(false)

  const displayText = historyMode ? historyMemoText : memoText
  const displayCompany = companyName

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const url = sessionStorage.getItem('lyla_url')
    const sectionsRaw = sessionStorage.getItem('lyla_sections')
    const scrapeRaw = sessionStorage.getItem('lyla_scrape')
    const fileContent = sessionStorage.getItem('lyla_filetext') || undefined
    const sectionNotesRaw = sessionStorage.getItem('lyla_section_notes')
    setFileContent(fileContent || '')

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

        const { research } = await researchRes.json().catch(() => ({ research: '' }))

        setPhase('generating')
        const config: MemoConfig = {
          url,
          sections,
          sectionNotes,
          scrapeResult,
          fileContent: fileContent || undefined,
          research: research || '',
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

  // Text selection detection
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim() || ''
    if (text.length > 10 && memoContainerRef.current?.contains(selection?.anchorNode ?? null)) {
      const range = selection!.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelectedText(text)
      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
    } else {
      setTooltipPos(null)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseUp])

  const handleAskAI = () => {
    setTooltipPos(null)
    // selectedText is already set — AiChat will pick it up via prop
  }

  const handleHistorySelect = (item: HistoryItem) => {
    setHistoryMode(true)
    setHistoryMemoText(item.memoText)
    setCompanyName(item.companyName)
    setCurrentHistoryId(item.id)
  }

  const handleStartOver = () => {
    sessionStorage.removeItem('lyla_url')
    sessionStorage.removeItem('lyla_scrape')
    sessionStorage.removeItem('lyla_sections')
    sessionStorage.removeItem('lyla_filetext')
    sessionStorage.removeItem('lyla_section_notes')
    router.push('/')
  }

  const activePhase = historyMode ? 'done' : phase

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .memo-card { box-shadow: none; border: none; padding: 0; }
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

        {/* Three-column body */}
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
          <div className="flex-1 overflow-y-auto" ref={memoContainerRef}>
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
              <div className="memo-card bg-white rounded-2xl border border-stone-200 shadow-sm px-8 py-8">

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

                {/* Generating phase (before first chunk arrives) */}
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

                {/* Memo text */}
                {displayText && (
                  <MemoDisplay text={displayText} isStreaming={!historyMode && isStreaming} />
                )}
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

          {/* Right: AI Chat */}
          <div className="no-print w-72 border-l border-stone-200 bg-white flex-shrink-0 flex flex-col overflow-hidden">
            <AiChat
              memoText={displayText}
              companyName={displayCompany}
              selectedText={selectedText}
              onClearSelection={() => setSelectedText('')}
            />
          </div>

          {/* Far right: Data Assistant */}
          <div className="no-print w-80 border-l border-stone-200 bg-white flex-shrink-0 flex flex-col overflow-hidden">
            <DataAssistant fileContent={fileContent} />
          </div>
        </div>

        {/* Floating "Ask AI" tooltip on text selection */}
        {tooltipPos && (
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
