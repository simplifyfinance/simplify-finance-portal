import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// 16 Oct 2026. Fabio, having marked a deal formally approved by mistake: "I
// need a way to revert that ... reverting anything from compliance onwards is
// OK as it doesn't change compliance (the rule applied to LO and prior to
// compliance only)."
//
// Until now DealSettlement only moved forward. The one way back was "Record a
// date we missed", and it appears only on a settled deal.

const SRC = readFileSync('app/(app)/deals/[id]/DealSettlement.tsx', 'utf8')

// The stage list, read out of the file so this cannot drift from it.
const STAGES = [...SRC.matchAll(/\{ key: '([a-z_]+)',\s+snap: (?:'(\w+)'|null),[^}]*mark: (true|false)/g)]
  .map(m => ({ key: m[1], snap: m[2] || null, mark: m[3] === 'true' }))

// The rule, run rather than described: the last stage with a date, and only if
// this panel is the one that records it.
const undoable = (deal: any) => {
  const last = [...STAGES].reverse().find(x => deal[x.key])
  return last && last.mark ? last : null
}

describe('which stage can be undone', () => {
  it('reads all seven stages out of the component', () => {
    expect(STAGES.map(s => s.key)).toEqual([
      'lodged_at', 'preapproval_at', 'offer_accepted_at', 'formal_approval_at',
      'contracts_returned_at', 'settlement_booked_at', 'settled_at',
    ])
  })

  it('the furthest point the deal has reached, and only that', () => {
    expect(undoable({ lodged_at: 'x', formal_approval_at: 'x' })?.key).toBe('formal_approval_at')
    expect(undoable({ lodged_at: 'x' })?.key).toBe('lodged_at')
  })

  // A HISTORY WITH A HOLE IN IT IS WORSE THAN THE WRONG STAGE. Undoing
  // lodgement on a settled deal would leave a deal that settled and was never
  // lodged.
  it('never a stage in the middle', () => {
    const settled = { lodged_at: 'x', formal_approval_at: 'x', settled_at: 'x' }
    expect(undoable(settled)?.key).toBe('settled_at')
    expect(undoable(settled)?.key).not.toBe('lodged_at')
  })

  it('and one undo at a time - the one before becomes the last', () => {
    const deal: any = { lodged_at: 'x', formal_approval_at: 'x', settled_at: 'x' }
    delete deal[undoable(deal)!.key]
    expect(undoable(deal)?.key).toBe('formal_approval_at')
    delete deal[undoable(deal)!.key]
    expect(undoable(deal)?.key).toBe('lodged_at')
  })

  // Contracts returned and Settlement booked belong to the settlements panel -
  // the same reason they have no button up here.
  it('nothing this panel does not record', () => {
    expect(undoable({ lodged_at: 'x', contracts_returned_at: 'x' })).toBeNull()
    expect(undoable({ lodged_at: 'x', settlement_booked_at: 'x' })).toBeNull()
  })

  it('and nothing at all on a deal that has reached nothing', () => {
    expect(undoable({})).toBeNull()
  })
})

describe('what the undo touches', () => {
  it('clears the date and writes nothing else', () => {
    expect(SRC).toContain('.update({ [undoable.key]: null })')
  })

  it('keeps the snapshot - the lender, the amount and the splits', () => {
    // Fabio chose this: if the undo was itself the mistake, nothing is lost.
    // Comments stripped, or the note explaining what is kept reads as code
    // that touches it.
    const revert = SRC.slice(SRC.indexOf('async function revertIt'), SRC.indexOf('async function confirmIt'))
      .replace(/\/\/[^\n]*/g, '')
    expect(revert).not.toContain('deal_stage_snapshots')
    expect(revert).not.toContain('loan_amount')
    expect(revert).not.toContain('lodged_total')
    expect(revert).not.toContain('settled_total')
  })

  it('and says out loud that compliance is untouched', () => {
    expect(SRC).toContain('Nothing on Compliance or anything before it changes')
  })

  it('checks the write reached the database, like every other write here', () => {
    const revert = SRC.slice(SRC.indexOf('async function revertIt'), SRC.indexOf('async function confirmIt'))
    expect(revert).toContain('NOT UNDONE - the change did not reach the database.')
  })
})
