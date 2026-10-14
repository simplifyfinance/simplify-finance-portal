import { describe, it, expect } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { pdfToText } from './pdf-to-text'
import { splitIntoSections } from './split-into-sections'

// THE TEST I SHOULD HAVE WRITTEN THE FIRST TIME.
//
// 14 Oct 2026. The PDF reader shipped, Fabio dropped Macquarie's credit
// guidelines, and got:
//
//   That PDF could not be opened - Please provide binary data as `Uint8Array`,
//   rather than `Buffer`.
//
// A Node Buffer EXTENDS Uint8Array, so `bytes instanceof Uint8Array` is true
// for a Buffer and the guard handed it straight through. unpdf refuses it.
//
// My own check passed because I wrote `new Uint8Array(readFileSync(...))` by
// hand. The route never does that - it has a Buffer, every time, from
// Buffer.from(base64) or from arrayBuffer(). I had tested the library instead
// of my own code, which is the same mistake as shipping against a system I
// cannot see, just smaller.
//
// So this builds a real PDF and feeds it in AS A BUFFER, the way the route
// does. If the guard ever comes back, this goes red.

async function aRealPdf(lines: string[][]): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const page of lines) {
    const p = doc.addPage([595, 842])
    page.forEach((text, i) => p.drawText(text, { x: 60, y: 780 - i * 20, size: 11, font }))
  }
  // Buffer, deliberately. This is the whole point of the file.
  return Buffer.from(await doc.save())
}

describe('a PDF the way the route actually hands it over', () => {
  it('opens a Buffer, which is what every caller has', async () => {
    const pdf = await aRealPdf([['1A. Loan Purpose', 'Purchase or construction of a dwelling.']])
    expect(Buffer.isBuffer(pdf), 'the fixture must be a Buffer or this proves nothing').toBe(true)

    const got = await pdfToText(pdf)
    expect(got.pages).toBe(1)
    expect(got.text).toContain('Loan Purpose')
  })

  it('keeps the line breaks, so headings survive', async () => {
    // unpdf's own extractText welds every line together with spaces. A document
    // with no line breaks has no headings, the splitter finds none, and the
    // library quietly gets worse without anything appearing to fail.
    const pdf = await aRealPdf([[
      '1A. Equity release and cash out',
      'Up to 80% LVR: no limit applies to the cash out component.',
      'Above 80% up to 90% LVR: no cash out is allowed.',
    ]])
    const got = await pdfToText(pdf)
    const lines = got.text.split('\n').filter(Boolean)
    expect(lines.length, 'the lines have been flattened into one').toBeGreaterThan(2)
    expect(lines[0]).toContain('Equity release and cash out')
  })

  it('and the whole chain works: PDF in, named sections out', async () => {
    const pdf = await aRealPdf([
      ['1A. Loan Purpose', 'Purchase or construction of a dwelling.'],
      ['3C. Income, Self-Employed', 'Two years financials are required.'],
    ])
    const got = await pdfToText(pdf)
    const secs = splitIntoSections(got.text, 'Credit Guidelines')
    expect(secs.length).toBeGreaterThanOrEqual(2)
    expect(secs.map(s => s.title)).toContain('Loan Purpose')
    expect(secs.map(s => s.title)).toContain('Income, Self-Employed')
  })

  it('a PDF with no text in it comes back empty rather than throwing', async () => {
    // A scan. The route turns this into "it is probably a scan", which is a
    // thing somebody can act on. Silence is not.
    const doc = await PDFDocument.create()
    doc.addPage([595, 842])
    const got = await pdfToText(Buffer.from(await doc.save()))
    expect(got.text.trim()).toBe('')
    expect(got.pages).toBe(1)
  })
})
