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
    new Set(ALL_SECTIONS.filter(s => s !== 'Unit Economics' && s !== 'Financials'))
  )
  const [sectionNotes, setSectionNotes] = useState<Record<string, string>>({})
  const [fileContent, setFileContent] = useState('')
  const [fileError, setFileError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [investmentAmount, setInvestmentAmount] = useState('')
  const [valuation, setValuation] = useState('')
  const [tone, setTone] = useState<'bullets' | 'prose'>('bullets')

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

  // Auto-check Investment Returns Analysis when both fields are filled, uncheck when either is empty
  useEffect(() => {
    const filled = investmentAmount.trim() !== '' && valuation.trim() !== ''
    setSelectedSections(prev => {
      const next = new Set(prev)
      if (filled) next.add('Investment Returns Analysis')
      else next.delete('Investment Returns Analysis')
      return next
    })
  }, [investmentAmount, valuation])

  // Auto-check Unit Economics + Financials when a file is uploaded; uncheck + disable when removed
  useEffect(() => {
    setSelectedSections(prev => {
      const next = new Set(prev)
      if (fileContent) {
        next.add('Unit Economics')
        next.add('Financials')
      } else {
        next.delete('Unit Economics')
        next.delete('Financials')
      }
      return next
    })
  }, [fileContent])

  const handleGenerate = () => {
    if (selectedSections.size === 0) return
    setIsGenerating(true)
    const orderedSections = ALL_SECTIONS.filter((s) => selectedSections.has(s))
    sessionStorage.setItem('lyla_sections', JSON.stringify(orderedSections))
    sessionStorage.setItem('lyla_filetext', fileContent)
    sessionStorage.setItem('lyla_section_notes', JSON.stringify(sectionNotes))
    sessionStorage.setItem('lyla_investment_amount', investmentAmount)
    sessionStorage.setItem('lyla_valuation', valuation)
    sessionStorage.setItem('lyla_tone', tone)
    router.push('/memo')
  }

  const companyName = scrapeResult?.companyName || (url ? (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return '' } })() : '')

  // Inline content for Investment Returns Analysis section
  const iraContent = (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">Fill in both fields to enable this section. Leave blank to skip.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">Investment Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-medium">$</span>
            <input
              type="number"
              min="0"
              value={investmentAmount}
              onChange={e => setInvestmentAmount(e.target.value)}
              placeholder="10"
              className="w-full pl-7 pr-8 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">M</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">Pre-Money Valuation</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-medium">$</span>
            <input
              type="number"
              min="0"
              value={valuation}
              onChange={e => setValuation(e.target.value)}
              placeholder="100"
              className="w-full pl-7 pr-8 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">M</span>
          </div>
        </div>
      </div>
      {investmentAmount && valuation && (
        <p className="text-xs text-blue-600">
          Post-money: ${(parseFloat(investmentAmount) + parseFloat(valuation)).toFixed(1)}M · Ownership: {((parseFloat(investmentAmount) / (parseFloat(investmentAmount) + parseFloat(valuation))) * 100).toFixed(1)}%
        </p>
      )}
      <textarea
        value={sectionNotes['Investment Returns Analysis'] || ''}
        onChange={e => handleNoteChange('Investment Returns Analysis', e.target.value)}
        placeholder="Optional: add specific focus areas or override default analysis…"
        rows={2}
        className="w-full text-xs text-stone-700 placeholder-stone-400 bg-white border border-stone-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-300 transition-all"
      />
    </div>
  )

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

        {/* Sections */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-4">
          <SectionChecklist
            selected={selectedSections}
            onToggle={toggleSection}
            notes={sectionNotes}
            onNoteChange={handleNoteChange}
            customContent={{ 'Investment Returns Analysis': iraContent }}
            lockedSections={new Set(['Investment Returns Analysis'])}
            disabledSections={fileContent ? new Set() : new Set(['Unit Economics', 'Financials'])}
          />
        </div>

        {/* Writing Style */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-stone-900 mb-1">Writing Style</h2>
          <p className="text-xs text-stone-400 mb-4">Choose how the memo should read.</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTone('bullets')}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                tone === 'bullets'
                  ? 'border-stone-800 bg-stone-50'
                  : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-stone-800">Bullet Point Notes</span>
                {tone === 'bullets' && (
                  <span className="w-4 h-4 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">Scannable bullets, numbers up front — fast to read and easy to skim in a meeting.</p>
            </button>

            <button
              type="button"
              onClick={() => setTone('prose')}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                tone === 'prose'
                  ? 'border-stone-800 bg-stone-50'
                  : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-stone-800">Narrative Memo</span>
                {tone === 'prose' && (
                  <span className="w-4 h-4 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">Full sentences with professional IC-ready prose — best for formal presentations.</p>
            </button>
          </div>
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
