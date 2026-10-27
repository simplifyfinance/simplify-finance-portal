// WHAT THE CLIENT TYPED, PUT ONTO THE FACT FIND.
//
// 27 Oct 2026. One rule, and this whole file is it:
//
//   A CLIENT CAN FILL IN SOMETHING EMPTY.
//   A CLIENT CAN NEVER CHANGE SOMETHING THAT HAS A VALUE.
//
// Invented names and figures throughout.
import { describe, it, expect } from 'vitest'
import { applyAnswer, applyAnswers, keysAnswered, clientId, type Answer } from './answers-from-the-client'
import { gapsFound } from './what-we-still-need'

const NOW = new Date('2026-10-27T09:00:00Z')
const TODAY = new Date('2026-10-27')

const FF: any = {
  dependants: '2',
  applicants: [
    { id: 'a1', firstName: 'Priya', residencyStatus: 'Citizen', relationshipStatus: 'Married',
      addresses: [{ id: 'x1', isCurrent: true, address: '14 Pelham St', residentialStatus: 'Owner',
                    startDate: '2024-09-09' }],
      employment: [{ id: 'y1', isCurrent: true, employmentPriority: 'Primary',
                     employerName: 'Harrow', startDate: '2025-03-01' }] },
    { id: 'a2', firstName: 'Daniel', residencyStatus: '', relationshipStatus: '',
      addresses: [], employment: [] },
  ],
  assets: [{ id: 'z1', assetType: 'Savings', description: 'ANZ', value: '18400' }],
}

const clone = () => JSON.parse(JSON.stringify(FF))

describe('an address for a period nobody recorded', () => {
  const answer: Answer = {
    key: 'address_history:a1', kind: 'address_history', applicantId: 'a1',
    addresses: [{ address: '8 Marlowe Rd, Brunswick VIC 3056', residentialStatus: 'Renting',
                  startDate: '2021-11-01', endDate: '2024-09-09' }],
  }
  const out = applyAnswer(clone(), answer, NOW)

  it('is ADDED, and the one already there is untouched', () => {
    // There is nothing to overwrite. It can only make the history longer.
    expect(out.applicants[0].addresses).toHaveLength(2)
    expect(out.applicants[0].addresses[0]).toEqual(FF.applicants[0].addresses[0])
    expect(out.applicants[0].addresses[1].address).toBe('8 Marlowe Rd, Brunswick VIC 3056')
  })

  it('is always a PREVIOUS address, never a second current one', () => {
    // The current one is already recorded - that is the whole reason the
    // question names a date to go back from. Two current addresses is a fact
    // find nobody can read.
    expect(out.applicants[0].addresses[1].isCurrent).toBe(false)
  })

  it('says it came from the client, on the row itself', () => {
    expect(out.applicants[0].addresses[1].addedByClient).toBe(NOW.toISOString())
  })

  it('and it closes the gap it was asked about', () => {
    expect(gapsFound({ fact_find_data: clone() }, TODAY).map(q => q.key))
      .toContain('address_history:a1')
    expect(gapsFound({ fact_find_data: out }, TODAY).map(q => q.key))
      .not.toContain('address_history:a1')
  })

  it('an empty row is not an address', () => {
    const empty = applyAnswer(clone(), { ...answer, addresses: [
      { address: '', residentialStatus: '', startDate: '', endDate: '' }] }, NOW)
    expect(empty.applicants[0].addresses).toHaveLength(1)
  })

  it('AND AN APPLICANT WHO NO LONGER EXISTS CHANGES NOTHING', () => {
    // Deleted between the email going out and the link being opened. They must
    // not come back as a new row at the end of the list.
    const gone = applyAnswer(clone(), { ...answer, applicantId: 'deleted' }, NOW)
    expect(gone).toEqual(FF)
  })
})

