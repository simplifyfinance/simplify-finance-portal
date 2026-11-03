import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE ROBOT MAKES ONE DEAL, NOT ONE A SHIP.
//
// 3 Nov 2026. 924 of the 1165 deals in this database were test deals, 891 of
// them made in the last thirty days. About thirty a day. One per robot per
// ship.
//
// Both specs that create a deal were written to make ONE and reuse it - they
// look for it first and only create when it is not there. The looking broke on
// 2 October, when Settled, Lost and Test deals moved out of the toolbar into
// the Filters panel. The robot went on hunting for a button called "Test deals
// (12)", found nothing, decided its deal did not exist, and made another.
//
// NOTHING FAILED. The specs passed every single time: they had a deal, it was
// new, and a new deal behaves like an old one. The only evidence was a number
// nobody counts - until the pile crossed the thousand rows the database will
// return in one answer and started pushing real deals off the deals screen
// entirely. 149 of them, including two Fabio went looking for by name.
//
// So this is the test that would have caught it on 2 October: the looking is in
// one file, and no spec is allowed its own copy.

const SHARED = readFileSync('tests/browser/the-robots-own-deal.ts', 'utf8')
const SPECS = ['tests/browser/new-deal.spec.ts', 'tests/browser/new-deal-busy.spec.ts']
  .map(f => [f, readFileSync(f, 'utf8')] as const)

describe('THE LOOKING LIVES IN ONE FILE', () => {
  it.each(SPECS.map(([f]) => f))('%s asks the shared finder', (f) => {
    const src = SPECS.find(([n]) => n === f)![1]
    expect(src).toContain("from './the-robots-own-deal'")
    expect(src).toContain('findTheRobotsDeal(')
  })

  it('AND NO SPEC KEEPS ITS OWN COPY', () => {
    // Two copies is how one copy came to be a month out of date. The words may
    // still appear in a comment - that history is worth keeping - but not as
    // something the robot goes looking for.
    for (const [f, src] of SPECS) {
      expect(src, `${f} still hunts for a control itself`).not.toContain('name: /Test deals')
      expect(src, `${f} still hunts for a control itself`).not.toContain("getByText('Test deals")
    }
  })
})

describe('AND IT GOES IN THE WAY A PERSON DOES', () => {
  it('through the Filters button', () => {
    expect(SHARED).toContain("getByRole('button', { name: /^Filters/ })")
  })

  it('and the row that is actually there', () => {
    // components/BoardFilters.tsx draws this text. If it is renamed, the
    // expect below fails with a sentence saying what it will cost.
    expect(SHARED).toContain("getByText('Test deals only', { exact: true })")
    expect(readFileSync('components/BoardFilters.tsx', 'utf8')).toContain("'Test deals only'")
  })

  it('AND A MISSING CONTROL FAILS LOUDLY RATHER THAN MAKING A DEAL', () => {
    // The whole fault was that not finding the way in looked like not having a
    // deal. It has to look like a broken test instead.
    expect(SHARED).toContain('891 of them appeared in thirty days')
    expect(SHARED).toContain('toBeVisible(')
  })

  it('and one robot is never mistaken for another', () => {
    // ZZROBOT must not match ZZROBOTTWO: one spec once typed its answers into
    // the other robot's deal and then failed to find them in its own.
    expect(SHARED).toContain('(?![A-Z])')
  })
})
