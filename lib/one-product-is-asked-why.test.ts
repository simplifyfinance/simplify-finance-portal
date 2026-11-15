// "WE NEED TO FORCE MY CREDIT TEAM TO GIVE ME AN ANSWER."
//
// 17 Nov 2026, Fabio, on a lending option going out with one product on it:
// "because that answer then goes into the compliance notes."
//
// And on the employment history that sent a compliance note out naming the
// wrong previous employer: "A puts itself in order".
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const code = (f: string) => readFileSync(f, 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

const LO = code('app/(app)/deals/[id]/LOForm.tsx')
const FF = code('app/(app)/deals/[id]/FactFindForm.tsx')
const COMP = code('app/(app)/deals/[id]/ComplianceForm.tsx')

describe('one product on a lending option is asked why', () => {
  it('counted the way the compliance boxes count it', () => {
    expect(LO, 'the screen and the notes must never disagree about this')
      .toContain('const productCount = optionsOf(d).length')
    expect(LO).toContain('blockedForNoReason(d, productCount)')
  })

  it('the reasons are the ones credit is offered, and anything else can be typed', () => {
    expect(LO).toContain('WHY_ONE_LENDER.map')
    expect(LO).toContain('oneLenderReason: e.target.value')
  })

  // THE ONE THING IN THE NOTES THAT STOPS SOMEBODY.
  it('and it stops Done and Send to client, with the reason on the button', () => {
    expect(LO).toContain('waiting: needsReason')
    expect(LO).toContain('!canSendToClient || !emailHtml || needsReason')
    expect(LO).toContain('if (needsReason) return')
    expect(LO).toContain('title: needsReason ? ASK_FOR_IT')
  })

  it('the answer reaches both compliance boxes from the one place', () => {
    expect(code('lib/box-four.ts')).toContain('whyOneLenderSentence(lo, onTheDeal)')
    expect(code('lib/box-options.ts')).toContain('whyOneLenderSentence(lo,')
  })
})

describe('the fact find reads employment in date order', () => {
  it('it sorts before it draws', () => {
    expect(FF).toContain('inDateOrder(applicant.employment).map')
  })

  // "PREVIOUS EMPLOYER #1" MEANT TYPED FIRST, AND READ AS MOST RECENT.
  it('and the numbers are gone, because they were the lie', () => {
    expect(FF, 'a number by typing order is how this went wrong')
      .not.toContain('Previous employer #')
    expect(FF).toContain('The role before this one')
  })

  it('and it says when it has reordered something', () => {
    expect(FF).toContain('outOfOrder(applicant.employment)')
  })
})

// 17 Nov 2026: "No, I don't want to block it because it makes it hard, but
// just put a warning on top."
describe('every other gap warns and never blocks', () => {
  it('the warnings come out of the note and go above it', () => {
    expect(COMP).toContain('const clean = noteText(r.text)')
    expect(COMP).toContain('toFix(r.text, r.gaps)')
  })

  it('and the list is under every box that is written from the deal', () => {
    expect((COMP.match(/<ToFixList items=/g) || []).length).toBeGreaterThanOrEqual(4)
  })

  it('nothing about it disables anything', () => {
    const list = COMP.slice(COMP.indexOf('function ToFixList'), COMP.indexOf('const AI_FIELDS'))
    expect(list).not.toContain('disabled')
  })
})
