import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// NINE COPIES OF THE SAME HANDOVER.
//
// Fabio, 16 Sep 2026, looking at Natasha Chapman's documents list: the same
// "Handover - Natasha Chapman-compliance.pdf" filed over and over, and the
// summary three times. "I dont need a new one saving every time."
//
// The push to SalesTrekker generates three PDFs and files all three. The path
// carried Date.now() and the insert was unconditional, so every push minted
// three new files and three new rows. Five pushes, fifteen documents, all with
// the same names.

const src = readFileSync('app/api/notify-salestrekker/route.ts', 'utf8')
const code = src.replace(/\/\/[^\n]*/g, '')

describe('the compliance pack files one copy per deal', () => {
  it('writes to the same path every push instead of a new one', () => {
    expect(code, 'the stored path is unique per push again, so every push files another copy')
      .not.toMatch(/filePath = `\$\{dealId\}\/\$\{Date\.now\(\)\}/)
    expect(code).toContain('const filePath = `${dealId}/${result.kind}.pdf`')
  })

  it('overwrites the previous copy rather than adding to it', () => {
    expect(code).toMatch(/upsert:\s*true/)
  })

  it('records the document once, not once per push', () => {
    // A second row pointing at the same file is exactly the pile being fixed.
    expect(code).toContain("select('id').eq('deal_id', dealId).eq('file_path', filePath)")
    expect(code).toMatch(/if \(!already\?\.length\)/)
  })

  it('still names the emailed copy with the date it was sent', () => {
    // That one lands in somebody's inbox, where "which one is this" is a real
    // question. The deal keeps the current copy; the inbox keeps the dated one.
    expect(code).toContain('attachments.push({ filename: sentName')
    expect(code).toMatch(/sentName = `\$\{result\.dealName\} \(\$\{shortDate\(/)
  })

  it('never deletes anything to achieve it', () => {
    // Overwriting in place needs no delete, and a push must never be able to
    // remove a document from a deal.
    expect(code).not.toMatch(/storage\.from\('deal-documents'\)\.remove/)
    expect(code).not.toMatch(/from\('deal_documents'\)[\s\S]{0,40}\.delete\(/)
  })
})