describe('a job before the one we have', () => {
  const answer: Answer = {
    key: 'employment_history:a1', kind: 'employment_history', applicantId: 'a1',
    jobs: [{ employerName: 'Calder Logistics', occupation: 'Coordinator',
             startDate: '2024-01-01', endDate: '2025-03-01' }],
  }
  const out = applyAnswer(clone(), answer, NOW)

  it('is added as a previous, primary job', () => {
    expect(out.applicants[0].employment).toHaveLength(2)
    expect(out.applicants[0].employment[1].employerName).toBe('Calder Logistics')
    expect(out.applicants[0].employment[1].isCurrent).toBe(false)
    expect(out.applicants[0].employment[1].employmentPriority).toBe('Primary')
  })

  it('and PAYG or self-employed is left blank rather than guessed', () => {
    // It changes which documents get asked for. A wrong guess sends a client
    // for the wrong paperwork, which is the chasing this was built to stop.
    expect(out.applicants[0].employment[1].employmentType).toBe('')
  })
})

describe('a box that is already filled in', () => {
  it('is NEVER overwritten, even where the client answers', () => {
    // If a broker has typed one since the email went out, theirs stands - they
    // have spoken to the client.
    const out = applyAnswer(clone(), {
      key: 'residency:a1', kind: 'residency', applicantId: 'a1', value: 'Temporary visa',
    }, NOW)
    expect(out.applicants[0].residencyStatus).toBe('Citizen')
  })

  it('and an empty one is filled', () => {
    const out = applyAnswer(clone(), {
      key: 'residency:a2', kind: 'residency', applicantId: 'a2', value: 'Permanent resident',
    }, NOW)
    expect(out.applicants[1].residencyStatus).toBe('Permanent resident')
  })

  it('the same for marital status', () => {
    const out = applyAnswer(clone(), {
      key: 'marital:a2', kind: 'marital', applicantId: 'a2', value: 'De facto',
    }, NOW)
    expect(out.applicants[1].relationshipStatus).toBe('De facto')
    expect(out.applicants[0].relationshipStatus).toBe('Married')
  })

  it('and an empty answer writes nothing at all', () => {
    expect(applyAnswer(clone(), {
      key: 'residency:a2', kind: 'residency', applicantId: 'a2', value: '  ',
    }, NOW)).toEqual(FF)
  })
})

describe('dependant ages', () => {
  it('are filled in where there are none', () => {
    const out = applyAnswer(clone(), { key: 'dependant_ages', kind: 'dependant_ages', ages: ['4', '7'] }, NOW)
    expect(out.dependantAges).toEqual(['4', '7'])
  })

  it('and never replace ones somebody already typed', () => {
    const had = { ...clone(), dependantAges: ['11', '13'] }
    expect(applyAnswer(had, { key: 'dependant_ages', kind: 'dependant_ages', ages: ['4'] }, NOW).dependantAges)
      .toEqual(['11', '13'])
  })

  it('an empty box in the middle is dropped, not saved as nothing', () => {
    const out = applyAnswer(clone(), { key: 'dependant_ages', kind: 'dependant_ages', ages: ['4', '', '9'] }, NOW)
    expect(out.dependantAges).toEqual(['4', '9'])
  })
})

describe('an asset', () => {
  it('is a new row and touches nothing already there', () => {
    const out = applyAnswer(clone(), {
      key: 'asset:vehicle', kind: 'vehicle',
      assets: [{ description: '', value: '32000', make: 'Toyota', model: 'HiLux', year: '2019' }],
    }, NOW)
    expect(out.assets).toHaveLength(2)
    expect(out.assets[0]).toEqual(FF.assets[0])
    expect(out.assets[1].assetType).toBe('Vehicle')
    expect(out.assets[1].make).toBe('Toyota')
  })

  it('and a car described properly closes the question', () => {
    const out = applyAnswer(clone(), {
      key: 'asset:vehicle', kind: 'vehicle',
      assets: [{ description: '', value: '32000', make: 'Toyota', model: 'HiLux', year: '2019' }],
    }, NOW)
    expect(gapsFound({ fact_find_data: out }, TODAY).map(q => q.key)).not.toContain('asset:vehicle')
  })

  it('only a vehicle carries a make, a model and a year', () => {
    const out = applyAnswer(clone(), {
      key: 'asset:super', kind: 'super', assets: [{ description: 'ART', value: '96200' }],
    }, NOW)
    expect(out.assets[1].make).toBeUndefined()
  })
})

