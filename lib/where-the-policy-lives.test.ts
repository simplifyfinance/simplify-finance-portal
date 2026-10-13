import { describe, it, expect } from 'vitest'
import {
  WHERE_THE_POLICY_LIVES, REGISTER_CHECKED_ON, whereFor, sourceLine, whereToGetIt, alsoCoveredBy,
} from './where-the-policy-lives'

// THE REGISTER IS A NOTE ABOUT WEBSITES, NOT A STATEMENT OF POLICY.
//
// Everything here exists to stop one thing happening: a line in this file
// reading, anywhere, as though a bank had said it.

describe('the register itself', () => {
  it('covers every lender the sweep looked at', () => {
    expect(WHERE_THE_POLICY_LIVES.length).toBeGreaterThan(30)
  })

  it('names no two lenders twice', () => {
    const seen = WHERE_THE_POLICY_LIVES.map(s => s.lender.toLowerCase())
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('says what is there for every single row', () => {
    for (const s of WHERE_THE_POLICY_LIVES) {
      expect(s.what.length, `${s.lender} says nothing`).toBeGreaterThan(20)
    }
  })

  it('gives every public row an address', () => {
    for (const s of WHERE_THE_POLICY_LIVES) {
      if (s.access !== 'public') continue
      expect(s.url, `${s.lender} is public with nowhere to go`).toMatch(/^https:\/\//)
    }
  })

  it('and every portal row somewhere to log in', () => {
    for (const s of WHERE_THE_POLICY_LIVES) {
      if (s.access !== 'portal') continue
      expect((s.portal || '').length, `${s.lender} is behind a login nobody named`).toBeGreaterThan(2)
    }
  })

  it('never calls a guide a policy', () => {
    for (const s of WHERE_THE_POLICY_LIVES) {
      if (s.access !== 'public') continue
      expect(['policy', 'guide']).toContain(s.firmness)
    }
  })

  // THE WHOLE POINT. A register row says where to look. The moment one of them
  // says what a bank will lend, somebody will quote it as policy.
  it('and holds no lending figure anywhere in it', () => {
    const says = WHERE_THE_POLICY_LIVES.map(s => `${s.what} ${s.note || ''}`).join(' ')
    expect(says, 'a register row is quoting an LVR').not.toMatch(/\b\d{2}\s?%\s*(LVR|lvr)/)
    expect(says, 'a register row is quoting a DTI').not.toMatch(/\bDTI\s*(of|below|under)?\s*\d/i)
  })

  it('and carries the day a person checked it', () => {
    expect(REGISTER_CHECKED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('finding a bank by whatever we call it', () => {
  it('finds the obvious ones', () => {
    expect(whereFor('Macquarie')?.access).toBe('public')
    expect(whereFor('Firstmac')?.firmness).toBe('policy')
    expect(whereFor('Bankwest')?.access).toBe('portal')
  })

  it('finds a bank under the name our own list uses', () => {
    // Straight off Fabio's screen: CBA, Bluestone Home Loans, La Trobe Finance.
    expect(whereFor('CBA')?.lender).toBe('CBA')
    expect(whereFor('Commonwealth Bank')?.lender).toBe('CBA')
    expect(whereFor('Bluestone Home Loans')?.lender).toBe('Bluestone')
    expect(whereFor('La Trobe Finance')?.lender).toBe('La Trobe')
    expect(whereFor('St.George')?.lender).toBe('St George')
  })

  it('files Heritage and People’s Choice under the one entity they now are', () => {
    expect(whereFor('Heritage')?.lender).toBe('People First')
    expect(whereFor("People's Choice")?.lender).toBe('People First')
  })

  // A THREE LETTER NAME MATCHES THREE LETTERS. Loose matching on short names
  // is how AMP ends up answering for somebody else.
  it('does not let a short name match something longer', () => {
    expect(whereFor('AMP')?.lender).toBe('AMP')
    expect(whereFor('Amplify Home Loans')).toBeNull()
    expect(whereFor('ANZ')?.lender).toBe('ANZ')
  })

  it('keeps the banks whose names look alike apart', () => {
    expect(whereFor('Bank Australia')?.lender).toBe('Bank Australia')
    expect(whereFor('Bank of Sydney')?.lender).toBe('Bank of Sydney')
    expect(whereFor('BankSA')?.lender).toBe('BankSA')
    expect(whereFor('BankVic')?.lender).toBe('BankVic')
    expect(whereFor('Bank First')?.lender).toBe('Bank First')
  })

  // POLICE BANK IS NOT BANKVIC. The sweep turned up a real, correctly titled
  // broker underwriting PDF while searching for Police Bank, and it belonged
  // to BankVic. Both are in the register, separately, and Police Bank's row
  // warns about exactly this.
  it('holds Police Bank and BankVic apart, and says why', () => {
    expect(whereFor('Police Bank')?.lender).toBe('Police Bank')
    expect(whereFor('Police Bank')?.note).toMatch(/BankVic/)
    expect(whereFor('BankVic')?.lender).toBe('BankVic')
  })

  it('and says nothing at all about a bank nobody looked at', () => {
    expect(whereFor('Some Lender We Have Never Heard Of')).toBeNull()
    expect(whereFor('')).toBeNull()
    expect(whereFor(null)).toBeNull()
    expect(whereToGetIt('Some Lender We Have Never Heard Of')).toBe('')
  })
})

describe('the line on a tile', () => {
  it('says public policy, with its date', () => {
    expect(sourceLine(whereFor('Macquarie'))).toBe('Public credit policy — Version 14.1, last updated 10 September 2026')
  })

  it('says undated when the bank gives no date, rather than leaving it blank', () => {
    expect(sourceLine(whereFor('AMP'))).toBe('Public credit policy, undated')
  })

  it('never calls Bluestone’s page the policy', () => {
    expect(sourceLine(whereFor('Bluestone'))).toMatch(/^Public guide, not the policy/)
  })

  it('names the portal for a bank behind a login', () => {
    expect(sourceLine(whereFor('Bank of Queensland'))).toMatch(/Behind a login/)
  })

  it('and says nothing for a bank we have no row for', () => {
    expect(sourceLine(null)).toBe('')
  })
})

describe('what Paco says when he has nothing in writing', () => {
  it('points at the document that exists and nobody has filed', () => {
    const s = whereToGetIt('Macquarie')
    expect(s).toMatch(/publishes its credit policy publicly/)
    expect(s).toMatch(/macquarie\.com\.au/)
  })

  it('sends somebody to the portal when that is where it is', () => {
    expect(whereToGetIt('ANZ')).toMatch(/behind ANZ Broker Portal/)
  })

  it('says ask the BDM when there is genuinely nothing', () => {
    expect(whereToGetIt('Great Southern Bank')).toMatch(/Ask the BDM/)
  })

  // IT IS OUR NOTE AND IT IS DATED, EVERY TIME. Without the stamp this reads
  // like a fact about the bank rather than what somebody saw one Tuesday.
  it('and stamps every single one with the day a person checked', () => {
    for (const s of WHERE_THE_POLICY_LIVES) {
      expect(whereToGetIt(s.lender), `${s.lender} is unstamped`).toContain(REGISTER_CHECKED_ON)
    }
  })

  it('and never says what the bank will lend', () => {
    for (const s of WHERE_THE_POLICY_LIVES) {
      const line = whereToGetIt(s.lender)
      expect(line, `${s.lender} reads like policy`).not.toMatch(/\bwill (lend|accept|allow|take)\b/)
    }
  })
})


// ONE DOCUMENT, FOUR BANKS.
//
// 13 Oct 2026. Fabio: "remeber I dropped NAB and Westpac St Goerge nbank SA do
// the same thinhg". Westpac Group's credit policy is one document covering four
// brands. Dropping it once per brand means reading the same 25 sections four
// times and then holding four copies of the same rules to correct separately.
describe('a document that covers more than one bank', () => {
  it('knows Westpac Group covers the other three brands', () => {
    expect(alsoCoveredBy('Westpac')).toEqual(['St George', 'Bank of Melbourne', 'BankSA'])
  })

  it('and MyState covers Auswide, because the document says so on its face', () => {
    expect(alsoCoveredBy('MyState')).toEqual(['Auswide Bank'])
  })

  it('says nothing for a bank that stands on its own', () => {
    expect(alsoCoveredBy('Macquarie')).toEqual([])
    expect(alsoCoveredBy('NAB')).toEqual([])
    expect(alsoCoveredBy('Some Lender')).toEqual([])
  })

  // A NAME THAT MATCHES NOTHING WOULD FILE A POLICY UNDER NO BANK AT ALL, or
  // worse, be quietly dropped and leave somebody thinking it had been done.
  it('and every name it gives is a bank the register itself knows', () => {
    for (const s of WHERE_THE_POLICY_LIVES) {
      for (const other of s.alsoCovers || []) {
        expect(whereFor(other), `${s.lender} points at "${other}", which is not in the register`)
          .not.toBeNull()
      }
    }
  })

  it('and no bank claims to cover itself', () => {
    for (const s of WHERE_THE_POLICY_LIVES) {
      for (const other of s.alsoCovers || []) {
        expect(whereFor(other)?.lender, `${s.lender} lists itself`).not.toBe(s.lender)
      }
    }
  })
})
