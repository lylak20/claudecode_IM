'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FileDropzone from '@/components/FileDropzone'
import SectionChecklist from '@/components/SectionChecklist'
import { ALL_SECTIONS } from '@/lib/types'
import type { ScrapeResult } from '@/lib/types'

export default function ConfigurePage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null)
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(ALL_SECTIONS)
  )
  const [fileContent, setFileContent] = useState('')
  const [fileError, setFileError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const storedUrl = sessionStorage.getItem('lyla_url')
    const storedScrape = sessionStorage.getItem('lyla_scrape')

    if (!storedUrl) {
      router.replace('/')
      return
    }

    setUrl(storedUrl)
    if (storedScrape) {
      try {
        setScrapeResult(JSON.parse(storedScrape))
      } catch {}
    }
  }, [router])

  const toggleSection = (section: string) => {
    setSelectedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const handleFileParsed = (text: string, filename: string) => {
    setFileContent(text)
    setFileError('')
  }

  const handleGenerate = () => {
    if (selectedSections.size === 0) return

    setIsGenerating(true)

    // Order sections as defined in ALL_SECTIONS
    const orderedSections = ALL_SECTIONS.filter((s) => selectedSections.has(s))

    sessionStorage.setItem('lyla_sections', JSON.stringify(orderedSections))
    sessionStorage.setItem('lyla_filetext', fileContent)

    router.push('/memo')
  }

  const companyName = scrapeResult?.companyName || (url ? new URL(url).hostname.replace('www.', '') : '')

  return (
    <main className="min-h-screen bg-stone-50">
      {/* Top bar */}
      <div className="border-b border-stone-200 bg-white px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-stone-500 hover:text-stone-800 text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
        <div className="text-center">
          <span className="font-serif text-lg font-semibold text-stone-800">
            Lyla&rsquo;s Investment Memo
          </span>
        </div>
        <div className="w-16" />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Company header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-900 font-serif">
            {companyName}
          </h1>
          <p className="text-stone-500 text-sm mt-1">{url}</p>
          {scrapeResult?.description && (
            <p className="text-stone-600 text-sm mt-2 max-w-2xl">{scrapeResult.description}</p>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Left — File upload */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 min-h-[400px] flex flex-col">
            <FileDropzone
              onFileParsed={handleFileParsed}
              onError={(msg) => setFileError(msg)}
            />
            {fileError && (
              <p className="mt-2 text-sm text-red-600">{fileError}</p>
            )}
          </div>

          {/* Right — Section checklist */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 overflow-y-auto max-h-[600px]">
            <SectionChecklist
              selected={selectedSections}
              onToggle={toggleSection}
            />
          </div>
        </div>

        {/* Generate button */}
        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={selectedSections.size === 0 || isGenerating}
            className="px-8 py-3.5 bg-stone-900 text-white font-medium rounded-xl hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Preparing…
              </>
            ) : (
              <>
                Generate Memo
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
          </button>
        </div>

        {selectedSections.size === 0 && (
          <p className="text-right text-sm text-red-500 mt-2">
            Select at least one section to continue.
          </p>
        )}
      </div>
    </main>
  )
}
