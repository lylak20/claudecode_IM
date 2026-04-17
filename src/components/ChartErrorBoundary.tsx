'use client'

import React from 'react'

interface State { hasError: boolean; message: string }

export default class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(err: unknown): State {
    const message = err instanceof Error ? err.message : String(err)
    return { hasError: true, message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="my-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
          Chart could not be rendered — data may be incomplete or unsupported.
        </div>
      )
    }
    return this.props.children
  }
}
