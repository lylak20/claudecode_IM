'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'

interface ParsedFile {
  name: string
  text: string
  status: 'parsing' | 'done' | 'error'
  error?: string
}

interface FileDropzoneProps {
  onFileParsed: (combinedText: string, filenames: string) => void
  onError: (msg: string) => void
}

export default function FileDropzone({ onFileParsed, onError }: FileDropzoneProps) {
  const [files, setFiles] = useState<ParsedFile[]>([])

  // Notify parent whenever the file list changes
  const notify = useCallback(
    (updated: ParsedFile[]) => {
      const done = updated.filter(f => f.status === 'done')
      const combinedText = done.map(f => `=== ${f.name} ===\n${f.text}`).join('\n\n')
      const names = done.map(f => f.name).join(', ')
      onFileParsed(combinedText, names)
    },
    [onFileParsed],
  )

  const parseFile = useCallback(
    async (file: File) => {
      // Add as "parsing" immediately
      const entry: ParsedFile = { name: file.name, text: '', status: 'parsing' }
      setFiles(prev => {
        // Skip duplicates
        if (prev.some(f => f.name === file.name)) return prev
        return [...prev, entry]
      })

      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/parse-file', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to parse file')

        setFiles(prev => {
          const updated = prev.map(f =>
            f.name === file.name ? { ...f, text: data.text, status: 'done' as const } : f,
          )
          notify(updated)
          return updated
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to parse file'
        setFiles(prev => {
          const updated = prev.map(f =>
            f.name === file.name ? { ...f, status: 'error' as const, error: msg } : f,
          )
          notify(updated)
          return updated
        })
        onError(`${file.name}: ${msg}`)
      }
    },
    [notify, onError],
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach(parseFile)
    },
    [parseFile],
  )

  const removeFile = useCallback(
    (name: string) => {
      setFiles(prev => {
        const updated = prev.filter(f => f.name !== name)
        notify(updated)
        return updated
      })
    },
    [notify],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    maxFiles: 10,
    maxSize: 10 * 1024 * 1024,
  })

  const hasParsing = files.some(f => f.status === 'parsing')

  return (
    <div className="space-y-3">
      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map(f => (
            <li
              key={f.name}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm ${
                f.status === 'done'
                  ? 'border-emerald-200 bg-emerald-50'
                  : f.status === 'error'
                  ? 'border-red-200 bg-red-50'
                  : 'border-blue-100 bg-blue-50'
              }`}
            >
              {/* Status icon */}
              {f.status === 'parsing' && (
                <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
              )}
              {f.status === 'done' && (
                <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {f.status === 'error' && (
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}

              {/* Filename + status text */}
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${
                  f.status === 'done' ? 'text-emerald-800' :
                  f.status === 'error' ? 'text-red-700' : 'text-blue-700'
                }`}>
                  {f.name}
                </p>
                {f.status === 'parsing' && (
                  <p className="text-xs text-blue-500">Parsing…</p>
                )}
                {f.status === 'error' && (
                  <p className="text-xs text-red-500 truncate">{f.error}</p>
                )}
                {f.status === 'done' && (
                  <p className="text-xs text-emerald-600">Parsed successfully</p>
                )}
              </div>

              {/* Remove button */}
              <button
                onClick={() => removeFile(f.name)}
                className={`flex-shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors ${
                  f.status === 'done' ? 'text-emerald-600' :
                  f.status === 'error' ? 'text-red-500' : 'text-blue-500'
                }`}
                title="Remove file"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Drop zone — always visible so you can add more files */}
      <div
        {...getRootProps()}
        className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition-all ${
          isDragActive
            ? 'border-blue-400 bg-blue-50'
            : hasParsing
            ? 'border-gray-200 bg-gray-50 cursor-wait'
            : files.length > 0
            ? 'border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        }`}
      >
        <input {...getInputProps()} />

        {isDragActive ? (
          <p className="text-sm font-medium text-blue-600">Drop files here</p>
        ) : (
          <>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              files.length > 0 ? 'bg-stone-200' : 'bg-gray-200'
            }`}>
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {files.length > 0 ? 'Add another file' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-gray-400">PDF, Excel, or CSV · max 10 MB each</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
