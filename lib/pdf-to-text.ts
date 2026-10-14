// A PDF, AS LINES, BECAUSE A DOCUMENT WITH NO LINE BREAKS HAS NO HEADINGS.
//
// 13 Oct 2026. The library stores a document's words before it does anything
// else with them - see docs/lender-policy-text-and-sections.sql for why that
// ordering is the whole point. This is the part that gets the words out of a
// PDF, and it only exists because the obvious way of doing it does not work.
//
// unpdf ships an extractText() that joins every text item with a space. Run it
// over Macquarie's guidelines and you get one enormous line:
//
//   "1A. Equity release and cash out Up to 80% LVR: No limit is applicable..."
//
// Every heading welded to the paragraph underneath it. lib/split-into-sections
// then finds no headings, falls back to one section holding the whole
// document, and the library quietly becomes much worse at its job without
// anything appearing to fail. That is the exact shape of bug that cost an
// afternoon, so it is worth the extra thirty lines.
//
// Instead the lines are rebuilt from where the text actually sits on the page.
// Every item carries a transform; transform[5] is its vertical position and
// transform[4] its horizontal one. Items sharing a vertical position were on
// the same line, in horizontal order. That is all this does.

// A credit manual is tens of pages. A thousand-page document is a mistake or
// something that is not a credit manual, and reading it would hold a request
// open long enough to time out and report nothing at all.
export const MOST_PAGES = 600

export type PdfText = {
  text: string
  pages: number
  /** Pages actually read. Lower than `pages` only when MOST_PAGES bit. */
  read: number
  /** Said out loud when a document was too long to finish. */
  cutShort: boolean
}

/**
 * The words in a PDF, with its line breaks intact.
 *
 * Takes bytes and gives text. No network, no model, no key - so a failure
 * here means the file itself could not be read, which is a thing we can say
 * plainly on screen rather than a thing to guess about.
 */
export async function pdfToText(bytes: Uint8Array | ArrayBuffer): Promise<PdfText> {
  // Imported here rather than at the top so that a route which never sees a
  // PDF does not pay to load it.
  const { getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))

  const pages = pdf.numPages
  const read = Math.min(pages, MOST_PAGES)
  const out: string[] = []

  for (let p = 1; p <= read; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()

    // Bucket by vertical position. Rounding is what makes it work: characters
    // on one visual line are rarely at exactly the same y, and a sub-pixel
    // difference would otherwise put every word on its own line.
    const rows = new Map<number, { x: number; s: string }[]>()
    for (const item of content.items as any[]) {
      if (typeof item?.str !== 'string' || !Array.isArray(item?.transform)) continue
      const y = Math.round(item.transform[5])
      const row = rows.get(y) || []
      row.push({ x: Number(item.transform[4]) || 0, s: item.str })
      rows.set(y, row)
    }

    const lines = [...rows.entries()]
      // Top of the page downwards: y counts up from the bottom in PDF space.
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) => row.sort((a, b) => a.x - b.x).map(i => i.s).join('').trim())
      .filter(Boolean)

    out.push(lines.join('\n'))
  }

  return {
    // A blank line between pages, so a heading at the top of a page is not
    // glued to the last sentence of the one before it.
    text: out.join('\n\n').trim(),
    pages,
    read,
    cutShort: read < pages,
  }
}
