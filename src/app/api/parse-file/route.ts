import { parseExcelOrCsv, parsePdf } from '@/lib/fileParsers'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = file.name.toLowerCase()

    let text = ''

    if (filename.endsWith('.pdf')) {
      text = await parsePdf(buffer)
    } else if (
      filename.endsWith('.xlsx') ||
      filename.endsWith('.xls') ||
      filename.endsWith('.csv')
    ) {
      text = await parseExcelOrCsv(buffer, filename)
    } else {
      return Response.json(
        { error: 'Unsupported file type. Please upload PDF, Excel, or CSV.' },
        { status: 400 }
      )
    }

    return Response.json({ text })
  } catch (error) {
    return Response.json(
      { error: 'Failed to parse file' },
      { status: 500 }
    )
  }
}
