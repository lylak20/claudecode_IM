'use client'

import { useEffect, useRef, useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AiChatProps {
  memoText: string
  companyName: string
  selectedText: string
  onClearSelection: () => void
}

export default function AiChat({ memoText, companyName, selectedText, onClearSelection }: AiChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // When selectedText changes, pre-fill input with context
  useEffect(() => {
    if (selectedText) {
      setInput(`Regarding this part of the memo:\n\n"${selectedText}"\n\n`)
      textareaRef.current?.focus()
    }
  }, [selectedText])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    onClearSelection()
    setIsStreaming(true)

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          memoText,
          companyName,
        }),
      })

      if (!res.ok || !res.body) throw new Error('Chat request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + chunk }
          }
          return updated
        })
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant' && last.content === '') {
          updated[updated.length - 1] = { ...last, content: 'Something went wrong. Please try again.' }
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100 flex-shrink-0">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">AI Assistant</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              Ask follow-up questions or highlight text in the memo to refine it.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-stone-800 text-white rounded-br-sm'
                  : 'bg-stone-100 text-stone-800 rounded-bl-sm'
              }`}
            >
              {msg.content}
              {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && msg.content === '' && (
                <span className="inline-block w-2 h-4 bg-stone-400 animate-pulse rounded-sm ml-0.5" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Selected text indicator */}
      {selectedText && (
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between gap-2 flex-shrink-0">
          <p className="text-xs text-blue-700 truncate flex-1">
            <span className="font-medium">Highlighted:</span> &ldquo;{selectedText.slice(0, 60)}{selectedText.length > 60 ? '…' : ''}&rdquo;
          </p>
          <button
            onClick={onClearSelection}
            className="text-blue-400 hover:text-blue-600 flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-stone-100 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the memo…"
            rows={2}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
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
