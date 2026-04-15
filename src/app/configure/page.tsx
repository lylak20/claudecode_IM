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
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(ALL_SECTIONS))
  const [sectionNotes, setSectionNotes] = useState<Record<string, string>>({})
  const [fileContent, setFileContent] = useState('')
  const [fileError, setFileError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const storedUrl = sessionStorage.getItem('lyla_url')
    const storedScrape = sessionStorage.getItem('lyla_scrape')
    if (!storedUrl) { router.replace('/'); return }
    setUrl(storedUrl)
    if (storedScrape) {
      try { setScrapeResult(JSON.parse(storedScrape)) } catch {}
    }
  }, [router])

  const toggleSection = (section: string) => {
    setSelectedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const handleNoteChange = (section: string, note: string) => {
    setSectionNotes((prev) => ({ ...prev, [section]: note }))
  }

  const handleGenerate = () => {
    if (selectedSections.size === 0) return
    setIsGenerating(true)
    const orderedSections = ALL_SECTIONS.filter((s) => selectedSections.has(s))
    sessionStorage.setItem('lyla_sections', JSON.stringify(orderedSections))
    sessionStorage.setItem('lyla_filetext', fileContent)
    sessionStorage.setItem('lyla_section_notes', JSON.stringify(sectionNotes))
    router.push('/memo')
  }

  const companyName = scrapeResult?.companyName || (url ? (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return '' } })() : '')

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
        <span className="font-serif text-lg font-semibold text-stone-800">
          Lyla&rsquo;s Investment Memo
        </span>
        <div className="w-16" />
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Company header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900 font-serif">{companyName}</h1>
          <p className="text-stone-400 text-sm mt-1">{url}</p>
          {scrapeResult?.description && (
            <p className="text-stone-600 text-sm mt-2">{scrapeResult.description}</p>
          )}
        </div>

        {/* Supporting Document — top */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-4">
          <h2 className="text-base font-semibold text-stone-900 mb-1">Supporting Document</h2>
          <p className="text-xs text-stone-400 mb-4">Attach financials, pitch deck, or data room files for richer analysis.</p>
          <FileDropzone
            onFileParsed={(text) => { setFileContent(text); setFileError('') }}
            onError={(msg) => setFileError(msg)}
          />
          {fileError && <p className="mt-2 text-sm text-red-600">{fileError}</p>}
        </div>

        {/* Sections — below */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
          <SectionChecklist
            selected={selectedSections}
            onToggle={toggleSection}
            notes={sectionNotes}
            onNoteChange={handleNoteChange}
          />
        </div>

        {/* Generate button */}
        <div className="flex justify-end">
          {selectedSections.size === 0 && (
            <p className="text-sm text-red-500 mr-4 self-center">Select at least one section.</p>
          )}
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
      </div>
    </main>
  )
}
