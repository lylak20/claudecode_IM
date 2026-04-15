'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'

interface FileDropzoneProps {
  onFileParsed: (text: string, filename: string) => void
  onError: (msg: string) => void
}

export default function FileDropzone({ onFileParsed, onError }: FileDropzoneProps) {
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      setIsParsing(true)
      setUploadedFilename(null)

      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/parse-file', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to parse file')
        }

        setUploadedFilename(file.name)
        onFileParsed(data.text, file.name)
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to parse file')
      } finally {
        setIsParsing(false)
      }
    },
    [onFileParsed, onError]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: isParsing,
  })

  const removeFile = () => {
    setUploadedFilename(null)
    onFileParsed('', '')
  }

  return (
    <div className="h-full flex flex-col">
      {uploadedFilename ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-emerald-300 bg-emerald-50 rounded-xl p-6">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-emerald-800 text-center mb-1">{uploadedFilename}</p>
          <p className="text-xs text-emerald-600 mb-4">File parsed successfully</p>
          <button
            onClick={removeFile}
            className="text-xs text-emerald-700 underline hover:text-emerald-900"
          >
            Remove file
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all ${
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : isParsing
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          }`}
        >
          <input {...getInputProps()} />

          {isParsing ? (
            <>
              <div className="w-10 h-10 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-600">Parsing file…</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
              </div>
              {isDragActive ? (
                <p className="text-sm font-medium text-blue-600">Drop file here</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Drag & drop or click to upload
                  </p>
                  <p className="text-xs text-gray-400">PDF, Excel, or CSV · max 10 MB</p>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
