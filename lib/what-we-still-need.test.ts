// WHAT WE STILL NEED FROM THE CLIENT.
//
// 27 Oct 2026. Catherine, Operations Manager, on why deals keep coming back:
// "we are stuglging as there a feel gaps we need customers to clarify for
// example employment history we need 3 years same with addres history".
//
// Every name and figure in here is invented.
import { describe, it, expect } from 'vitest'
import {
  gapsFound, openQuestions, closedQuestions, closedLine, goingOut,
  askedPatch, closeByHandPatch, reopenPatch, askedByHand, newHandQuestion,
  blockHeading, blockLead, askedLine, reachesBackTo, marksOn,
} from './what-we-still-need'
import { REQUIRED_HISTORY_MONTHS } from './fact-find'

const TODAY = new Date('2026-10-27')

// Priya is 25 months into one address and 33 months across two jobs. Daniel has
// been in the same place and the same job for years, so he is only ever short
// of the things nobody has typed.
const DEAL: any = {
  id: 'd1',
  fact_find_data: {
    dependants: '2',
    applicants: [
      { id: 'a1', firstName: 'Priya', lastName: 'Whitcombe',
        residencyStatus: 'Citizen', relationshipStatus: 'Married',
        addresses: [{ isCurrent: true, address: '14 Pelham St', residentialStatus: 'Owner',
                      startDate: '2024-09-09' }],
        employment: [
          { isCurrent: true, employmentPriority: 'Primary', employerName: 'Harrow',
            startDate: '2025-03-01' },
          { isCurrent: false, employmentPriority: 'Primary', employerName: 'Calder',
            startDate: '2024-01-01', endDate: '2025-03-01' },
        ] },
      { id: 'a2', firstName: 'Daniel',
        residencyStatus: 'Citizen', relationshipStatus: 'Married',
        addresses: [{ isCurrent: true, startDate: '2019-01-01' }],
        employment: [{ isCurrent: true, employmentPriority: 'Primary', startDate: '2018-01-01' }] },
    ],
    assets: [
      { assetType: 'Savings', description: 'ANZ Access', value: '18400' },
      { assetType: 'Super', description: 'Australian Retirement Trust', value: '96200' },
    ],
  },
}

const keys = (deal: any) => openQuestions(deal, TODAY).map(q => q.key)
const find = (deal: any, key: string) => gapsFound(deal, TODAY).find(q => q.key === key)!

describe('the gaps the portal can already see', () => {
  it('finds the short address history, and names the DATE not the month count', () => {
    // Nobody can act on "eleven months short". They can act on a date.
    const q = find(DEAL, 'address_history:a1')
    expect(q.ask).toBe('Priya — where did you live before September 2024?')
    expect(q.why).toBe(`25 months of the ${REQUIRED_HISTORY_MONTHS} a lender needs.`)
  })

  it('finds the short employment history the same way', () => {
    expect(find(DEAL, 'employment_history:a1').ask)
      .toBe('Priya — who did you work for before January 2024?')
  })

  it('and leaves alone the applicant who has nothing missing', () => {
    expect(keys(DEAL).some(k => k.endsWith(':a2'))).toBe(false)
  })

  it('a secondary job does not count towards the three years', () => {
    // It runs ALONGSIDE the primary, so counting it would add the same months
    // twice and make a short history look complete.
    const withSecond = JSON.parse(JSON.stringify(DEAL))
    withSecond.fact_find_data.applicants[0].employment.push({
      isCurrent: true, employmentPriority: 'Secondary', employerName: 'Weekend bar',
      startDate: '2020-01-01',
    })
    expect(keys(withSecond)).toContain('employment_history:a1')
  })

  it('nobody has to be asked twice: fill the gap and the question is gone', () => {
    const after = JSON.parse(JSON.stringify(DEAL))
    after.fact_find_data.applicants[0].addresses.push({
      isCurrent: false, address: '8 Marlowe Rd', startDate: '2021-11-01', endDate: '2024-09-09',
    })
    expect(keys(after)).not.toContain('address_history:a1')
  })

  it('a history that has no dates at all still gets a question, just a wider one', () => {
    const blank = { fact_find_data: { applicants: [{ id: 'x', firstName: 'Sam', addresses: [], employment: [] }] } }
    expect(find(blank, 'address_history:x').ask).toBe('Sam — what are your last three years of addresses?')
  })

  it('reachesBackTo ignores a date somebody typed in the future', () => {
    expect(reachesBackTo([{ startDate: '2030-01-01' }], TODAY)).toBe('')
    expect(reachesBackTo([{ startDate: '2024-09-09' }], TODAY)).toBe('September 2024')
  })
})