describe('"WE HAVE NONE" IS AN ANSWER', () => {
  // Nobody has checked and they have none are different things, and both have
  // to be writable - the same rule as the commission split. Without it a client
  // who says "we do not own a car" is asked about the car again next email.
  const out = applyAnswer(clone(), { key: 'asset:vehicle', kind: 'vehicle', assets: [], none: true }, NOW)

  it('and it is NOT a nil row', () => {
    // A nil asset would show up in the position and in every total.
    expect(out.assets).toHaveLength(1)
    expect(out.nothingToDeclare.vehicle).toBe(NOW.toISOString())
  })

  it('it closes the question', () => {
    expect(gapsFound({ fact_find_data: out }, TODAY).map(q => q.key)).not.toContain('asset:vehicle')
  })

  it('and it does not close any of the others', () => {
    expect(gapsFound({ fact_find_data: out }, TODAY).map(q => q.key)).toContain('asset:shares')
  })

  it('saying it twice does not move the date it was first said', () => {
    const again = applyAnswer(out, { key: 'asset:vehicle', kind: 'vehicle', assets: [], none: true },
      new Date('2026-12-01'))
    expect(again.nothingToDeclare.vehicle).toBe(NOW.toISOString())
  })
})

describe('several answers at once', () => {
  const answers: Answer[] = [
    { key: 'address_history:a1', kind: 'address_history', applicantId: 'a1',
      addresses: [{ address: '8 Marlowe Rd', residentialStatus: 'Renting',
                    startDate: '2021-11-01', endDate: '2024-09-09' }] },
    { key: 'asset:vehicle', kind: 'vehicle', assets: [], none: true },
    { key: 'dependant_ages', kind: 'dependant_ages', ages: ['4', '7'] },
  ]

  it('all land', () => {
    const out = applyAnswers(clone(), answers, NOW)
    expect(out.applicants[0].addresses).toHaveLength(2)
    expect(out.nothingToDeclare.vehicle).toBeTruthy()
    expect(out.dependantAges).toEqual(['4', '7'])
  })

  it('ONE THAT CANNOT BE APPLIED LEAVES THE REST ALONE', () => {
    // A client typing something odd into one box must not cost them the other
    // three.
    const out = applyAnswers(clone(), [
      answers[0], { key: 'x', kind: 'nonsense' } as any, answers[2],
    ], NOW)
    expect(out.applicants[0].addresses).toHaveLength(2)
    expect(out.dependantAges).toEqual(['4', '7'])
  })

  it('and every row gets its own id', () => {
    const out = applyAnswers(clone(), answers, NOW)
    const ids = [...out.applicants[0].addresses.map((a: any) => a.id), ...out.assets.map((a: any) => a.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('an id from the client cannot collide with one the form made', () => {
    expect(clientId(0, NOW)).toContain('client-')
  })

  it('and the keys answered are the keys to close', () => {
    expect(keysAnswered(answers)).toEqual(['address_history:a1', 'asset:vehicle', 'dependant_ages'])
  })
})

describe('nothing explodes', () => {
  it('on a fact find that is not there', () => {
    expect(applyAnswers(null, [], NOW)).toEqual({})
    expect(applyAnswers(undefined, [{ key: 'k', kind: 'dependant_ages', ages: ['4'] }], NOW).dependantAges)
      .toEqual(['4'])
  })

  it('on an answer that is nonsense', () => {
    expect(applyAnswer(clone(), null as any, NOW)).toEqual(FF)
    expect(applyAnswer(clone(), {} as any, NOW)).toEqual(FF)
  })

  it('and no answers at all changes nothing', () => {
    expect(applyAnswers(clone(), [], NOW)).toEqual(FF)
  })
})
