import { describe, it, expect } from 'vitest'
import { guessMapping, groupByClient, FIELDS, whatIsMissing } from './book-import'

// HOW TO REACH THE 656. 20 Oct 2026.
//
// The first CRM export had 29 columns and not one of them was an email address
// or a phone number, so every review landed with nothing to send to and the
// send button was off for all of them with no way to turn it on.
//
// The second export splits the applicants out. These are the headers off it,
// exactly as the screenshot shows them.
const HEADERS = [
  'Deal Name', 'Deal Owner', 'Deal Ref',
  'C1 First Name', 'C1 Family Name', 'C1 Email', 'C1 Phone',
  'C2 First Name', 'C2 Family Name', 'C2 Email', 'C2 Phone',
  'Contact - group data - full name', 'Deal labels', 'Date deal created',
  'Settlement Date', 'Lender', 'Total Loan amount', 'LVR',
  'Security 1 address', 'Security 1 postcode', 'Security 1 state',
  'Security 1 zoning', 'Security 1 value', 'Security Property 1 type',
  'Security 1 Ownership Type', 'Commission\nLoan ID(s)', 'Current\nBalance',
]

const row = (o: any) => ({
  'Deal Owner': 'Fabio De Castro', 'Deal Ref': 'tc2-d9t9vu1z',
  'C1 First Name': 'Jodi', 'C1 Family Name': 'Greene',
  'C1 Email': 'jodigreene4703@example.com', 'C1 Phone': '+61419391315',
  'C2 First Name': 'Darren', 'C2 Family Name': 'Greene',
  'C2 Email': 'dgreene4703@example.com', 'C2 Phone': '+61417569193',
  'Contact - group data - full name': 'Jodi Greene, Darren Greene',
  'Security 1 address': '12 Example St, Rowville VIC 3178',
  'Security 1 value': '820000', 'Current\nBalance': '310000',
  'Security 1 Ownership Type': 'Investment',
  ...o,
})

describe('the second export', () => {
  const m = guessMapping(HEADERS)

  it('finds both applicants without anybody picking columns by hand', () => {
    expect(m.email).toBe('C1 Email')
    expect(m.phone).toBe('C1 Phone')
    expect(m.email2).toBe('C2 Email')
    expect(m.phone2).toBe('C2 Phone')
  })

  // THE ONE THAT DECIDES WHETHER A RE-IMPORT UPDATES OR DUPLICATES.
  //
  // Identity is the CRM's own group name. While that column is in the file,
  // dropping the second export in UPDATES the 656 already there and fills in
  // the emails. If this ever stops matching, a re-import adds 656 more.
  it('still identifies people by the name column the first import used', () => {
    expect(m.contact).toBe('Contact - group data - full name')
  })

  it('does not take the first applicant and the second from the same column', () => {
    expect(m.email).not.toBe(m.email2)
    expect(m.phone).not.toBe(m.phone2)
  })

  // A book with no emails is still worth having - the equity and the triage
  // work without one. Only the SEND cannot happen, and the review screen takes
  // an address typed in by hand for that.
  it('imports fine from the old export, which had none of them', () => {
    const old = HEADERS.filter(h => !/^C[12] /.test(h))
    const m2 = guessMapping(old)
    expect(m2.email).toBeUndefined()
    expect(whatIsMissing(m2)).toEqual([])
  })
})

describe('what comes off the rows', () => {
  const m = guessMapping(HEADERS)

  it('carries both applicants through to the client', () => {
    const [c] = groupByClient([row({})], m)
    expect(c.email).toBe('jodigreene4703@example.com')
    expect(c.phone).toBe('+61419391315')
    expect(c.email2).toBe('dgreene4703@example.com')
    expect(c.phone2).toBe('+61417569193')
  })

  // One client has eight rows. A blank on the second must not wipe what the
  // first one carried - the same rule the broker name follows, and for the
  // same reason: nobody gets a different email because the rows came back in
  // a different order.
  it('keeps the first real value across every row of the same person', () => {
    const [c] = groupByClient([
      row({}),
      row({ 'C1 Email': '', 'C1 Phone': '', 'Security 1 address': '9 Other Rd, Rowville VIC 3178' }),
    ], m)
    expect(c.email).toBe('jodigreene4703@example.com')
    expect(c.phone).toBe('+61419391315')
    expect(c.properties.length).toBe(2)
  })

  it('fills in from a later row when the first one was blank', () => {
    const [c] = groupByClient([
      row({ 'C1 Email': '' }),
      row({ 'Security 1 address': '9 Other Rd, Rowville VIC 3178' }),
    ], m)
    expect(c.email).toBe('jodigreene4703@example.com')
  })

  it('is empty rather than undefined when the export carried nothing', () => {
    const old = guessMapping(HEADERS.filter(h => !/^C[12] /.test(h)))
    const [c] = groupByClient([row({})], old)
    expect(c.email).toBe('')
    expect(c.phone).toBe('')
  })
})

describe('the fields on the mapping screen', () => {
  it('say what each one is for, and none of the four is required', () => {
    for (const key of ['email', 'phone', 'email2', 'phone2']) {
      const f = FIELDS.find(x => x.key === key)!
      expect(f, `${key} is not on the mapping screen`).toBeTruthy()
      expect(f.required, `${key} would block an import that has no column for it`).toBeFalsy()
      expect(f.why.length).toBeGreaterThan(10)
    }
  })
})
