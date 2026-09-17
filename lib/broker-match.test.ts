import { describe, it, expect } from 'vitest'
import { matchBroker, firstAndLast, withoutTitle } from './broker-match'

const BROKERS = [
  { broker_key: 'fabio', name: 'Fabio De Castro' },
  { broker_key: 'mark',  name: 'Mark Gallo' },
  { broker_key: 'kylie', name: 'Kylie Searle' },
]
const noEmails = new Map<string, string>()

const match = (name: any, email?: any, rows = BROKERS) =>
  matchBroker({ name, email }, rows, noEmails)

describe('the one that sent Fabio looking, 17 Sep 2026', () => {
  it('files "Mark Anthony Gallo" under Mark Gallo', () => {
    const m = match('Mark Anthony Gallo')
    expect(m.key).toBe('mark')
    expect(m.how).toBe('first-and-last')
    expect(m.matched).toBe('Mark Gallo')
  })

  it('still takes the plain name without a middle one', () => {
    expect(match('Mark Gallo').key).toBe('mark')
    expect(match('Mark Gallo').how).toBe('name')
  })

  it('takes two middle names, and any punctuation around them', () => {
    expect(match('Mark Anthony James Gallo').key).toBe('mark')
    expect(match('Mark A. Gallo').key).toBe('mark')
    expect(match('  MARK   anthony   GALLO ').key).toBe('mark')
  })

  it('still reads the title on the end as a title', () => {
    expect(match('Fabio De Castro - Head Agreement Holder').key).toBe('fabio')
    expect(match('Fabio Antonio De Castro — Head Agreement Holder').key).toBe('fabio')
  })

  it('handles a two word surname from both ends', () => {
    expect(match('Fabio De Castro').key).toBe('fabio')
    expect(match('Fabio Antonio De Castro').key).toBe('fabio')
  })
})

describe('what it must never do', () => {
  // A single word that IS a broker key is taken as that key - unchanged from
  // before, and the reason the keys are first names. It never fires on a real
  // statement, which is always addressed to a full name. Flagged to Fabio,
  // 17 Sep 2026: say the word and the key rule goes.
  it('takes a bare word only when it is exactly a broker key', () => {
    expect(match('Mark').key).toBe('mark')
    expect(match('Anthony').key).toBe('')
    expect(match('Gallo').key).toBe('')
  })

  // The ship gate caught this on 17 Sep 2026. sameBroker() compares first words,
  // so the key rule must never see a full name - or "Somebody Mark Whoever"
  // would land on the broker key "mark".
  it('never reaches the key rule with a full name in its hand', () => {
    const rows = [{ broker_key: 'mark', name: 'Mark Gallo' }]
    expect(match('Mark Henderson', undefined, rows).key).toBe('')
    expect(match('Mark Anthony Henderson', undefined, rows).key).toBe('')
    expect(match('mark gallo jones', undefined, rows).key).toBe('')
  })

  it('never files a stranger who shares a first name', () => {
    expect(match('Fabio Smith').key).toBe('')
    expect(match('Mark Henderson').key).toBe('')
  })

  it('never files a stranger who shares a surname', () => {
    expect(match('Julian Gallo').key).toBe('')
  })

  it('refuses rather than choosing between two people of the same name', () => {
    const two = [...BROKERS, { broker_key: 'mark2', name: 'Mark Peter Gallo' }]
    const m = match('Mark Anthony Gallo', undefined, two)
    expect(m.key).toBe('')
    expect(m.how).toBe('ambiguous')
    expect((m as any).candidates).toEqual(['Mark Gallo', 'Mark Peter Gallo'])
  })

  it('an exact whole name still wins over the loose rule', () => {
    const two = [...BROKERS, { broker_key: 'mark2', name: 'Mark Anthony Gallo' }]
    const m = match('Mark Anthony Gallo', undefined, two)
    expect(m.key).toBe('mark2')
    expect(m.how).toBe('name')
  })

  it('says nothing matched on an empty or unknown name', () => {
    for (const n of ['', '   ', null, undefined, 'Nobody At All'])
      expect(match(n).key).toBe('')
  })
})

describe('the email still comes first', () => {
  it('beats every name rule', () => {
    const emails = new Map([['mark@simplifyfinance.com.au', 'mark']])
    const m = matchBroker({ name: 'Someone Else Entirely', email: 'MARK@simplifyfinance.com.au' }, BROKERS, emails)
    expect(m.key).toBe('mark')
    expect(m.how).toBe('email')
  })

  it('an email nobody recognises falls through to the name', () => {
    const m = matchBroker({ name: 'Mark Anthony Gallo', email: 'nobody@example.com' }, BROKERS, noEmails)
    expect(m.key).toBe('mark')
  })
})

describe('the broker key typed where a name was expected', () => {
  it('is taken', () => {
    expect(match('kylie').key).toBe('kylie')
    expect(match('kylie').how).toBe('broker-key')
  })
})

describe('the pieces', () => {
  it('withoutTitle drops what follows a dash', () => {
    expect(withoutTitle('Fabio De Castro - Head Agreement Holder')).toBe('fabio de castro')
  })
  it('firstAndLast keeps both ends and nothing between', () => {
    expect(firstAndLast('Mark Anthony Gallo')).toBe('mark|gallo')
    expect(firstAndLast('Mark Gallo')).toBe('mark|gallo')
    expect(firstAndLast('Mark')).toBe('')
  })
  it("an apostrophe is not a different person", () => {
    const rows = [{ broker_key: 'ob', name: "Siobhan O'Brien" }]
    expect(match('Siobhan Mary O’Brien', undefined, rows).key).toBe('ob')
  })
})