describe('a gap between two jobs', () => {
  // 27 Oct 2026. Fabio: "fix the gap between 2 jobs". The months are added up,
  // so a hole in the middle of them is invisible to that sum - and the hole is
  // what a lender asks about.
  const holed = JSON.parse(JSON.stringify(DEAL))
  holed.fact_find_data.applicants[0].employment = [
    { isCurrent: true, employmentPriority: 'Primary', employerName: 'Harrow', startDate: '2025-07-03' },
    { isCurrent: false, employmentPriority: 'Primary', employerName: 'Calder',
      startDate: '2023-01-03', endDate: '2025-03-03' },
  ]

  it('is asked about by the months it covers', () => {
    const q = gapsFound(holed, TODAY).find(x => x.kind === 'employment_gap')!
    expect(q.ask).toBe('Priya — what were you doing between March 2025 and July 2025?')
  })

  it('AND IT IS ASKED EVEN THOUGH THE TOTAL IS PAST THREE YEARS', () => {
    // 41 months. The shortfall question is gone and this one is not.
    expect(keys(holed)).not.toContain('employment_history:a1')
    expect(keys(holed).some(k => k.startsWith('employment_gap:a1'))).toBe(true)
  })

  it('it does not ask who they worked for', () => {
    // A break is as likely to be travel, study or a baby as a forgotten job,
    // and a question that assumes a job gets "none" and tells us nothing.
    const q = gapsFound(holed, TODAY).find(x => x.kind === 'employment_gap')!
    expect(q.ask).not.toContain('work for')
    expect(q.help).toContain('travelling')
  })

  it('and an address gap is its own question', () => {
    const addrs = JSON.parse(JSON.stringify(DEAL))
    addrs.fact_find_data.applicants[0].addresses = [
      { isCurrent: true, address: '14 Pelham St', startDate: '2025-07-03' },
      { isCurrent: false, address: '8 Marlowe Rd', startDate: '2021-01-03', endDate: '2025-03-03' },
    ]
    const q = gapsFound(addrs, TODAY).find(x => x.kind === 'address_gap')!
    expect(q.ask).toBe('Priya — where were you living between March 2025 and July 2025?')
  })

  it('each gap gets its own key, so two never share an answer', () => {
    const two = JSON.parse(JSON.stringify(DEAL))
    two.fact_find_data.applicants[0].employment = [
      { isCurrent: true, employmentPriority: 'Primary', startDate: '2026-06-03' },
      { isCurrent: false, employmentPriority: 'Primary', startDate: '2025-01-03', endDate: '2025-09-03' },
      { isCurrent: false, employmentPriority: 'Primary', startDate: '2024-01-03', endDate: '2024-06-03' },
    ]
    const gaps = gapsFound(two, TODAY).filter(x => x.kind === 'employment_gap')
    expect(gaps).toHaveLength(2)
    expect(new Set(gaps.map(g => g.key)).size).toBe(2)
  })

  it('an unbroken history is asked nothing', () => {
    expect(keys(DEAL).some(k => k.startsWith('employment_gap'))).toBe(false)
  })
})

