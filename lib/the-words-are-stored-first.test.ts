import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE DAY THIS FILE EXISTS BECAUSE OF.
//
// 13 Oct 2026. Macquarie's credit guidelines were uploaded, hashed, and
// sitting in the bucket, complete, for an entire afternoon. Paco could not
// read one line of them.
//
// Not because the document was bad. Because ONE model call tried to carve the
// whole 57,000 characters into hundreds of one-sentence rules, ran out of
// output room, came back as truncated JSON, and everything the library knew
// about that document depended on that one call having worked.
//
// Fabio, at the end of it: "if I cant build a simple file where each banks
// informatiomn is there and can be searcehd what hope do i have".
//
// The fix was not a better parser. It was an ORDER:
//
//   1. the words are stored, and THAT is what "filed" means
//   2. splitting into sections is separate, and may be retried
//   3. reading rules out of it is separate, and may be retried
//
// Every one of these tests is here to stop that order being quietly put back
// the way it was. They are deliberately about the shape of the code rather
// than its output, because the failure they prevent is architectural: each
// individual step worked fine on the day it broke.

const page = readFileSync('components/LenderPolicyDocs.tsx', 'utf8')
const textRoute = readFileSync('app/api/document-text/route.ts', 'utf8')
const pdf = readFileSync('lib/pdf-to-text.ts', 'utf8')

describe('the words come first', () => {
  it('asks for the text before it asks for any rules', () => {
    const words = page.indexOf("/api/document-text")
    const rules = page.indexOf("/api/extract-policy")
    expect(words, 'the text step has gone').toBeGreaterThan(-1)
    expect(rules).toBeGreaterThan(-1)
    expect(words, 'the rules are being read before the words are stored')
      .toBeLessThan(rules)
  })

  it('storing the words is checked, not hoped for', () => {
    // Postgres returns zero rows and no error when a policy blocks a write.
    // Unchecked, the tile says filed and Paco has nothing behind it - which is
    // the exact lie this whole rebuild exists to remove.
    expect(page).toContain('body_text: text, body_chars: text.length')
    expect(page).toMatch(/\.eq\('id', doc\.id\)\.select\('id'\)/)
    expect(page).toContain("whyWords = sErr?.message || 'the words were read but would not save'")
  })

  it('the three steps are each able to fail on their own', () => {
    for (const reason of ['whyWords', 'whySections']) {
      expect(page, `${reason} has gone - a failure is being swallowed again`).toContain(reason)
    }
    // And they are reported separately. "0 lines" meaning six different things
    // is what cost the day.
    expect(page).toContain('the words:')
    expect(page).toContain('the sections:')
    expect(page).toContain('the rules:')
  })

  it('words landing is a result, not an error, even when the rules fail', () => {
    expect(page).toContain('if (kept === 0 && sectionsOn === 0 && wordsOn === 0) setErr(say)')
    expect(page, 'a failed rules read is being treated as total failure again')
      .not.toContain('if (failed > 0 && kept === 0) setErr(say)')
  })
})

describe('a re-read cannot destroy a good read', () => {
  // A read is a RUN. Sections carry the run they came from; the document
  // points at one run. The pointer moves LAST, so a re-read that dies halfway
  // leaves the previous read still answering questions.
  it('every section is written against a run', () => {
    expect(page).toContain('read_run: run')
    expect(page).toContain('const run = crypto.randomUUID()')
  })

  it('the document only points at a run once every section is written', () => {
    const insert = page.indexOf("from('lender_policy_sections').insert")
    const flip = page.indexOf('current_read: run')
    expect(insert).toBeGreaterThan(-1)
    expect(flip, 'the pointer moves before the sections are in').toBeGreaterThan(insert)
    expect(page).toContain('if (!whySections && put > 0 && put === rows.length)')
  })

  it('and a half-written run says so rather than being pointed at', () => {
    expect(page).toContain('so the document still points at the last good read')
  })

  it('nothing deletes a section anywhere', () => {
    expect(page, 'sections are superseded by a new run, never deleted')
      .not.toMatch(/from\('lender_policy_sections'\)\s*\.?\s*\n?\s*\.delete\(/)
  })
})

describe('getting the words out calls nothing', () => {
  it('the text route has no model in it', () => {
    for (const banned of ['Anthropic', 'anthropic', 'ANTHROPIC_API_KEY', 'messages.create']) {
      expect(textRoute, `the text step must not depend on a model (${banned})`)
        .not.toContain(banned)
    }
  })

  it('it still refuses to be pointed at our own network', () => {
    // It fetches whatever address it is handed, so it is a second place that
    // could be aimed inward. Checked before the fetch and again on where it
    // landed, same as the other two.
    expect(textRoute).toContain('whyNotALink(fileUrl)')
    expect(textRoute).toContain('isOurOwnSide(new URL(got.url || fileUrl).hostname)')
  })

  it('it asks the way a browser asks', () => {
    expect(textRoute).toContain('Mozilla/5.0')
    expect(textRoute).not.toContain('SimplifyFinancePortal/1.0')
  })

  it('a scan with no text in it is named as a scan', () => {
    // Otherwise it reports as an empty document, and somebody drops it again.
    expect(textRoute).toContain('it is probably a scan')
  })

  it('a file that is not a PDF is not read through a PDF reader', () => {
    // The NAB chapters arrived as markdown. Decoding markdown through a PDF
    // parser produces nothing, with no explanation.
    expect(textRoute).toContain('looksLikePdf')
  })
})

describe('a PDF keeps its line breaks', () => {
  // unpdf's own extractText joins every item with a space, which welds each
  // heading to the paragraph underneath it. The splitter then finds no
  // headings, falls back to one section holding everything, and the library
  // gets quietly worse at its job without anything appearing to fail.
  it('lines are rebuilt from where the text sits on the page', () => {
    expect(pdf).toContain('item.transform[5]')
    expect(pdf).toContain('item.transform[4]')
    expect(pdf, 'the flattening extractText is back').not.toContain('mergePages')
  })

  it('and it will not sit on a thousand page document forever', () => {
    expect(pdf).toContain('MOST_PAGES')
    expect(pdf).toContain('cutShort')
  })
})
