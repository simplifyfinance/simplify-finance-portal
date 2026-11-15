// "ITS OUR JOB TO VERIFY IF THE RATE SECURITY NAME OF APPLICANT AND LOAN TERM
// IS CORRECT." — Fabio, 17 Nov 2026, on the settlements team's biggest task.
import { describe, it, expect } from 'vitest'
import {
  FIELDS, checkContract, differences, notStated, countWords, sameAddress, sameNames,
  askAbout, heldBack, holdWords, ANSWER_WORDS,
} from './the-contract-check'

const said = (o: any = {}) => ({
  rate: '6.14', repayment: 'Interest Only', ioTerm: '5 years', amount: '340600',
  loanTerm: '30 years', security: '14 Marrack St, Kingswood NSW 2747',
  borrowers: ['Daniel Okafor', 'Priya Raman'], ...o,
})
const deal = (o: any = {}) => ({
  rate: '6.14', repayment: 'Interest only', ioTerm: '5', amount: '340600',
  loanTerm: '30', security: '14 Marrack St, Kingswood NSW 2747, Australia',
  borrowers: ['Daniel Okafor', 'Priya Raman'], ...o,
})
const line = (ls: any[], f: string) => ls.find(l => l.field === f)!

describe('the six things the team checks', () => {
  it('are the ones Fabio named, in reading order', () => {
    expect(FIELDS).toEqual(['rate', 'repayment', 'ioTerm', 'amount', 'loanTerm', 'security', 'borrowers'])
  })

  it('a contract that agrees with the formal approval says so', () => {
    const ls = checkContract(said(), deal())
    expect(differences(ls)).toHaveLength(0)
    expect(countWords(ls)).toMatch(/^all \d+ match$/)
  })
})

// THE WHOLE REASON THE UNITS ARE NORMALISED FIRST.
describe('the same thing written two ways is not a difference', () => {
  it('360 months against 30 years', () => {
    expect(line(checkContract(said({ loanTerm: '360 months' }), deal()), 'loanTerm').state).toBe('matches')
  })

  it('P&I against principal and interest', () => {
    const ls = checkContract(said({ repayment: 'P&I' }), deal({ repayment: 'Principal and Interest' }))
    expect(line(ls, 'repayment').state).toBe('matches')
  })

  it('an address with the country on it', () => {
    expect(sameAddress('14 Marrack St, Kingswood NSW 2747',
      '14 Marrack St, Kingswood NSW 2747, Australia')).toBe(true)
  })

  // A CONTRACT CARRYING A MIDDLE NAME THE FACT FIND DOES NOT IS NOT TWO
  // DIFFERENT PEOPLE.
  it('and a middle name, or a different order', () => {
    expect(sameNames(['Daniel James Okafor', 'Priya Raman'], ['Daniel Okafor', 'Priya Raman'])).toBe(true)
    expect(sameNames('Priya Raman and Daniel Okafor', ['Daniel Okafor', 'Priya Raman'])).toBe(true)
  })

  it('but a different borrower is', () => {
    expect(sameNames(['Daniel Okafor'], ['Daniel Okafor', 'Priya Raman'])).toBe(false)
    expect(sameNames(['Daniel Okonkwo', 'Priya Raman'], ['Daniel Okafor', 'Priya Raman'])).toBe(false)
  })
})

describe('a real difference', () => {
  it('on the rate', () => {
    const l = line(checkContract(said({ rate: '6.14' }), deal({ rate: '6.08' })), 'rate')
    expect(l.state).toBe('differs')
    expect(l.says).toBe('6.14%')
    expect(l.expected).toBe('6.08%')
    expect(askAbout(l)).toBe('The contract says 6.14% and the deal says 6.08%. Which one is right?')
  })

  it('on the term, in the words a person would use', () => {
    const l = line(checkContract(said({ loanTerm: '300 months' }), deal()), 'loanTerm')
    expect(l.state).toBe('differs')
    expect(l.says).toBe('25 years')
    expect(l.expected).toBe('30 years')
  })

  it('and on whether it is interest only at all', () => {
    const l = line(checkContract(said({ repayment: 'P&I' }), deal()), 'repayment')
    expect(l.state).toBe('differs')
  })

  it('counted for the heading', () => {
    const ls = checkContract(said({ rate: '6.5', loanTerm: '25 years' }), deal())
    expect(countWords(ls)).toContain('2 of')
  })
})

// NOTHING IS INVENTED. "The contract does not state a term" and "the contract
// says 25 years where we say 30" are different problems.
describe('a field nobody stated', () => {
  it('is a gap, not a disagreement', () => {
    const ls = checkContract(said({ rate: '' }), deal())
    expect(line(ls, 'rate').state).toBe('not stated')
    expect(differences(ls)).toHaveLength(0)
    expect(notStated(ls)).toHaveLength(1)
  })

  it('and a field neither side states is left off the screen entirely', () => {
    const ls = checkContract(said({ security: '' }), deal({ security: '' }))
    expect(ls.find(l => l.field === 'security')).toBeUndefined()
  })

  // "INTEREST ONLY FOR NOTHING" IS NOT A DIFFERENCE ON A P&I LOAN.
  it('how long it is interest only for is only asked on an interest only loan', () => {
    const ls = checkContract(said({ repayment: 'P&I', ioTerm: '' }), deal({ repayment: 'P&I', ioTerm: '' }))
    expect(ls.find(l => l.field === 'ioTerm')).toBeUndefined()
  })
})

// 17 Nov 2026: "you'll confirm when we're sending the confirmation email that
// everything is correct." The only thing in the whole build that blocks.
describe('what holds the client email', () => {
  const ls = checkContract(said({ rate: '6.5', loanTerm: '25 years' }), deal())

  it('every unanswered difference', () => {
    expect(heldBack(ls, {})).toHaveLength(2)
    expect(holdWords(2)).toBe('2 left to settle before the client is told')
    expect(holdWords(1)).toBe('One left to settle before the client is told')
  })

  it('an answered one lets go', () => {
    expect(heldBack(ls, { rate: 'contract' })).toHaveLength(1)
    expect(heldBack(ls, { rate: 'contract', loanTerm: 'deal' })).toHaveLength(0)
    expect(holdWords(0)).toBe('')
  })

  // "NOT SURE YET" IS NOT AN ANSWER. It is a person saying they will come back.
  it('and not sure yet does not', () => {
    expect(heldBack(ls, { rate: 'unsure', loanTerm: 'deal' })).toHaveLength(1)
  })

  it('a field that only failed to be stated never holds anything', () => {
    const gap = checkContract(said({ rate: '' }), deal())
    expect(heldBack(gap, {})).toHaveLength(0)
  })

  it('and the three answers say which side is being believed', () => {
    expect(ANSWER_WORDS.contract).toContain('update the deal')
    expect(ANSWER_WORDS.deal).toContain('back to the lender')
  })
})