describe('residency, marital status and dependants', () => {
  const noStatus = JSON.parse(JSON.stringify(DEAL))
  noStatus.fact_find_data.applicants[1].residencyStatus = ''
  noStatus.fact_find_data.applicants[1].relationshipStatus = ''

  it('an unanswered residency is asked, because it changes which lenders we can use', () => {
    expect(keys(noStatus)).toContain('residency:a2')
  })

  it('and an unanswered marital status', () => {
    expect(keys(noStatus)).toContain('marital:a2')
  })

  it('a COUNT of dependants is not their ages', () => {
    // Two aged 2 and 4 and two aged 19 and 22 are not the same household, and
    // nothing in the portal could tell them apart.
    expect(find(DEAL, 'dependant_ages').ask).toBe('You have 2 dependants — how old is each of them?')
  })

  it('and once the ages are in, it stops asking', () => {
    const aged = JSON.parse(JSON.stringify(DEAL))
    aged.fact_find_data.dependantAges = ['4', '7']
    expect(keys(aged)).not.toContain('dependant_ages')
  })

  it('a household with no dependants is never asked', () => {
    const none = JSON.parse(JSON.stringify(DEAL))
    none.fact_find_data.dependants = '0'
    expect(keys(none)).not.toContain('dependant_ages')
  })
})

describe('an asset nobody mentioned', () => {
  it('is asked about, because missing is not the same as none', () => {
    // No shares row might mean no shares, or might mean the conversation never
    // got that far. Credit cannot tell, so credit asks, so the client is chased
    // for something they already said.
    expect(keys(DEAL)).toContain('asset:shares')
    expect(keys(DEAL)).toContain('asset:home_contents')
    expect(keys(DEAL)).toContain('asset:vehicle')
  })

  it('and one that IS recorded is not asked about', () => {
    expect(keys(DEAL)).not.toContain('asset:super')
  })

  it('a car with no make, model or year is still a gap', () => {
    const vague = JSON.parse(JSON.stringify(DEAL))
    vague.fact_find_data.assets.push({ assetType: 'Vehicle', description: 'the ute', value: '22000' })
    const q = find(vague, 'asset:vehicle')
    expect(q.why).toBe('A car is recorded, but not its make, model and year.')
  })

  it('and a car described properly is not', () => {
    const full = JSON.parse(JSON.stringify(DEAL))
    full.fact_find_data.assets.push({ assetType: 'Vehicle', make: 'Toyota', model: 'HiLux',
                                      year: '2019', value: '32000' })
    expect(keys(full)).not.toContain('asset:vehicle')
  })

  it('a row with a type and nothing in it does not count as an answer', () => {
    const empty = JSON.parse(JSON.stringify(DEAL))
    empty.fact_find_data.assets.push({ assetType: 'Shares' })
    expect(keys(empty)).toContain('asset:shares')
  })
})

describe('asked is not answered', () => {
  const sent = { ...DEAL, ...askedPatch(DEAL, gapsFound(DEAL, TODAY).map(q => q.key), new Date('2026-10-14')) }

  it('sending an email records when each question FIRST went out', () => {
    expect(marksOn(sent)['address_history:a1'].askedAt).toBe(new Date('2026-10-14').toISOString())
  })

  it('and keeps the words it went out with', () => {
    // The gap it came from will be gone. A closed question still has to read as
    // something a year later.
    expect(marksOn(sent)['address_history:a1'].ask)
      .toBe('Priya — where did you live before September 2024?')
  })

  it('a second send NEVER moves the first date', () => {
    // How long somebody has been waiting is measured from the first ask.
    const again = { ...sent, ...askedPatch(sent, ['address_history:a1'], new Date('2026-10-28')) }
    expect(marksOn(again)['address_history:a1']?.askedAt)
      .toBe(new Date('2026-10-14').toISOString())
  })

  it('asking changes nothing about whether it is open', () => {
    // The portal can only see the fact find. A client who replied by email has
    // not answered anything until somebody types it in.
    expect(keys(sent)).toContain('address_history:a1')
  })

  it('and it says how long they have been waiting', () => {
    expect(askedLine(sent, 'address_history:a1', TODAY)).toBe('Asked 14 Oct · 13 days')
  })

  it('a question never sent has no line at all', () => {
    expect(askedLine(DEAL, 'address_history:a1', TODAY)).toBe('')
  })
})

