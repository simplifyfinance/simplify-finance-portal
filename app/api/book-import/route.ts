import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

export const maxDuration = 300

// OPENING THE SPREADSHEET, AND DECIDING NOTHING ABOUT IT.
//
// 15 Oct 2026. Ten years of deals exported from the CRM - 796 rows, 656
// clients - dropped onto the Portfolio review tab.
//
// This hands back the header row and the cells, and that is all it does. It
// does not know what a client is, it does not match anybody, and it writes
// nothing. lib/book-import.ts works out what the rows mean and
// components/BookImport.tsx shows that to a person before a single row is
// saved. Three jobs, three files, and the one that can get it wrong is the one
// with the tests.
//
// WHY A ROUTE AND NOT THE BROWSER. ExcelJS is a server dependency and a 796-row
// workbook is not something to parse on somebody's laptop while they watch. The
// file goes up, the cells come back.

type Cell = string | number | null

function flat(v: any): Cell {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' || typeof v === 'string') return v
  if (v instanceof Date) {
    // THE LOCAL PARTS, NOT toISOString(). An early-morning date in Australia
    // goes back a day through UTC, and lib/portfolio-review.ts was bitten by
    // exactly that on 15 Oct 2026.
    const p = (n: number) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
  }
  // The shapes ExcelJS hands back for a formula, a hyperlink and rich text.
  if (typeof v === 'object') {
    if ('result' in v) return flat((v as any).result)
    if ('text' in v) return String((v as any).text ?? '')
    if (Array.isArray((v as any).richText)) {
      return (v as any).richText.map((r: any) => String(r?.text ?? '')).join('')
    }
  }
  return String(v)
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const base64 = String(body?.base64 || '').replace(/^data:[^,]+,/, '')
    if (!base64) return NextResponse.json({ error: 'No file came through.' }, { status: 400 })

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(Buffer.from(base64, 'base64') as any)

    // THE FIRST SHEET WITH ANYTHING ON IT. The export is one sheet; a workbook
    // with a cover page should not come back empty and silent.
    const sheet = wb.worksheets.find(w => w.rowCount > 1) || wb.worksheets[0]
    if (!sheet) return NextResponse.json({ error: 'There are no sheets in that file.' }, { status: 400 })

    const headerRow = sheet.getRow(1)
    const headers: string[] = []
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col - 1] = String(flat(cell.value) ?? '').trim()
    })
    // A trailing empty column is an artefact of how the sheet was saved, not a
    // field somebody forgot to name.
    while (headers.length && !headers[headers.length - 1]) headers.pop()
    if (headers.length === 0) {
      return NextResponse.json({ error: 'The first row has no column names in it.' }, { status: 400 })
    }

    const rows: Record<string, Cell>[] = []
    sheet.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1) return
      const out: Record<string, Cell> = {}
      let anything = false
      headers.forEach((h, i) => {
        if (!h) return
        const v = flat(row.getCell(i + 1).value)
        out[h] = v
        if (v !== null && String(v).trim() !== '') anything = true
      })
      // A blank row at the bottom is not a client.
      if (anything) rows.push(out)
    })

    return NextResponse.json({
      sheet: String(sheet.name || 'Sheet1'),
      sheets: wb.worksheets.map(w => String(w.name || '')),
      headers,
      rows,
    })
  } catch (e: any) {
    // SAID OUT LOUD. A file that cannot be opened is a thing the person can act
    // on - wrong file, password on it, saved as something else - and a silent
    // empty list tells them none of that.
    return NextResponse.json(
      { error: `That file could not be opened: ${String(e?.message || e)}` }, { status: 400 })
  }
}
