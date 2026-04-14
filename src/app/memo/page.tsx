'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMemoStream } from '@/hooks/useMemoStream'
import MemoDisplay from '@/components/MemoDisplay'
import type { MemoConfig, ScrapeResult } from '@/lib/types'

export default function MemoPage() {
  const router = useRouter()
  const { memoText, isStreaming, error, startStream } = useMemoStream()
  const [companyName, setCompanyName] = useState('')
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    const url = sessionStorage.getItem('lyla_url')
    const sectionsRaw = sessionStorage.getItem('lyla_sections')
    const scrapeRaw = sessionStorage.getItem('lyla_scrape')
    const fileContent = sessionStorage.getItem('lyla_filetext') || undefined

    if (!url || !sectionsRaw) {
      router.replace('/')
      return
    }

    let sections: string[] = []
    let scrapeResult: ScrapeResult | undefined

    try {
      sections = JSON.parse(sectionsRaw)
    } catch {}

    try {
      if (scrapeRaw) scrapeResult = JSON.parse(scrapeRaw)
    } catch {}

    if (scrapeResult?.companyName) {
      setCompanyName(scrapeResult.companyName)
    } else {
      try {
        setCompanyName(new URL(url).hostname.replace('www.', ''))
      } catch {}
    }

    const config: MemoConfig = {
      url,
      sections,
      scrapeResult,
      fileContent: fileContent || undefined,
    }

    setHasStarted(true)
    startStream(config)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartOver = () => {
    sessionStorage.removeItem('lyla_url')
    sessionStorage.removeItem('lyla_scrape')
    sessionStorage.removeItem('lyla_sections')
    sessionStorage.removeItem('lyla_filetext')
    router.push('/')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .memo-card { box-shadow: none; border: none; padding: 0; }
        }
      `}</style>

      <main className="min-h-screen bg-stone-50">
        {/* Top bar */}
        <div className="no-print border-b border-stone-200 bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
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
            {!isStreaming && memoText && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-700 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Export PDF
              </button>
            )}
            <button
              onClick={handleStartOver}
              className="px-4 py-2 text-sm font-medium text-white bg-stone-800 rounded-lg hover:bg-stone-700 transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-10">
          {/* Memo header */}
          <div className="mb-8">
            <div className="text-xs font-semibold tracking-widest text-stone-400 uppercase mb-2">
              Investment Memo
            </div>
            <h1 className="font-serif text-3xl font-bold text-stone-900">{companyName}</h1>
            <p className="text-stone-500 text-sm mt-1">
              {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Memo content */}
          <div className="memo-card bg-white rounded-2xl border border-stone-200 shadow-sm px-10 py-10">
            {!hasStarted && (
              <div className="flex items-center gap-3 text-stone-500">
                <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                <span className="text-sm">Initializing…</span>
              </div>
            )}

            {isStreaming && !memoText && (
              <div className="flex items-center gap-3 text-stone-500">
                <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                <span className="text-sm">Generating investment memo…</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <p className="text-sm font-medium text-red-800 mb-1">Generation failed</p>
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={() => router.push('/configure')}
                  className="mt-3 text-sm text-red-700 underline hover:text-red-900"
                >
                  Go back and try again
                </button>
              </div>
            )}

            {memoText && (
              <MemoDisplay text={memoText} isStreaming={isStreaming} />
            )}
          </div>

          {!isStreaming && memoText && (
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
      </main>
    </>
  )
}