describe('the sentence at the top is not the same twice', () => {
  const going = gapsFound(DEAL, TODAY)

  it('the first time it is a request', () => {
    expect(blockHeading(DEAL, going, TODAY)).toBe('A few things I still need from you')
    expect(blockLead(DEAL, going, TODAY)).toContain('answer straight back')
  })

  it('the second time it names the date and what it is holding up', () => {
    // A second ask that does not say it is a second ask is the same email sent
    // twice, which is how a client learns to ignore them.
    const sent = { ...DEAL, ...askedPatch(DEAL, going.map(q => q.key), new Date('2026-10-14')) }
    const still = openQuestions(sent, TODAY)
    expect(blockHeading(sent, still, TODAY)).toBe(`Still waiting on ${still.length} things`)
    expect(blockLead(sent, still, TODAY)).toBe('I asked about these on 14 Oct — I cannot submit without them.')
  })

  it('one outstanding thing is said in the singular', () => {
    const one = [going[0]]
    const sent = { ...DEAL, ...askedPatch(DEAL, [going[0].key], new Date('2026-10-14')) }
    expect(blockHeading(sent, one, TODAY)).toBe('Still waiting on one thing')
    expect(blockLead(sent, one, TODAY)).toContain('about this on 14 Oct')
  })

  it('a gap that opened AFTER the first email is a first ask, not a chase', () => {
    // A second applicant added later was never asked anything. Chasing them
    // for it would be wrong.
    const sent = { ...DEAL, ...askedPatch(DEAL, [going[0].key], new Date('2026-10-14')) }
    expect(blockHeading(sent, going, TODAY)).toBe('A few things I still need from you')
  })

  it('and nothing outstanding means no block at all', () => {
    // No heading, no "nothing outstanding". The email reads as it does today.
    expect(blockHeading(DEAL, [], TODAY)).toBe('')
  })
})

describe('the broker dropping one from an email', () => {
  const going = gapsFound(DEAL, TODAY)

  it('takes it off THIS email', () => {
    expect(goingOut(DEAL, [going[0].key], TODAY).map(q => q.key)).not.toContain(going[0].key)
    expect(goingOut(DEAL, [going[0].key], TODAY)).toHaveLength(going.length - 1)
  })

  it('and does not say the answer is known', () => {
    // If it were known it would be on the fact find, and then the question
    // would have gone on its own.
    expect(keys(DEAL)).toContain(going[0].key)
  })
})

describe('a question somebody typed', () => {
  const hand = newHandQuestion('Is the Brunswick place still tenanted?', '', 'Melissa Sedin',
    new Date('2026-10-24'))
  const withHand: any = { ...DEAL, questions_added: [hand] }

  it('is on the deal, not in a list in Settings', () => {
    // A question bank nobody prunes is noise on every deal inside a month.
    expect(askedByHand(withHand)).toHaveLength(1)
    expect(askedByHand(withHand)[0].ask).toBe('Is the Brunswick place still tenanted?')
    expect(askedByHand(withHand)[0].why).toBe('Added by Melissa Sedin.')
  })

  it('CANNOT close itself, because the portal has no idea what would answer it', () => {
    expect(askedByHand(withHand)[0].closesItself).toBe(false)
    expect(keys(withHand)).toContain(hand.key)
  })

  it('so a person ticks it off, and it says who', () => {
    const closed = { ...withHand, ...closeByHandPatch(withHand, hand.key, 'Melissa Sedin', TODAY) }
    expect(keys(closed)).not.toContain(hand.key)
    expect(marksOn(closed)[hand.key].closedBy).toBe('Melissa Sedin')
  })

  it('and can be opened again where somebody ticked the wrong one', () => {
    const closed = { ...withHand, ...closeByHandPatch(withHand, hand.key, 'Melissa Sedin', TODAY) }
    expect(keys({ ...closed, ...reopenPatch(closed, hand.key) })).toContain(hand.key)
  })

  it('one with no words is not a question', () => {
    expect(askedByHand({ questions_added: [{ key: 'x', ask: '  ' }] })).toHaveLength(0)
  })

  it('every one gets its own key, so two never share a tick', () => {
    const a = newHandQuestion('One?', '', 'Mel')
    const b = newHandQuestion('Two?', '', 'Mel')
    expect(a.key).not.toBe(b.key)
  })
})

