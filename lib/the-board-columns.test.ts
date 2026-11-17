import { describe, it, expect } from 'vitest'
import { GROUPS, LANE_KEYS, TONE_INK, laneOf, readyToPush, newestFirst, sortIntoLanes } from './the-board-columns'

// A deal far enough along to have a real phase. Each test adds what it needs.
const base = {
  id: 'd1', created_at: '2026-11-01T00:00:00Z',
  fact_find_data: { applicants: [{ dob: '1990-01-01' }] },
}
const bcDone = { ...base, bc_completed_at: '2026-11-02T00:00:00Z' }
const loDone = { ...bcDone, bc_sent_at: '2026-11-02T01:00:00Z', client_proceeded: true,
  lo_completed_at: '2026-11-04T00:00:00Z' }
const compDone = { ...loDone, lo_sent_at: '2026-11-04T01:00:00Z', lo_client_proceeded: true,
  compliance_completed_at: '2026-11-06T00:00:00Z' }

describe('the board is one lane per stage and holder', () => {
  it('has a lane for every one of them, and no duplicates', () => {
    // 15 since 19 Nov 2026: Lending options gained "Awaiting docs".
    expect(LANE_KEYS).toHaveLength(15)
    expect(new Set(LANE_KEYS).size).toBe(15)
  })

  // 18 Nov 2026. The first cut folded the whole tracked half into one lane,
  // which would have deleted six working columns and the settlement sub-tabs
  // with them. Only the written half is split by who is holding the file.
  it('keeps every column the tracked half already had', () => {
    for (const k of ['lodged', 'preapproved', 'offer_accepted', 'formal',
                     'contracts_returned', 'settlement_booked']) {
      expect(LANE_KEYS, `${k} is missing, so that column is gone from the board`).toContain(k)
    }
  })

  // ONE COLOUR PER STAGE, whatever the sub-column.
  it('gives each stage one tone across its lanes', () => {
    const bc = GROUPS.find(g => g.title === 'Borrowing capacity')!
    expect(bc.lanes.map(l => l.key)).toEqual(['bc_us', 'bc_client'])
    expect(bc.tone).toBe('bc')
  })
})

describe('which lane a deal is in', () => {
  it('a card with nothing done is a new lead', () => {
    expect(laneOf({ id: 'x', created_at: '2026-11-01T00:00:00Z' })).toBe('lead')
  })

  it('a BC being written is with credit', () => {
    expect(laneOf(base)).toBe('bc_us')
  })

  it('a BC sent out is with the client', () => {
    expect(laneOf({ ...base, bc_completed_at: '2026-11-02T00:00:00Z',
      bc_sent_at: '2026-11-02T01:00:00Z' })).toBe('bc_client')
  })

  it('lending options being written are with credit', () => {
    expect(laneOf(loDone)).toBe('lo_us')
  })

  it('and sent, they are with the client', () => {
    expect(laneOf({ ...loDone, lo_sent_at: '2026-11-04T01:00:00Z' })).toBe('lo_client')
  })

  it('compliance being written is with credit', () => {
    expect(laneOf({ ...loDone, lo_sent_at: '2026-11-04T01:00:00Z', lo_client_proceeded: true }))
      .toBe('comp_us')
  })

  // THE GAP CLOSED ON 18 NOV - a pack out for signature used to read as the bank's.
  it('compliance sent for signature is with the client', () => {
    expect(laneOf({ ...compDone, compliance_sent_at: '2026-11-07T00:00:00Z' })).toBe('comp_client')
  })

  it('past lodgement, each stage keeps its own column', () => {
    const lodged = { ...compDone, compliance_sent_at: '2026-11-07T00:00:00Z',
      lodged_at: '2026-11-08T00:00:00Z' }
    expect(laneOf(lodged)).toBe('lodged')
    expect(laneOf({ ...lodged, formal_approval_at: '2026-11-12T00:00:00Z' })).toBe('formal')
  })

  // SETTLED KEEPS ITS COLUMN. 18 Nov 2026 - the first cut of this file sent
  // settled deals to no board at all, which would have taken a working column
  // off the half Fabio said does not change, and the "To close out" sub-tab
  // with it. Only a dead deal is on no board.
  it('a settled deal keeps its own column', () => {
    expect(laneOf({ ...compDone, settled_at: '2026-11-20T00:00:00Z' })).toBe('settled')
  })

  it('and a dead deal is on no board at all', () => {
    expect(laneOf({ ...compDone, status: 'lost' })).toBe(null)
  })
})

describe('the client said yes', () => {
  // Agreeing to the lending options is the milestone that moves a deal into
  // Compliance. So the green pile is the top of Compliance - the ones to push.
  const agreed = { ...loDone, lo_sent_at: '2026-11-04T01:00:00Z', lo_client_proceeded: true }

  it('lands in compliance, with credit', () => {
    expect(laneOf(agreed)).toBe('comp_us')
  })

  it('and the card is green until somebody writes the compliance', () => {
    expect(readyToPush(agreed)).toBe(true)
  })

  it('not before they have answered', () => {
    expect(readyToPush({ ...loDone, lo_sent_at: '2026-11-04T01:00:00Z' })).toBe(false)
  })

  // 19 Nov 2026. It used to stop here, at compliance WRITTEN. Fabio: "once
  // the compliance is pushed to sales tracker, just bring it back to the
  // colour of the credit assessor that worked on the file." Written is not
  // pushed, and a file written but not pushed is exactly the one to chase.
  it('and stays green while it is written but not pushed', () => {
    expect(readyToPush(compDone)).toBe(true)
  })

  it('and stops the moment it goes to SalesTrekker', () => {
    expect(readyToPush({ ...compDone, compliance_sent_at: '2026-11-07T00:00:00Z' }))
      .toBe(false)
  })
})

