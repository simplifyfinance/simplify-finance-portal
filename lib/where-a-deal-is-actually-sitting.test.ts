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
    expect(whoHasIt({ ...PAST_BC, status: 'completed' })).toBeNull()
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

describe('and it is finally on the board', () => {
  const board = readFileSync('components/DealBoard.tsx', 'utf8')

  it('the card draws it', () => {
    expect(board).toContain("import { whoHasIt, holderLabel } from '@/lib/who-has-it'")
    expect(board).toContain('const w = whoHasIt(d)')
    expect(board).toContain('{holderLabel(w)}')
  })

  it('using the same colours as every other screen, not new ones', () => {
    // Blue is work in hand and purple is the client everywhere in the portal.
    // Nobody learns a new colour for the board.
    expect(board).toContain('${w.style}')
  })
})

describe('the other screens still read it the same way', () => {
  it('the deal page, the deals list and Today', () => {
    for (const f of ['app/(app)/deals/[id]/DealPageClient.tsx',
                     'app/(app)/deals/page.tsx',
                     'components/TodayPlan.tsx']) {
      expect(readFileSync(f, 'utf8'), `${f} stopped reading whoHasIt`).toContain('whoHasIt')
    }
  })
})
