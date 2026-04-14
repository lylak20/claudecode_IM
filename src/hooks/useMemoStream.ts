'use client'

import { useState, useCallback } from 'react'
import type { MemoConfig } from '@/lib/types'

export function useMemoStream() {
  const [memoText, setMemoText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startStream = useCallback(async (config: MemoConfig) => {
    setMemoText('')
    setError(null)
    setIsStreaming(true)

    try {
      const response = await fetch('/api/generate-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Request failed with status ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMemoText((prev) => prev + chunk)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsStreaming(false)
    }
  }, [])

  const reset = useCallback(() => {
    setMemoText('')
    setError(null)
    setIsStreaming(false)
  }, [])

  return { memoText, isStreaming, error, startStream, reset }
}
