import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import {
  recommendedOption, isRecommended, recommendedLabel, recommendedFirst, recommendationIsAmbiguous,
} from './recommended-option'
import { optionsOf } from './lender-comparison'

// WILLIAM WELTON, 16 SEP 2026.
//
// Two options, both Bankwest - one Simple, one Package. The broker chose Simple.
// The client email put a star on both columns, because the dropdown only ever
// saved the word "Bankwest" and every reader downstream asked each option "are
// you Bankwest?".
//
// Fabio: "we selected simple but html is recommending both products which is
// causing confusion to my processing staff."

const simple = { id: 'a', lenderName: 'Bankwest', productName: 'Simple Home Loan' }
const pkg = { id: 'b', lenderName: 'Bankwest', productName: 'Complete Package' }
const anz = { id: 'c', lenderName: 'ANZ', productName: 'Simplicity Plus' }

describe('two products from one bank', () => {
  const lo = { lenders: [pkg, simple], recommendedOptionId: 'a', recommendedLender: 'Bankwest' }

  it('picks the product that was chosen, not the first one with that name', () => {
    expect(recommendedOption(lo)).toBe(simple)
  })

  it('stars exactly one column', () => {
    expect(isRecommended(lo, simple)).toBe(true)
    expect(isRecommended(lo, pkg)).toBe(false)
  })

  it('names the product, so nobody has to work out which Bankwest', () => {
    expect(recommendedLabel(lo)).toBe('Bankwest — Simple Home Loan')
  })

  it('puts the chosen one first without promoting its twin', () => {
    const order = recommendedFirst(lo, [pkg, simple])
    expect(order[0]).toBe(simple)
    expect(order[1]).toBe(pkg)
  })

  it('reads as one recommendation to the comparison, not two', () => {
    const flagged = optionsOf(lo).filter((o: any) => o.recommended)
    expect(flagged).toHaveLength(1)
    expect(flagged[0].product).toBe('Simple Home Loan')
  })
})

describe('records saved before the product was recorded', () => {
  it('still works where the bank appears once', () => {
    const lo = { lenders: [anz, simple], recommendedLender: 'ANZ' }
    expect(recommendedOption(lo)).toBe(anz)
    expect(isRecommended(lo, anz)).toBe(true)
    expect(recommendationIsAmbiguous(lo)).toBe(false)
  })

  it('refuses to guess when the bank appears twice', () => {
    const lo = { lenders: [pkg, simple], recommendedLender: 'Bankwest' }
    // The old code took pkg - the first match - and quoted ITS rate and fees
    // everywhere while the broker had chosen simple. Nothing said so.
    expect(recommendedOption(lo)).toBeNull()
    expect(isRecommended(lo, pkg)).toBe(false)
    expect(isRecommended(lo, simple)).toBe(false)
    expect(recommendationIsAmbiguous(lo)).toBe(true)
  })

  it('says nothing is ambiguous when nothing was recommended at all', () => {
    expect(recommendationIsAmbiguous({ lenders: [pkg, simple], recommendedLender: '' })).toBe(false)
    expect(recommendedOption({ lenders: [pkg, simple] })).toBeNull()
  })
})

describe('an id that no longer matches an option', () => {
  it('falls back to the name rather than reporting a deleted option', () => {
    const lo = { lenders: [anz], recommendedOptionId: 'gone', recommendedLender: 'ANZ' }
    expect(recommendedOption(lo)).toBe(anz)
  })

  it('and reports nothing when the name is gone too', () => {
    const lo = { lenders: [anz], recommendedOptionId: 'gone', recommendedLender: 'Bankwest' }
    expect(recommendedOption(lo)).toBeNull()
    expect(recommendedFirst(lo, [anz])).toEqual([anz])
  })
})

// ---------------------------------------------------------------------------

describe('nothing decides this for itself', () => {
  const skip = new Set(['recommended-option.ts', 'recommended-option.test.ts'])

  function sources(dir: string): string[] {
    let out: string[] = []
    let entries: string[] = []
    try { entries = readdirSync(dir) } catch { return out }
    for (const name of entries) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
      const full = join(dir, name)
      if (statSync(full).isDirectory()) out = out.concat(sources(full))
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !skip.has(name)) out.push(full)
    }
    return out
  }

  it('no file works out the recommendation from the lender name', () => {
    const offenders: string[] = []
    for (const f of ['lib', 'components', 'app'].flatMap(d => sources(join(process.cwd(), d)))) {
      const src = readFileSync(f, 'utf8').replace(/\/\/[^\n]*/g, '')
      // `lenderName === <anything about the recommendation>` is the exact shape
      // that starred both Bankwest columns.
      if (/lenderName\s*\)?\s*===\s*[^\n]*recommended/i.test(src)
        || /recommendedLender\s*\)?\s*===\s*[^\n]*lenderName/i.test(src)) {
        offenders.push(f.replace(process.cwd() + '/', ''))
      }
    }
    expect(offenders,
      'Ask lib/recommended-option.ts which option was recommended. Comparing the bank\'s\n'
      + 'name puts a star on every product that bank offers, and makes .find() return\n'
      + 'whichever one happens to be first:\n\n  ' + offenders.join('\n  ') + '\n').toEqual([])
  })

  it('keeps the recommendation paragraph on a deal it cannot resolve', () => {
    // Losing the star is right; losing the broker's written recommendation is not.
    const src = readFileSync(join(process.cwd(), 'app/api/generate-lo-email/route.ts'), 'utf8')
    expect(src).toContain('if (d.recommendationNote && (recommendedOption(d) || d.recommendedLender))')
  })

  it('the client email asks by option and names the product', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/generate-lo-email/route.ts'), 'utf8')
    expect(src).toContain('isRecommended(lo, l)')
    expect(src, 'the headline still says only the bank').toContain('Our Recommendation: ${recommendedLabel(d)}')
  })

  it('the LO form saves which option, not which bank', () => {
    const src = readFileSync(join(process.cwd(), 'app/(app)/deals/[id]/LOForm.tsx'), 'utf8')
    expect(src).toContain('recommendedOptionId: e.target.value')
    expect(src, 'options need a stable id or two of them cannot be told apart').toContain('id: makeUid()')
    expect(src, 'old options must be backfilled the same way on every screen').toContain('`legacy-${i}`')
  })
})
