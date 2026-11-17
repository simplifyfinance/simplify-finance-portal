import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { stageWaitingOn, stageOrClient, WITH_THE_CLIENT } from './the-days-plan'
import { stageRank, byStageThenAge } from './the-credit-order'
import { whoHasIt } from './who-has-it'

// WITH THE CLIENT IS STILL HER LIST.
//
// 19 Nov 2026. Mellissa's Today drew four deals, all borrowing capacity, and
// she is carrying thirty-one. Fabio, on the screenshot: "she only had BC's
// deals... there should be a lot more."
//
// The list was built on stageWaitingOn(), which answers WHICH STAGE IS SITTING
// WITH US and nothing else. A deal flips away from us the moment we ask the
// client for documents, send a BC out for an answer, or send compliance for
// signature - so almost every LO and compliance file she holds was thrown away
// before the list drew. BC work survived because nothing has been asked of the
// client that early. Four deals, all BC. That is the whole bug.
//
// Fabio: "add everything that has with client, because yeah, it's really hard
// to tell apart."
//
// IT IS A BAND, NOT A MERGE. She cannot assess a deal that is with a client.
// She can chase it, and the one she sent out eleven days ago is the one that
// should bother her. So it is on the list, under everything she can finish,
// quieter, and labelled with what the client is actually sitting on.
//
// WITH THE LENDER STAYS OUT. A lodged file is not credit's to chase, and
// putting it here would make this screen a copy of the board.

const base = {
  id: 'x', deal_name: 'Vanterpool - refinance',
  fact_find_data: { applicants: [{ dob: '1980-01-01' }] },
}

// Out for signature: the client's turn, by whoHasIt's own rule.
const signing = { ...base, client_proceeded: true, lo_client_proceeded: true,
                  compliance_sent_at: '2026-11-12T00:00:00Z' }

// Compliance, sitting with us.
const ours = { ...base, client_proceeded: true, lo_client_proceeded: true }

describe('a deal with the client', () => {
  it('is with the client, and the portal already said so', () => {
    expect(whoHasIt(signing)?.holder).toBe('client')
  })

  it('has no stage waiting on us - which is why it vanished', () => {
    expect(stageWaitingOn(signing)).toBeNull()
  })

  it('and now has a band of its own', () => {
    expect(stageOrClient(signing)).toBe(WITH_THE_CLIENT)
  })
})

describe('nothing she can act on moved', () => {
  it('a stage sitting with us answers exactly as it did', () => {
    expect(stageOrClient(ours)).toBe(stageWaitingOn(ours))
    expect(stageOrClient(ours)).toBe('Compliance')
  })

  it('and stageWaitingOn itself was not loosened', () => {
    // Every count in the portal is built on this one. It still means what it
    // has always meant, which is the reason the new band is a second function.
    expect(stageWaitingOn(signing)).toBeNull()
  })
})

describe('it sits under everything she can finish', () => {
  it('below the fact find, which is the furthest of her own work', () => {
    expect(stageRank('Fact Find')).toBeLessThan(stageRank(WITH_THE_CLIENT))
  })

  it('so the order puts it last however old it is', () => {
    const out = byStageThenAge([
      { stage: WITH_THE_CLIENT, since: '2026-01-01' },
      { stage: 'BC', since: '2026-11-15' },
      { stage: 'Compliance', since: '2026-11-14' },
    ]).map(r => r.stage)
    expect(out).toEqual(['Compliance', 'BC', WITH_THE_CLIENT])
  })
})

const PICK = readFileSync('components/PickTheDay.tsx', 'utf8')
const TODAY = readFileSync('components/TodayPlan.tsx', 'utf8')

describe('the screen draws it as a band she cannot mistake for work', () => {
  it('says chase or wait beside the count', () => {
    expect(PICK).toContain("'With the client': 'chase or wait'")
  })

  it('wears purple, which already means the client everywhere else', () => {
    expect(PICK).toContain('text-waiting bg-waiting-bg border border-waiting-edge')
    expect(PICK).toContain("b.name === WITH_CLIENT ? 'text-waiting' : 'text-brand-ink'")
  })

  it('and says what the client is sitting on, in holderLabel words', () => {
    expect(TODAY).toContain("import { whoHasIt, holderLabel } from '@/lib/who-has-it'")
    expect(PICK).toContain('{d.stage === WITH_CLIENT && d.why && <span className={WAIT_P}>{d.why}</span>}')
  })
})

describe("a broker's own day is untouched", () => {
  it('because his client deals are already on the right of that page', () => {
    expect(TODAY).toContain('meOfficerId ? stageOrClient(d) : stageWaitingOn(d)')
  })
})
