'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MemoDisplayProps {
  text: string
  isStreaming: boolean
}

export default function MemoDisplay({ text, isStreaming }: MemoDisplayProps) {
  if (!text) return null

  return (
    <div className="prose prose-gray max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900 pb-2 border-b border-gray-200 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-800">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-gray-700 leading-relaxed mb-4 text-[15px]">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1 mb-4 text-gray-700">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1 mb-4 text-gray-700">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-[15px] leading-relaxed">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => {
            // Blue italic for "Diligence required" items
            const text = typeof children === 'string' ? children : ''
            if (text.startsWith('Diligence required')) {
              return <em className="not-italic text-blue-600 font-medium">{children}</em>
            }
            return <em>{children}</em>
          },
          blockquote: ({ children }) => {
            // Check if it contains a "Diligence required" em
            const childStr = JSON.stringify(children)
            const isDiligence = childStr.includes('Diligence required')
            if (isDiligence) {
              return (
                <blockquote className="border-l-4 border-blue-300 pl-4 py-1 my-3 bg-blue-50 rounded-r-lg italic text-blue-700 text-[14px]">
                  {children}
                </blockquote>
              )
            }
            return (
              <blockquote className="border-l-4 border-gray-200 pl-4 italic text-gray-600 my-4">
                {children}
              </blockquote>
            )
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="text-left font-semibold text-gray-900 border border-gray-200 px-3 py-2 bg-gray-50">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-3 py-2 text-gray-700">{children}</td>
          ),
          img: ({ src, alt }) => (
            <div className="my-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt || 'Screenshot'}
                className="w-full object-cover"
                loading="lazy"
              />
              {alt && (
                <p className="text-xs text-gray-400 text-center py-1.5 bg-gray-50 border-t border-gray-100">
                  {alt}
                </p>
              )}
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-5 bg-gray-400 animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  )
}
