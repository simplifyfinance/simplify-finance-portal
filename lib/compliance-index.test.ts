import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE INDEX AND THE REFUSAL CANNOT DISAGREE.
//
// 6 Oct 2026. The number beside each section on Compliance is the same list
// that stops you pushing the deal - counted, and shown before you press
// anything instead of after. The danger in showing it twice is obvious: an
// index saying a section is finished while the button still refuses it.
//
// So these tests say there is ONE set of rules, and the index reads it.
const src = readFileSync('app/(app)/deals/[id]/ComplianceForm.tsx', 'utf8')

describe('compliance is one page with an index', () => {
  it('the five sections are named once', () => {
    expect(src).toContain('export const SECTIONS')
    expect(src).toContain("export type SectionKey")
    // and the old hand-typed copy of the same five is gone
    expect(src, 'the five sections are listed twice')
      .not.toContain("const stages = ['needs', 'risks', 'product', 'comments', 'expenses']")
  })

  it('every section is on the page, not behind a tab', () => {
    for (const k of ['needs', 'risks', 'product', 'comments', 'expenses']) {
      expect(src, `${k} is not a section of the page`).toContain(`id="sec-${k}"`)
      expect(src, `${k} is still hidden behind a tab`).not.toContain(`{stage === '${k}' && (`)
    }
  })

  it('ONE SET OF RULES. The index counts what the refusal refuses.', () => {
    expect(src).toContain('function missingBeforePush(): Miss[]')
    // the old list-of-sentences is now built from the same answer
    expect(src).toContain('return missingBeforePush().map(m => m.message)')
    // and the index counts the same objects
    expect(src).toContain('const misses = missingBeforePush()')
    // nothing else may invent its own idea of missing
    // The only errors.push left is the helper that takes a section. A rule
    // pushing a bare sentence would be a miss the index can never see.
    const bare = (src.match(/errors\.push\(\s*['\`]/g) || []).length
    expect(bare, 'a rule is still pushing a bare sentence instead of naming its section').toBe(0)
  })

  it('living expenses counts the ones nobody has answered', () => {
    expect(src).toContain('hemTotals(EXPENSE_CATEGORIES, shownExpenses as any).unanswered')
  })

  it('product requirements shows NOTHING, because no rule checks it', () => {
    // An honest blank beats a green tick that means "we never looked".
    expect(src).toContain("sec.key === 'product' ? null")
  })

  it('the index follows the scroll and can be clicked', () => {
    expect(src).toContain('IntersectionObserver')
    expect(src).toContain('scrollIntoView')
    expect(src).toContain('aria-label="Compliance sections"')
  })
})
