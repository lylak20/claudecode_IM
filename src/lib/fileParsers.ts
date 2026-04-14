export async function parseExcelOrCsv(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const parts: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    if (csv.trim().length > 0) {
      parts.push(`=== Sheet: ${sheetName} ===\n${csv}`)
    }
  }

  return parts.join('\n\n').slice(0, 5000)
}

export async function parsePdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  const result = await pdfParse(buffer)
  return result.text.trim().slice(0, 5000)
}