describe('what the broker sees came back', () => {
  const going = gapsFound(DEAL, TODAY)
  const sent = { ...DEAL, ...askedPatch(DEAL, going.map(q => q.key), new Date('2026-10-14')) }
  const answered = JSON.parse(JSON.stringify(sent))
  answered.fact_find_data.applicants[0].addresses.push({
    isCurrent: false, address: '8 Marlowe Rd', startDate: '2021-11-01', endDate: '2024-09-09',
  })

  it('a closed question is never hidden', () => {
    // It is the only way anybody will trust the list.
    expect(closedQuestions(answered, TODAY).map(c => c.key)).toContain('address_history:a1')
  })

  it('and still reads as a sentence, even though the gap is gone', () => {
    const c = closedQuestions(answered, TODAY).find(x => x.key === 'address_history:a1')!
    expect(c.ask).toBe('Priya — where did you live before September 2024?')
  })

  it('WITHOUT INVENTING A DATE IT CLOSED', () => {
    // Nothing watches the fact find. A gap closes the moment somebody types the
    // address in and the portal only finds out next time a screen is drawn, so
    // there is no moment to record. Printing the date it was ASKED here would
    // read as the date it was answered - a lie told by a fallback.
    const c = closedQuestions(answered, TODAY).find(x => x.key === 'address_history:a1')!
    expect(c.closedAt).toBe('')
    expect(c.askedAt).toBe(new Date('2026-10-14').toISOString())
    expect(closedLine(c)).toBe('Answered')
  })

  it('but it says the date and the person where it HAS one', () => {
    const hand = newHandQuestion('Still tenanted?', '', 'Melissa Sedin', new Date('2026-10-24'))
    const w: any = { ...DEAL, questions_added: [hand] }
    const asked = { ...w, ...askedPatch(w, [hand.key], new Date('2026-10-24')) }
    const closed = { ...asked, ...closeByHandPatch(asked, hand.key, 'Melissa Sedin', TODAY) }
    expect(closedLine(closedQuestions(closed, TODAY)[0])).toBe('Answered 27 Oct by Melissa Sedin')
  })

  it('a question that was never sent is not listed as closed', () => {
    expect(closedQuestions(DEAL, TODAY)).toHaveLength(0)
  })
})

describe('nothing here is stored that can be worked out', () => {
  it('a deal with no saved state still produces the whole list', () => {
    expect(gapsFound(DEAL, TODAY).length).toBeGreaterThan(4)
    expect(DEAL.questions_state).toBeUndefined()
  })

  it('and a mark left behind by a question that no longer exists is ignored', () => {
    // Deleting an applicant must never break this screen.
    const stale: any = { ...DEAL, questions_state: { 'address_history:gone': { askedAt: '2026-01-01T00:00:00.000Z' } } }
    expect(() => openQuestions(stale, TODAY)).not.toThrow()
    expect(keys(stale)).not.toContain('address_history:gone')
  })

  it('a deal with no fact find at all asks for nothing rather than exploding', () => {
    expect(gapsFound({}, TODAY)).toEqual([])
    expect(gapsFound(null, TODAY)).toEqual([])
  })
})
