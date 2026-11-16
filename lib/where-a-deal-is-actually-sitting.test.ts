// WHERE A DEAL IS ACTUALLY SITTING.
//
// 27 Oct 2026. Catherine, Operations Manager, item 1 of nine:
//
//   "Show where a deal is actually sitting. For example, a deal can be with
//    doc collection while the pipeline says it's with Credit. I saw one deal
//    with a 'with the client' outline, so it would be good to know what
//    triggers that and build on it."
//
// Two things in one sentence, and they want different answers.
//
// The chip she saw exists and has since 22 October. It was on the deal page,
// the deals list and Today - everywhere except the board, which is the screen
// she works from. That half is wiring.
//
// The other half is a real gap. Once a client agrees to the BC, the next
// unticked step on the ladder is the lending options, so the ladder says the
// deal is with credit. In the office it is sitting still because nobody has
// sent their payslips. The portal already knows both facts; nothing joined
// them up.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { whoHasIt, waitingOnDocuments, holderLabel } from './who-has-it'

const asked = (at = '2026-10-20T00:00:00Z') => ({
  requests: [{ at, by: 'Mark Gallo', keys: ['payslip:a1'] }],
})

// A deal past the BC. The ladder says credit should be writing the LO.
const PAST_BC = {
  id: 'd1',
  fact_find_data: { applicants: [{ firstName: 'A' }] },
  bc_completed_at: '2026-10-10T00:00:00Z',
  bc_sent_at: '2026-10-11T00:00:00Z',
  client_proceeded: true,
}

describe('what the ladder says on its own', () => {
  it('a deal past the BC is with us', () => {
    expect(whoHasIt(PAST_BC)?.holder).toBe('us')
    expect(whoHasIt(PAST_BC)?.label).toBe('With us')
  })

  it('a deal waiting for the client to answer the BC is with the client', () => {
    const sent = { ...PAST_BC, client_proceeded: false }
    expect(whoHasIt(sent)?.holder).toBe('client')
  })

  it('and a lodged deal is with the lender', () => {
    const lodged = { ...PAST_BC, lo_completed_at: 'x', lo_sent_at: 'x',
                     lo_client_proceeded: true, compliance_completed_at: 'x' }
    expect(whoHasIt(lodged)?.holder).toBe('lender')
  })

  it('a finished or lost deal is holding nobody up', () => {
    // settled_at, not status 'completed'. 12 Nov 2026: nothing in the
    // codebase has ever written that status, so this test passed on a shape
    // production cannot produce while settled deals were being counted as
    // work waiting on a bank. See lib/dashboard-funnel.test.ts.
    expect(whoHasIt({ ...PAST_BC, settled_at: '2026-11-01T13:00:00+00:00' })).toBeNull()
    expect(whoHasIt({ ...PAST_BC, status: 'lost' })).toBeNull()
  })
})

describe('THE ONE CATHERINE CAUGHT: waiting on documents', () => {
  const waiting = { ...PAST_BC, document_progress: asked() }

  it('documents asked for and not received means the client has it', () => {
    expect(waitingOnDocuments(waiting)).toBe(true)
    expect(whoHasIt(waiting)?.holder).toBe('client')
  })

  it('and the chip says what the wait is for', () => {
    // Fabio cut this to three words in October - "just say with us, with
    // client kind of thing" - so it is not a fourth answer. It is the same
    // answer, with the reason on it.
    expect(whoHasIt(waiting)?.label).toBe('With client')
    expect(holderLabel(whoHasIt(waiting))).toBe('With client — documents')
  })

  it('once Docs received is pressed it is ours again', () => {
    const back = { ...waiting, docs_received_at: '2026-10-25T00:00:00Z' }
    expect(waitingOnDocuments(back)).toBe(false)
    expect(whoHasIt(back)?.holder).toBe('us')
  })

  it('a deal where nothing was ever asked for is not waiting on documents', () => {
    expect(waitingOnDocuments(PAST_BC)).toBe(false)
    expect(waitingOnDocuments({ ...PAST_BC, document_progress: { requests: [] } })).toBe(false)
  })

  it('and it never overrides a wait that is already the client’s', () => {
    // One wait, named once. A deal sitting with the client on the BC does not
    // become "with client - documents" just because documents were also asked
    // for; the BC is what everyone is actually waiting on.
    const onBc = { ...PAST_BC, client_proceeded: false, document_progress: asked() }
    expect(whoHasIt(onBc)?.label).toBe('With client')
    expect(holderLabel(whoHasIt(onBc))).toBe('With client')
  })

  it('or a deal that is with the lender', () => {
    const lodged = { ...PAST_BC, lo_completed_at: 'x', lo_sent_at: 'x',
                     lo_client_proceeded: true, compliance_completed_at: 'x',
                     document_progress: asked() }
    expect(whoHasIt(lodged)?.holder).toBe('lender')
  })

  it('and holderLabel on nothing is nothing, not the word undefined', () => {
    expect(holderLabel(null)).toBe('')
  })
})

// IT CAME OFF THE BOARD AGAIN, AND FOR A GOOD REASON.
//
// 18 Nov 2026. The board's columns now say who is holding a deal up - "BC with
// credit" beside "BC with client" - so a chip underneath repeating it was the
// card printing its own address. Fabio: "With us and with the client, doesn't
// that defeat the purpose now that we have the breakdown of all the portal
// between us and them? Like, it doesn't make sense."
//
// whoHasIt() is not retired - it is what SORTS the cards into those columns now
// (see lib/the-board-columns.ts), which is a bigger job than drawing a chip. It
// is still drawn on the deal page, the deals list and Today, which have no
// columns to say it for them, and those are checked below.
describe('and the board says it with its columns instead of a chip', () => {
  const board = readFileSync('components/DealBoard.tsx', 'utf8')
  const lanes = readFileSync('lib/the-board-columns.ts', 'utf8')

  it('the columns are built on it', () => {
    expect(lanes).toContain("import { whoHasIt } from './who-has-it'")
    expect(lanes).toContain('const w = whoHasIt(deal)')
  })

  it('and the card does not say it a second time', () => {
    expect(board).not.toContain('{holderLabel(w)}')
  })
})

describe('the other screens still read it the same way', () => {
  // THE DEAL PAGE CAME OFF THIS LIST ON 16 NOV 2026, and that is the decision,
  // not an oversight.
  //
  // The board grew a column for BC-with-credit beside BC-with-client, so the
  // chip on the deal page was the card printing its own address. Fabio:
  // "doesn't that defeat the purpose now that we have the breakdown of all the
  // portal between us and them". It is on the GONE list in
  // lib/nothing-on-the-deal-page-is-lost.test.ts with the date and the reason.
  //
  // THE RULE ITSELF IS UNTOUCHED. whoHasIt still decides the board's columns
  // and still answers for the deals list and Today, which is what this test
  // was always really guarding.
  it('the deals list and Today', () => {
    for (const f of ['app/(app)/deals/page.tsx',
                     'components/TodayPlan.tsx']) {
      expect(readFileSync(f, 'utf8'), `${f} stopped reading whoHasIt`).toContain('whoHasIt')
    }
  })

  it('and the deal page says who in credit has it, once, on Where it is', () => {
    const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
    expect(page).toMatch(/With \{String\(dealData\.assigned_credit_officer\)/)
  })
})