// THREE WAITS, THREE COLUMNS - 19 Nov 2026.
//
// Fabio: "it's not with us, because it sounds like we're waiting on credit and
// then credit gets in trouble for not doing the deal, but it's not with the
// client because we haven't selected the options."
describe('lending options is three columns', () => {
  const agreedBc = { ...base, bc_completed_at: '2026-11-02T00:00:00Z',
    bc_sent_at: '2026-11-02T01:00:00Z', client_proceeded: true }

  // Asked for, nothing back. The deal cannot move and credit cannot move it.
  const asked = { ...agreedBc,
    document_progress: { requests: [{ at: '2026-11-03T00:00:00Z', by: 'me', keys: ['payslip'] }] } }

  it('awaiting docs, while we are waiting on the client to send them', () => {
    expect(laneOf(asked)).toBe('lo_docs')
  })

  it('with credit, the moment the documents are in', () => {
    expect(laneOf({ ...asked, docs_received_at: '2026-11-05T00:00:00Z' })).toBe('lo_us')
  })

  it('with credit when nothing was ever asked for', () => {
    expect(laneOf(agreedBc)).toBe('lo_us')
  })

  it('with client once the options have gone out, whatever is outstanding', () => {
    expect(laneOf({ ...asked, lo_completed_at: '2026-11-06T00:00:00Z',
                    lo_sent_at: '2026-11-06T01:00:00Z' })).toBe('lo_client')
  })

  // Asked directly on 19 Nov: "no documents on BC please". A BC is written off
  // what the client tells us, not off their paperwork.
  it('and borrowing capacity is still two columns', () => {
    const bcGroup = GROUPS.find(g => g.key === 'bc')!
    expect(bcGroup.lanes.map(l => l.key)).toEqual(['bc_us', 'bc_client'])
  })
})

describe('newest on top, everywhere', () => {
  it('sorts by when the card was made', () => {
    const rows = [
      { id: 'old', created_at: '2026-10-01T00:00:00Z' },
      { id: 'new', created_at: '2026-11-15T00:00:00Z' },
      { id: 'mid', created_at: '2026-11-01T00:00:00Z' },
    ]
    expect(newestFirst(rows).map(r => r.id)).toEqual(['new', 'mid', 'old'])
  })

  it('a card with no date goes last rather than breaking the list', () => {
    const rows = [{ id: 'none' }, { id: 'dated', created_at: '2026-11-01T00:00:00Z' }]
    expect(newestFirst(rows).map(r => r.id)).toEqual(['dated', 'none'])
  })

  it('and never changes the array it was handed', () => {
    const rows = [{ id: 'a', created_at: '2026-10-01T00:00:00Z' },
                  { id: 'b', created_at: '2026-11-01T00:00:00Z' }]
    newestFirst(rows)
    expect(rows.map(r => r.id)).toEqual(['a', 'b'])
  })
})

describe('sorting the whole book into lanes', () => {
  it('leaves an empty lane in place rather than dropping it', () => {
    const lanes = sortIntoLanes([base])
    expect(Object.keys(lanes)).toEqual(LANE_KEYS)
    expect(lanes.lo_client).toEqual([])
  })

  it('puts each deal in exactly one lane', () => {
    const lanes = sortIntoLanes([base, loDone, { ...compDone, lodged_at: '2026-11-08T00:00:00Z' }])
    const total = LANE_KEYS.reduce((n, k) => n + lanes[k].length, 0)
    expect(total).toBe(3)
  })

  it('keeps a settled deal, and quietly leaves out a dead one', () => {
    const done = sortIntoLanes([{ ...compDone, settled_at: '2026-11-20T00:00:00Z' }])
    expect(done['settled']).toHaveLength(1)
    const dead = sortIntoLanes([{ ...compDone, status: 'lost' }])
    expect(LANE_KEYS.reduce((n, k) => n + dead[k].length, 0)).toBe(0)
  })
})

describe('the bars', () => {
  it('gives every stage a colour, and never the same one twice', () => {
    const inks = GROUPS.map(g => TONE_INK[g.tone])
    expect(inks.every(Boolean)).toBe(true)
    // WITH THE LENDER IS NOT THE SAME GREEN AS TO SETTLEMENT. Fabio, 18 Nov:
    // "with lender and settlement dont use the same colour both are green
    // thats an issue".
    expect(TONE_INK.lender).not.toBe(TONE_INK.settlement)
    expect(new Set(Object.values(TONE_INK)).size).toBe(Object.keys(TONE_INK).length)
  })
})
