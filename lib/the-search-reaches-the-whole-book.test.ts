import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { stageWaitingOn } from './the-days-plan'
import { phaseOf, PHASE_LABEL } from './deal-phase'

// THE SEARCH REACHES THE WHOLE BOOK.
//
// 19 Nov 2026. Fabio: "the 'today' section for credit mellissa Katie and
// Dinisha the search button is not working see screesnhot".
//
// It was working. It was searching a quarter of the book.
//
// The list behind the box was built like this:
//
//     stage: stageWaitingOn(d) || ''
//     ...
//     .filter(x => x.stage)
//
// stageWaitingOn() answers one question - WHICH STAGE IS SITTING WITH US -
// and by design it answers null the moment a deal is not ours to act on. With
// the client. With the lender. Lodged, approved, settled. All null, all
// thrown away by that last line, none of them findable. An assessor typing a
// real client's name read "Nothing matches" about a deal that was open on her
// other screen.
//
// A search box is not a suggestion. Nothing about which deals the portal
// OFFERS her changed - this is only about what she can go and find when she
// already knows what she is looking for.

const TODAY = readFileSync('components/TodayPlan.tsx', 'utf8')
const PICK = readFileSync('components/PickTheDay.tsx', 'utf8')

// Out for signature, which is the client's turn - see whoHasIt().
const signing = {
  id: 'a', deal_name: 'Hargreaves - refinance',
  fact_find_data: { applicants: [{ dob: '1980-01-01' }] },
  client_proceeded: true, lo_client_proceeded: true,
  compliance_sent_at: '2026-11-12T00:00:00Z',
}

describe('a deal that is not sitting with us still has a name and a place', () => {
  it('has no stage waiting on us - which is correct, and was the bug', () => {
    expect(stageWaitingOn(signing)).toBeNull()
  })

  it('and phaseOf still says exactly where it is', () => {
    expect(PHASE_LABEL[phaseOf(signing)]).toBe('Compliance sent')
  })
})

describe('the credit day does not throw those deals out of the search', () => {
  it('labels them from phaseOf instead of dropping them', () => {
    expect(TODAY).toContain('stage: stageWaitingOn(d) || PHASE_LABEL[phaseOf(d)]')
  })

  it('and the line that dropped them is gone', () => {
    // The map that builds the searchable list, and nothing after it that
    // filters on a stage being present.
    const i = TODAY.indexOf('const otherFiles')
    expect(i).toBeGreaterThan(-1)
    const block = TODAY.slice(i, TODAY.indexOf('}, [deals, mine, meOfficerId])', i))
    expect(block, 'a deal with no stage is still a deal she can look up')
      .not.toContain('.filter(x => x.stage)')
  })

  it('still offers her nothing from it - it is reached by typing only', () => {
    expect(PICK).toContain('const found = looking')
    expect(PICK).toContain('others.filter(d => !mineIds.has(d.id) && hit(d, needle))')
  })
})

describe('the box searches what it says it searches', () => {
  it('says type a client name', () => {
    expect(PICK).toContain('type a client name')
  })

  it('and reads the client name, not the deal name alone', () => {
    expect(PICK).toContain("`${d.name || ''} ${d.client || ''}`.toLowerCase().includes(needle)")
  })

  it('with the name put on the row where the list is built', () => {
    expect(TODAY).toContain('client: clientName(d)')
    expect(TODAY).toContain("d?.clients?.first_name")
  })
})
