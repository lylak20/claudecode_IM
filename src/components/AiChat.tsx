'use client'

import { useEffect, useRef, useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  /** The memo text that was highlighted when this message was sent */
  selectionContext?: string
}

type SuggestionState = 'applied' | 'dismissed'

interface AiChatProps {
  memoText: string
  companyName: string
  selectedText: string
  onClearSelection: () => void
  onApplySuggestion: (original: string, replacement: string) => void
}

// Pull out text inside <replacement>...</replacement> tags
function extractReplacement(content: string): string | null {
  const match = content.match(/<replacement>([\s\S]*?)<\/replacement>/i)
  return match ? match[1].trim() : null
}

// Remove the <replacement> block from the displayed text
function stripReplacementTags(content: string): string {
  return content.replace(/<replacement>[\s\S]*?<\/replacement>/gi, '').trim()
}

export default function AiChat({
  memoText,
  companyName,
  selectedText,
  onClearSelection,
  onApplySuggestion,
}: AiChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  // Track accept/reject state per message index
  const [suggestionStates, setSuggestionStates] = useState<Record<number, SuggestionState>>({})
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

    // Capture selection before clearing
    const capturedSelection = selectedText

    const userMsg: Message = {
      role: 'user',
      content: text,
      selectionContext: capturedSelection || undefined,
    }
    const newMessages: Message[] = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    onClearSelection()
    setIsStreaming(true)

    // Empty assistant message tagged with same selection context
    const assistantPlaceholder: Message = {
      role: 'assistant',
      content: '',
      selectionContext: capturedSelection || undefined,
    }
    setMessages(prev => [...prev, assistantPlaceholder])

    // If there was a selection, hint Claude to use replacement tags
    const apiContent = capturedSelection
      ? `${text}\n\n[Note: The user highlighted this passage from the memo — please wrap your replacement in <replacement>...</replacement> tags if you're providing a rewrite: "${capturedSelection.slice(0, 400)}"]`
      : text

    const apiMessages = [
      ...newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: apiContent },
    ]

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
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

  const handleAccept = (msgIndex: number, original: string, replacement: string) => {
    onApplySuggestion(original, replacement)
    setSuggestionStates(prev => ({ ...prev, [msgIndex]: 'applied' }))
  }

  const handleReject = (msgIndex: number) => {
    setSuggestionStates(prev => ({ ...prev, [msgIndex]: 'dismissed' }))
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
              Ask follow-up questions or highlight text in the memo to get suggested edits.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLastStreaming = isStreaming && i === messages.length - 1
          const replacement = msg.role === 'assistant' && msg.selectionContext && !isLastStreaming
            ? extractReplacement(msg.content)
            : null
          const displayContent = replacement ? stripReplacementTags(msg.content) : msg.content
          const suggestionState = suggestionStates[i]

          return (
            <div key={i}>
              {/* Message bubble */}
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-stone-800 text-white rounded-br-sm'
                      : 'bg-stone-100 text-stone-800 rounded-bl-sm'
                  }`}
                >
                  {displayContent || (isLastStreaming ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : '')}
                </div>
              </div>

              {/* Suggestion diff card — shown for assistant messages with a replacement */}
              {replacement && !suggestionState && (
                <div className="mt-2 rounded-xl border border-stone-200 overflow-hidden text-xs shadow-sm">
                  {/* Old text */}
                  <div className="bg-red-50 border-b border-stone-200 px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1.5 text-red-500 font-medium">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                      Current text
                    </div>
                    <p className="text-stone-500 leading-relaxed line-through decoration-red-300 max-h-20 overflow-y-auto">
                      {msg.selectionContext}
                    </p>
                  </div>
                  {/* New text */}
                  <div className="bg-emerald-50 border-b border-stone-200 px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1.5 text-emerald-600 font-medium">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Suggested replacement
                    </div>
                    <p className="text-stone-700 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {replacement}
                    </p>
                  </div>
                  {/* Accept / Reject */}
                  <div className="bg-white px-3 py-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleReject(i)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-stone-500 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    </button>
                    <button
                      onClick={() => handleAccept(i, msg.selectionContext!, replacement)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Accept
                    </button>
                  </div>
                </div>
              )}

              {/* Post-action badge */}
              {replacement && suggestionState === 'applied' && (
                <div className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600 pl-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Applied to memo
                </div>
              )}
              {replacement && suggestionState === 'dismissed' && (
                <div className="mt-1.5 flex items-center gap-1 text-xs text-stone-400 pl-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Rejected
                </div>
              )}
            </div>
          )
        })}

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
            placeholder={selectedText ? 'Ask how to improve this…' : 'Ask about the memo…'}
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
