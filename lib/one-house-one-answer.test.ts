import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { theHouseBeingBought } from './which-house'

// "IVE PUT IN THE CORRECT SEC ADDRESS BUT THE HANDOVER SEEMED TO COPY THE
//  CLIENT'S SELLING PROPERTY."
//
// Kylie, 25 Nov 2026, on Thomas and Sally Isherwood. She had typed 16 Bergonia
// Street, Mona Vale into "The property being bought" at the offer accepted
// step. The Actual Purchase Handover printed U4 26 Richmond Avenue, Dee Why -
// the unit they are selling.
//
// THE SAME FAULT HAD BEEN FIXED THE DAY BEFORE, in the milestone emails, where
// a client was congratulated on the home she already owned. That fix went into
// one file. Four functions answered "which house" with three different orders
// of preference, and fixing one taught the others nothing.
//
// Fabio: "we fixed something yesterday in offer accepted that is now a problem
// in settlements. So how can we avoid that? Is there anything we can do right
// now?"
//
// THIS FILE IS THE ANSWER AND IT IS NOT A PROMISE TO REMEMBER. It reads the
// source and fails the build. Same mechanism as
// lib/no-silent-thousand.test.ts, written after the Portfolio Review was found
// reading 11% of its own data.

const SRC = (f: string) => readFileSync(f, 'utf8')

describe('the order of preference, stated once', () => {
  const ISHERWOOD = {
    purchase_address: '16 Bergonia Street, Mona Vale NSW 2103',
    compliance_data: { securityAddress: '' },
    fact_find_data: {
      // The unit they are SELLING, sitting first on their own fact find -
      // which is where the wrong answer came from.
      properties: [{ address: 'U4 26 Richmond Avenue, Dee Why NSW 2099' }],
    },
  }

  it('the house typed at offer accepted beats everything', () => {
    expect(theHouseBeingBought(ISHERWOOD)).toBe('16 Bergonia Street, Mona Vale NSW 2103')
  })

  it('AND BEATS A COMPLIANCE ADDRESS, because it is newer and more specific', () => {
    const both = { ...ISHERWOOD, compliance_data: { securityAddress: 'Something older' } }
    expect(theHouseBeingBought(both)).toBe('16 Bergonia Street, Mona Vale NSW 2103')
  })

  it('falls back to compliance when nobody has typed the purchase', () => {
    const noPurchase = { ...ISHERWOOD, purchase_address: '',
                         compliance_data: { securityAddress: '9 Smith St, Ryde NSW' } }
    expect(theHouseBeingBought(noPurchase)).toBe('9 Smith St, Ryde NSW')
  })

  it('and only then the fact find, which is where the wrong answer lives', () => {
    const neither = { ...ISHERWOOD, purchase_address: '', compliance_data: {} }
    expect(theHouseBeingBought(neither)).toBe('U4 26 Richmond Avenue, Dee Why NSW 2099')
  })

  it('a TBA is a placeholder, not an address, in either field', () => {
    expect(theHouseBeingBought({ purchase_address: 'TBA - Mona Vale',
      compliance_data: { securityAddress: '9 Smith St, Ryde NSW' } })).toBe('9 Smith St, Ryde NSW')
    expect(theHouseBeingBought({ compliance_data: { securityAddress: 'TBA' },
      fact_find_data: { properties: [{ address: '1 Real St' }] } })).toBe('1 Real St')
  })

  it('and a deal with nothing recorded says nothing rather than guessing', () => {
    expect(theHouseBeingBought({})).toBe('')
    expect(theHouseBeingBought(null)).toBe('')
  })
})

describe('EVERY DOCUMENT ASKS THE SAME FUNCTION', () => {
  it('the purchase handover - the one Kylie reported', () => {
    expect(SRC('lib/purchase-handover.ts')).toContain('theHouseBeingBought')
  })

  it('the milestone emails - fixed 24 Nov, and it stays fixed', () => {
    expect(SRC('lib/milestone-send.ts')).toContain('theHouseBeingBought')
  })

  it('the board quick look, which had the fault on every purchase by an owner', () => {
    expect(SRC('lib/deal-peek.ts')).toContain('theHouseBeingBought')
  })
})

// ===========================================================================
// THE GUARD. A FIFTH ANSWER CANNOT APPEAR WITHOUT THIS FAILING.
// ===========================================================================
//
// An allowlist by name, not a count. A count teaches everyone that the number
// going up is normal; a name has to be added deliberately, by somebody who has
// read this and decided.
describe('nothing else answers the question on its own', () => {
  const MAY_READ_PURCHASE_ADDRESS = new Set([
    // The one answer. Everything else comes through it.
    'lib/which-house.ts',
    // Where it is TYPED. This is the write, not a read.
    'components/OfferAccepted.tsx',
    // Builds the list of SECURITIES, which is a different question - a deal can
    // be secured by the house being bought plus two others. It takes the
    // address as an argument rather than deciding anything with it.
    'lib/securities.ts',
  ])

  const sourceFiles = (dir: string): string[] => {
    const out: string[] = []
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`
      if (e.isDirectory()) out.push(...sourceFiles(p))
      else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p)
    }
    return out
  }

  it('only the allowed files decide anything from purchase_address', () => {
    const offenders: string[] = []
    for (const f of [...sourceFiles('lib'), ...sourceFiles('components'), ...sourceFiles('app')]) {
      if (MAY_READ_PURCHASE_ADDRESS.has(f)) continue
      const deciding = SRC(f)
        .split('\n')
        .filter(l => l.includes('purchase_address'))
        // Handing the fact to securitiesWithPurchase is passing it along, not
        // answering the question with it. Allowed everywhere.
        .filter(l => !l.includes('securitiesWithPurchase'))
        .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        // A plain column name in a select list is reading the row, not choosing.
        .filter(l => !/^\s*'purchase_address',?\s*$/.test(l))
        .filter(l => !/select\(/.test(l))
      if (deciding.length) offenders.push(`${f}: ${deciding[0].trim()}`)
    }
    expect(offenders,
      '\nA new place is deciding which house to print from purchase_address directly.\n' +
      'That is how the Isherwood handover printed the house they were selling.\n' +
      'Use theHouseBeingBought() in lib/which-house.ts, or add the file to\n' +
      'MAY_READ_PURCHASE_ADDRESS above with a line saying why.\n')
      .toEqual([])
  })
})
