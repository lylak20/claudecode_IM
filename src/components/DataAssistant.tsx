'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

// Chart.js — dynamic import to avoid SSR issues
const ChartComponent = dynamic(
  () => import('./ChartRenderer'),
  { ssr: false, loading: () => <div className="h-48 flex items-center justify-center text-xs text-stone-400">Loading chart…</div> }
)

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartConfig = Record<string, any> | null

interface DataAssistantProps {
  fileContent: string
}

export default function DataAssistant({ fileContent }: DataAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [chartConfig, setChartConfig] = useState<ChartConfig>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)
    setError(null)

    // Include current chart config in the request so Claude can modify it
    const contextMsg = chartConfig
      ? `[Current chart config: ${JSON.stringify(chartConfig)}]\n\nUser request: ${text}`
      : text

    const apiMessages = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: contextMsg },
    ]

    try {
      const res = await fetch('/api/data-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, fileContent }),
      })

      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      // Add assistant reply to chat
      setMessages(prev => [...prev, { role: 'assistant', content: data.message || 'Done.' }])

      // Update chart if returned
      if (data.chartConfig) {
        setChartConfig(data.chartConfig)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setError(msg)
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChart = () => {
    setChartConfig(null)
    setMessages([])
    setError(null)
  }

  const hasFile = !!fileContent?.trim()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100 flex-shrink-0 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Data Assistant</h2>
        {chartConfig && (
          <button
            onClick={clearChart}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Chart area */}
      {chartConfig && (
        <div className="flex-shrink-0 px-3 pt-3 pb-2">
          <div className="bg-white rounded-xl border border-stone-200 p-3" style={{ height: '220px' }}>
            <ChartComponent config={chartConfig} />
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            {hasFile ? (
              <p className="text-xs text-stone-400 leading-relaxed">
                Ask me to chart your data.<br />
                <span className="text-stone-300">e.g. &ldquo;Show user growth&rdquo; or &ldquo;Revenue by quarter&rdquo;</span>
              </p>
            ) : (
              <p className="text-xs text-stone-400 leading-relaxed">
                No data file uploaded.<br />
                <span className="text-stone-300">Go back and attach a Supporting Document on the configure page.</span>
              </p>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-stone-800 text-white rounded-br-sm'
                  : 'bg-stone-100 text-stone-800 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-stone-100 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-stone-100 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasFile ? 'e.g. Show monthly revenue…' : 'Upload a file first…'}
            rows={2}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-stone-800 text-white disabled:opacity-30 hover:bg-stone-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-1.5 pl-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
