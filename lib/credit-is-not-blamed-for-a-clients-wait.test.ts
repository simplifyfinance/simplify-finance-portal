import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { getWaitingOnLabel } from './deal-status'
import { laneOf, GROUPS } from './the-board-columns'
import { whoHasIt, waitingOnDocuments } from './who-has-it'
import { waitingOnDocuments as fromDocuments } from './document-progress'

// CREDIT IS NOT BLAMED FOR A WAIT CREDIT CANNOT END.
//
// 19 Nov 2026. Fabio: "someone agrees with the borrowing capacity. They want
// to go ahead, but we're still waiting for documents to start the lending
// options process. So it's not with us, because it sounds like we're waiting
// on credit and then credit gets in trouble for not doing the deal, but it's
// not with the client because we haven't selected the options."
//
// Two things were saying the wrong thing about the same deal.
//
// THE BOARD put it in "With client", beside deals where the options had gone
// out and somebody was choosing a bank. Two completely different waits in one
// column: one the sales team must chase, one they must leave alone.
//
// THE SENTENCE was worse. "Waiting on: Mellissa to complete LO" - on a deal
// where Mellissa was waiting on payslips. That line is on the deals list, the
// peek and the deal page, and it is the one a person actually reads.

const base = {
  id: 'd1', created_at: '2026-11-01T00:00:00Z',
  fact_find_data: { applicants: [{ dob: '1990-01-01' }] },
  bc_completed_at: '2026-11-02T00:00:00Z',
  bc_sent_at: '2026-11-02T01:00:00Z',
  client_proceeded: true,
}

const asked = {
  ...base,
  document_progress: { requests: [{ at: '2026-11-03T00:00:00Z', by: 'Fabio', keys: ['payslip'] }] },
}
const arrived = { ...asked, docs_received_at: '2026-11-05T00:00:00Z' }

describe('a deal waiting on documents', () => {
  it('is waiting on documents, by the portal’s own answer', () => {
    expect(waitingOnDocuments(asked)).toBe(true)
    expect(waitingOnDocuments(arrived)).toBe(false)
  })

  it('gets a column of its own, not credit’s and not the choosing one', () => {
    expect(laneOf(asked)).toBe('lo_docs')
    expect(laneOf(arrived)).toBe('lo_us')
  })

  it('and the sentence names the client, not the assessor', () => {
    const line = getWaitingOnLabel(asked, 'Mellissa Sedin')
    expect(line?.text).toBe('Waiting on: Client to send documents')
    expect(line?.text).not.toContain('Mellissa')
  })

  it('which is the same colour the ladder uses for a client wait', () => {
    expect(getWaitingOnLabel(asked, 'Mellissa Sedin')?.color).toBe('pro')
  })
})

describe('nothing else about the sentence moved', () => {
  it('the moment the documents land, it is credit again', () => {
    expect(getWaitingOnLabel(arrived, 'Mellissa Sedin')?.text)
      .toBe('Waiting on: Mellissa Sedin to complete LO')
  })

  it('a deal nobody has asked anything of is credit’s, as before', () => {
    expect(getWaitingOnLabel(base, 'Mellissa Sedin')?.text)
      .toBe('Waiting on: Mellissa Sedin to complete LO')
  })

  it('and the holder chip still says the client, which it always did', () => {
    // whoHasIt has three answers and this does not add a fourth. The column is
    // finer than the chip on purpose: the chip answers "can anybody here move
    // it", the column answers "who exactly, and for what".
    expect(whoHasIt(asked)?.holder).toBe('client')
    expect(whoHasIt(asked)?.why).toBe('documents')
  })
})

// ONE ANSWER, ONE HOME.
//
// The documents question used to live in who-has-it. deal-status.ts needs the
// same answer, and who-has-it already reads deal-status - so a straight import
// would have been a circle and a copy would have been two answers waiting to
// disagree. It moved to the file that owns documents and both read it there.
describe('there is still only one copy of the question', () => {
  it('who-has-it hands out the very same function', () => {
    expect(waitingOnDocuments).toBe(fromDocuments)
  })
})

// AND THE SCREEN DRAWS WHAT THE MOCK DREW.
//
// docs/approved-looks/lending-options-three-columns.html, rendered with the
// stylesheet the build produced and agreed before any of this was written.
// Read off the disk, not out of my memory of it - see the note at the top of
// lib/the-mock-and-the-screen.test.ts for why that rule exists.
describe('the three columns match the approved look', () => {
  const MOCK = readFileSync(
    'docs/approved-looks/lending-options-three-columns.html', 'utf8')
  const COLS = readFileSync('lib/the-board-columns.ts', 'utf8')

  it('the three headings, in that order', () => {
    const lo = GROUPS.find(g => g.key === 'lo')!
    expect(lo.lanes.map(l => l.label))
      .toEqual(['Awaiting docs', 'With credit', 'With client'])
    for (const label of lo.lanes.map(l => l.label)) {
      expect(MOCK.toLowerCase()).toContain(label.toLowerCase())
    }
  })

  it('and one colour for the whole stage, as every other stage has', () => {
    // Fabio, 18 Nov: one colour per stage whatever the sub-column. A third
    // column must not become a third colour.
    expect(COLS).toContain("{ key: 'lo', title: 'Lending options', tone: 'lo'")
  })
})
