// THE THIRD TIME THIS SHAPE BIT, AND THE GUARD THAT STOPS A FOURTH.
//
// 13 Oct 2026, India Roberts. Mellissa: "BC numbers are not reflecting properly
// in the LO template". The borrowing capacity said a $1,050,000 purchase with
// $42,000 duty. The client email said $975,000 and $35,000.
//
// Both numbers were on the lending options tab AT THE SAME TIME. The strip at
// the top reads the borrowing capacity and was right. The Scenario boxes below
// it are the lending options' own copy, taken once and never re-taken, and the
// email is built from those.
//
// THE SAME SHAPE THREE TIMES NOW.
//
//   the split list        froze at two while the BC went to six
//   the loan amount       a typed figure beat the BC for good
//   these figures         a copy from weeks ago beat the BC for good
//
// And the same cause every time: the lending options holds a copy of something
// it does not own, and nothing ever replaces it. fillMissing() fills keys that
// are ABSENT; a stale copy is not absent.
//
// Making these boxes read-only that morning stopped somebody typing a NEW wrong
// number. It did nothing about the old one already saved - which is the whole
// lesson, and why this file checks behaviour rather than whether an input has
// gone.
//
// Invented clients, invented figures.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { bcFieldsWin, LO_FIELDS_THE_BC_OWNS } from './the-lo-copies-nothing-it-does-not-own'

const form = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

describe('what the BC says now beats what the LO saved before', () => {
  // India Roberts, exactly.
  it('a purchase price saved weeks ago does not win', () => {
    const stored = { purchasePrice: '975,000', stampDuty: '35,000', deposit: '317,000' }
    const fresh = { purchasePrice: '1,050,000', stampDuty: '42,000', deposit: '422,000' }
    const out = bcFieldsWin(stored, fresh)
    expect(out.purchasePrice).toBe('1,050,000')
    expect(out.stampDuty).toBe('42,000')
    expect(out.deposit).toBe('422,000')
  })

  it('and an empty box on the BC is still the BC answering', () => {
    expect(bcFieldsWin({ purchasePrice: '975,000' }, { purchasePrice: '' }).purchasePrice).toBe('')
  })

  // THE OTHER HALF, AND THE ONE THAT WOULD HURT IF IT BROKE. Everything the
  // lending options genuinely owns has to survive untouched.
  it('but the lending options keeps everything that is its own', () => {
    const stored = {
      purchasePrice: '975,000',
      lenders: [{ id: 'L1', lenderName: 'Macquarie' }],
      recommendedOptionId: 'L1',
      brokerPersonalisation: 'Hi India, as discussed...',
      criteriaUsed: ['Competitive interest rate'],
      internalNotes: 'spoke to the BDM',
      refinanceSplits: [{ id: 'u1', amount: '670,000' }],
    }
    const out = bcFieldsWin(stored, { purchasePrice: '1,050,000' })
    expect(out.lenders).toEqual(stored.lenders)
    expect(out.recommendedOptionId).toBe('L1')
    expect(out.brokerPersonalisation).toBe('Hi India, as discussed...')
    expect(out.criteriaUsed).toEqual(['Competitive interest rate'])
    expect(out.internalNotes).toBe('spoke to the BDM')
    expect(out.refinanceSplits).toEqual(stored.refinanceSplits)
  })

  it('and survives being handed nothing', () => {
    expect(bcFieldsWin(null, { purchasePrice: '1' }).purchasePrice).toBe('1')
    expect(bcFieldsWin({ a: 1 }, null)).toEqual({ a: 1 })
  })
})

describe('the list is the one the form actually builds from', () => {
  // A field on the list that blankData() does not take from the BC would be
  // silently blanked on every load - worse than the fault being fixed.
  it('every field on it is read off the BC when the form builds a blank record', () => {
    const blank = form.slice(form.indexOf('function blankData(): LOData {'),
                             form.indexOf('// WHO CHANGED THIS - THE PERSON'))
    const missing = LO_FIELDS_THE_BC_OWNS.filter(f => {
      const re = new RegExp(f + String.raw`:\s*(bc|ffApp2|bcLoanAmount|dutyStateOf|loTemplateFor)`)
      return !re.test(blank)
    })
    expect(missing, 'claimed to be the BC answers, but the form does not read them from it').toEqual([])
  })

  it('and the loader applies it', () => {
    expect(form).toContain('const loaded = bcFieldsWin(fillMissing(stored, fresh), fresh)')
  })

  // The fault is not that a box exists. It is that a COPY is kept. A later
  // tidy-up that re-adds an input must not quietly re-add the keeping.
  it('the loader cannot go back to filling only what is absent', () => {
    expect(form, 'loShape is keeping the stored copy again')
      .not.toMatch(/const loaded = fillMissing\(stored, blankData\(\)\)/)
  })
})

describe('the figures a client reads come from the same place', () => {
  const email = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')

  it('the email still builds from the lending options record', () => {
    expect(email).toContain('d.purchasePrice')
    expect(email).toContain('d.stampDuty')
  })

  // Which is only safe BECAUSE of the rule above: that record now carries the
  // BC's figures rather than a copy of them. Said here so the two are read
  // together.
  it('and that record carries the BC figures rather than a copy of them', () => {
    expect(LO_FIELDS_THE_BC_OWNS).toContain('purchasePrice')
    expect(LO_FIELDS_THE_BC_OWNS).toContain('stampDuty')
    expect(LO_FIELDS_THE_BC_OWNS).toContain('deposit')
    expect(LO_FIELDS_THE_BC_OWNS).toContain('loanAmount')
  })
})
