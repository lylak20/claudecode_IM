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
  const [investmentAmount, setInvestmentAmount] = useState('')
  const [valuation, setValuation] = useState('')

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
    sessionStorage.setItem('lyla_investment_amount', investmentAmount)
    sessionStorage.setItem('lyla_valuation', valuation)
    router.push('/memo')
  }

  const companyName = scrapeResult?.companyName || (url ? (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return '' } })() : '')
  const showReturnsInputs = selectedSections.has('Investment Returns Analysis')

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

        {/* Supporting Document */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-4">
          <h2 className="text-base font-semibold text-stone-900 mb-1">Supporting Document</h2>
          <p className="text-xs text-stone-400 mb-4">Attach financials, pitch deck, or data room files for richer analysis. Required for Unit Economics and Financials sections.</p>
          <FileDropzone
            onFileParsed={(text) => { setFileContent(text); setFileError('') }}
            onError={(msg) => setFileError(msg)}
          />
          {fileError && <p className="mt-2 text-sm text-red-600">{fileError}</p>}
        </div>

        {/* Investment Returns Parameters — shown only when IRA section is selected */}
        {showReturnsInputs && (
          <div className="bg-white rounded-2xl border border-blue-200 p-6 mb-4">
            <h2 className="text-base font-semibold text-stone-900 mb-1 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Investment Returns Parameters
            </h2>
            <p className="text-xs text-stone-400 mb-4">
              Fill in both fields to generate the Investment Returns Analysis with MOIC, IRR, and sensitivity tables. Leave blank to skip this section.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Investment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    value={investmentAmount}
                    onChange={e => setInvestmentAmount(e.target.value)}
                    placeholder="10"
                    className="w-full pl-7 pr-12 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">M</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Pre-Money Valuation
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    value={valuation}
                    onChange={e => setValuation(e.target.value)}
                    placeholder="100"
                    className="w-full pl-7 pr-12 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">M</span>
                </div>
              </div>
            </div>
            {investmentAmount && valuation && (
              <p className="mt-3 text-xs text-blue-600">
                Post-money: ${(parseFloat(investmentAmount) + parseFloat(valuation)).toFixed(1)}M · Ownership: {((parseFloat(investmentAmount) / (parseFloat(investmentAmount) + parseFloat(valuation))) * 100).toFixed(1)}%
              </p>
            )}
          </div>
        )}

        {/* Sections */}
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
