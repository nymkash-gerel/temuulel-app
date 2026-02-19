import ExcelJS from 'exceljs'

/**
 * Export data to Excel (.xlsx) or CSV format
 * Replaces vulnerable xlsx package with exceljs
 */
export async function exportToFile(
  data: Record<string, unknown>[],
  filename: string,
  format: 'xlsx' | 'csv',
  sheetName = 'Sheet1'
): Promise<void> {
  if (data.length === 0) return

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)

  // Get headers from first row
  const headers = Object.keys(data[0])

  // Add header row with styling
  worksheet.columns = headers.map(header => ({
    header,
    key: header,
    width: Math.max(header.length + 2, 15)
  }))

  // Style header row
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  }

  // Add data rows
  data.forEach(row => {
    worksheet.addRow(row)
  })

  // Generate buffer and download
  let buffer: ArrayBuffer
  let mimeType: string
  let extension: string

  if (format === 'csv') {
    buffer = await workbook.csv.writeBuffer() as ArrayBuffer
    mimeType = 'text/csv;charset=utf-8'
    extension = 'csv'
    // Add BOM for proper UTF-8 encoding in Excel
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
    const csvBuffer = new Uint8Array(buffer)
    const combined = new Uint8Array(bom.length + csvBuffer.length)
    combined.set(bom)
    combined.set(csvBuffer, bom.length)
    buffer = combined.buffer
  } else {
    buffer = await workbook.xlsx.writeBuffer() as ArrayBuffer
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    extension = 'xlsx'
  }

  const blob = new Blob([buffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.${extension}`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Read Excel file and return data as array of objects
 * Replaces vulnerable xlsx package with exceljs
 */
export async function readExcelFile(
  data: ArrayBuffer
): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(data)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []

  const rows: Record<string, unknown>[] = []
  const headers: string[] = []

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // First row is header
      row.eachCell((cell) => {
        headers.push(String(cell.value || ''))
      })
    } else {
      // Data rows
      const rowData: Record<string, unknown> = {}
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1]
        if (header) {
          rowData[header] = cell.value
        }
      })
      if (Object.keys(rowData).length > 0) {
        rows.push(rowData)
      }
    }
  })

  return rows
}
