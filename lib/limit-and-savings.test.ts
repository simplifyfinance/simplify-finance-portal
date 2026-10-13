import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  ASSET_TYPES, LIABILITY_STATUSES, LIMIT_REDUCED, keptValue, optionsFor,
} from './fact-find-options'
import { liabilityLine, assetLine } from './box-power'

// A CREDIT CARD LIMIT COMING DOWN, AND SAVINGS BY ITS RIGHT NAME.
//
// 13 Oct 2026, both asked for by Fabio:
//   "next to credit card can you show options as I want to add reduce limit
//    prior to settlement"
//   "Change 'bank account' to 'savings' on the other assets page in the Fact
//    Find - and then have this come through on the BC email"
//   "to be consolidated and refinanced is the same remove refinanced"
//
// The thread running through all three is that NOTHING ON A LIVE DEAL CHANGES.
// Every fact find already on file keeps the words it was saved with.

const deal = (liabilities: any[] = [], assets: any[] = []) =>
  ({ fact_find_data: { liabilities, assets } })

describe('what happens to a liability', () => {
  it('offers the four that are left', () => {
    expect([...LIABILITY_STATUSES]).toEqual([
      'Remain open', 'To be closed', 'To be consolidated', 'Limit to be reduced',
    ])
  })

  it('and no longer offers refinanced, because it meant consolidated', () => {
    expect([...LIABILITY_STATUSES]).not.toContain('To be refinanced')
  })

  // THE FAILURE THAT LOSES DATA QUIETLY. A deal holding a value that is no
  // longer on its list must still show it, or the next save snaps the record
  // to whatever happens to be first in the dropdown and nobody ever knows.
  it('but a deal already holding it keeps it, and is still offered it', () => {
    expect(keptValue('To be refinanced', LIABILITY_STATUSES)).toBe('To be refinanced')
    expect(optionsFor('To be refinanced', LIABILITY_STATUSES)).toContain('To be refinanced')
    expect(optionsFor('Remain open', LIABILITY_STATUSES)).not.toContain('To be refinanced')
  })

  // AND EVERY PLACE THAT ACTS ON IT STILL DOES. Those deals are live and the
  // refinance has not stopped happening just because the word left a dropdown.
  it('and everything that reads it still reads it', () => {
    for (const f of ['lib/funds-to-complete.ts', 'lib/box-security.ts', 'lib/position-after-settlement.ts']) {
      expect(readFileSync(f, 'utf8'), `${f} stopped recognising an old deal`)
        .toContain('To be refinanced')
    }
  })
})

describe('a limit coming down before settlement', () => {
  const card = (over: any = {}) => ({
    liabilityType: 'Credit card', lenderName: 'Westpac',
    limitAmount: '30,000', balance: '4,120', status: LIMIT_REDUCED, ...over,
  })

  it('says what it was and what it will be', () => {
    expect(liabilityLine(deal([card({ newLimitAmount: '10,000' })])))
      .toContain('with its limit reduced from $30,000 to $10,000 before settlement')
  })

  // A CARD THAT STAYS OPEN IS NOT BEING CLEARED. An assessor reading "being
  // cleared as part of this loan" about a card that remains would be reading
  // something untrue, so the reduction rides on the remaining sentence.
  it('and leaves the card in the sentence about what remains', () => {
    const line = liabilityLine(deal([card({ newLimitAmount: '10,000' })]))
    expect(line).toContain('which will remain')
    expect(line).not.toContain('being cleared')
  })

  it('still says something useful when the new limit has not been typed yet', () => {
    expect(liabilityLine(deal([card({ newLimitAmount: '' })])))
      .toContain('with its limit to be reduced before settlement')
  })

  it('and says nothing at all about limits on a card that is just staying', () => {
    const line = liabilityLine(deal([card({ status: 'Remain open', newLimitAmount: '10,000' })]))
    expect(line).not.toContain('limit')
  })

  it('nor claims a reduction when the new figure is not lower', () => {
    expect(liabilityLine(deal([card({ newLimitAmount: '40,000' })])))
      .toContain('with its limit to be reduced before settlement')
  })

  // THE NUMBER THE BANK IS SENT. Fabio, 13 Oct 2026, asked directly:
  // "handover goes 10,000 condition to be reduced".
  //
  // A card is assessed on its limit, and the limit worth assessing is the one
  // it is coming down to - that is the whole reason a broker asks for it. The
  // condition that makes that promise true is built in the same breath, in
  // lib/limit-to-send.ts, and neither can be had without the other.
  it('and the assessment sends the reduced limit, not today\u2019s', () => {
    const content = readFileSync('lib/assessment-content.ts', 'utf8')
    expect(content).toContain('limitToSend(cards[k])')
    expect(content, 'the raw limit is going to the bank again')
      .not.toContain('cards[k]?.limitAmount')
  })
})

describe('savings', () => {
  it('is what the list offers now', () => {
    expect([...ASSET_TYPES]).toContain('Savings')
    expect([...ASSET_TYPES]).not.toContain('Bank account')
  })

  it('and a deal already saying Bank account keeps saying it', () => {
    expect(keptValue('Bank account', ASSET_TYPES)).toBe('Bank account')
    expect(optionsFor('Bank account', ASSET_TYPES)).toContain('Bank account')
  })

  // THE HALF FABIO ASKED FOR: "have this come through on the BC email".
  it('reads as savings on the email whichever word the deal is carrying', () => {
    const now = assetLine(deal([], [{ assetType: 'Savings', value: '84,500' }]))
    const old = assetLine(deal([], [{ assetType: 'Bank account', value: '84,500' }]))
    expect(now).toContain('$84,500 in savings')
    expect(old).toContain('$84,500 in savings')
    expect(old).not.toContain('bank account')
  })
})

describe('the form itself', () => {
  const form = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')

  it('draws every liability status from the one list', () => {
    expect(form).toContain('optionsFor(liab.status, LIABILITY_STATUSES)')
    expect(form, 'a hard-coded status list is back').not.toContain('<option value="To be refinanced">')
  })

  it('asks for the new limit only when the limit is coming down', () => {
    expect(form).toContain('liab.status === LIMIT_REDUCED')
    expect(form).toContain('placeholder="New limit"')
  })

  it('and the bank picker still appears for a deal that says Bank account', () => {
    expect(form).toContain("asset.assetType === 'Savings' || asset.assetType === 'Bank account'")
  })
})
