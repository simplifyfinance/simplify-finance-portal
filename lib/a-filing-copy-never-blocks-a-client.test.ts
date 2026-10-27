// A FILING COPY NEVER BLOCKS A CLIENT EMAIL.
//
// 27 Oct 2026. Fabio, on a final check-in that would not send: "It wont let me
// send this for some reason". Resend's answer was:
//
//   Invalid `bcc` field. The email address needs to follow the
//   `email@example.com` or `Name <email@example.com>` format.
//
// And the whole email died with it. The thing in the To field was a person
// waiting to hear from us; the thing that was malformed was our own filing
// copy. That is the wrong way round and it is the part of this with no defence.
//
// WHAT WAS ACTUALLY WRONG WITH THE ADDRESSES, from the book:
//
//   174 deals  the base32 address SalesTrekker generates. 74 characters before
//              the @, where RFC 5321 allows 64. Outlook takes it, which is why
//              the BC and the lending options have filed correctly all along -
//              those open Outlook. Resend checks, and refuses.
//   100 deals  "r01187p12" - a SalesTrekker reference number, no @ at all.
//
// THE FIX IS FABIO'S OWN: "copy the html and our outlook opnes with BCC
// inthere so we can paste and send". The client's copy still goes from the
// portal, because some of these carry the lender's letter as a PDF and a
// mailto cannot attach a file. Only the filing copy goes through Outlook.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  cleanBcc, bccProblem, bccIsSendable, bccForDeal, bccGap,
} from './files-itself-in-salestrekker'

// The real one off Sangeeta's deal, 27 Oct 2026.
const LONG = 'PMRHEZLGMVZGK3TDMVHHK3LCMVZCEORCORRTELLEMFXTO3LDOJVWYMTTOZ2GWYTLOVRDKZZCPU@sfg.email.v2.salestrekker.com'
// And what 100 older deals hold instead of an address.
const REFERENCE = 'r01187p12'
const FINE = 'tc2-dao7mcrkl2svtkbkub5g@sfg.email.v2.salestrekker.com'

describe('the two addresses sitting in the book', () => {
  it('the one SalesTrekker generates is too long to send', () => {
    expect(LONG.split('@')[0]).toHaveLength(74)
    expect(bccProblem(LONG)).toBe('too-long')
    expect(bccIsSendable(LONG)).toBe(false)
  })

  it('and a reference number is not an address at all', () => {
    expect(bccProblem(REFERENCE)).toBe('not-an-address')
  })

  it('while a short one is fine', () => {
    expect(bccProblem(FINE)).toBe('none')
    expect(bccIsSendable(FINE)).toBe(true)
  })

  it('64 is the line, and it is the standard not a guess', () => {
    const at64 = 'a'.repeat(64) + '@x.com'
    const at65 = 'a'.repeat(65) + '@x.com'
    expect(bccProblem(at64)).toBe('none')
    expect(bccProblem(at65)).toBe('too-long')
  })
})

describe('an address pasted out of SalesTrekker', () => {
  it('survives a newline on the end, which Postgres trim() does not remove', () => {
    // A code pasted into the box can arrive with one and look perfect in the
    // column. `x <> trim(x)` finds spaces, not newlines.
    expect(cleanBcc(`${FINE}\n`)).toBe(FINE)
    expect(cleanBcc(` ${FINE}\r\n`)).toBe(FINE)
    expect(bccIsSendable(`${FINE}\n`)).toBe(true)
  })

  it('and a non-breaking space pasted from a web page', () => {
    expect(cleanBcc(`${FINE} `)).toBe(FINE)
  })

  it('nothing at all is nothing, not a broken address', () => {
    expect(bccProblem('')).toBe('empty')
    expect(bccProblem(null)).toBe('empty')
  })

  it('and obvious rubbish is caught', () => {
    expect(bccProblem('two@@ats.com')).toBe('not-an-address')
    expect(bccProblem('@nothingbefore.com')).toBe('not-an-address')
    expect(bccProblem('nothing@after')).toBe('not-an-address')
    expect(bccProblem('nodomain@')).toBe('not-an-address')
  })
})

describe('THE ONE THAT MATTERS: the client always hears from us', () => {
  it('an address the provider will refuse is simply not sent', () => {
    // It used to go into the payload, and Resend threw the whole email out.
    expect(bccForDeal({ salestrekker_bcc: LONG })).toEqual([])
    expect(bccForDeal({ salestrekker_bcc: REFERENCE })).toEqual([])
  })

  it('a good one still files itself, exactly as before', () => {
    expect(bccForDeal({ salestrekker_bcc: FINE })).toEqual([FINE])
  })

  it('and a test deal files nowhere, which has not changed', () => {
    expect(bccForDeal({ salestrekker_bcc: FINE }, { redirected: true })).toEqual([])
  })
})

describe('and the screen says which fault it is', () => {
  it('too long - the client still gets it', () => {
    const g = bccGap({ salestrekker_bcc: LONG })
    expect(g).toContain('longer than email addresses are allowed to be')
    expect(g).toContain('The client still gets the email')
  })

  it('a reference number - and where to get the real address', () => {
    const g = bccGap({ salestrekker_bcc: REFERENCE })
    expect(g).toContain('r01187p12')
    expect(g).toContain('reference number')
    expect(g).toContain('SalesTrekker & links')
  })

  it('nothing recorded at all, as it always said', () => {
    expect(bccGap({})).toContain('No SalesTrekker BCC code is recorded')
  })

  it('and a working address says nothing, because there is nothing to say', () => {
    expect(bccGap({ salestrekker_bcc: FINE })).toBe('')
  })
})

describe('filing it by hand, which is what the BC has always done', () => {
  const screen = readFileSync('components/MilestoneEmails.tsx', 'utf8')
  const route = readFileSync('app/api/send-milestone-email/route.ts', 'utf8')

  it('the screen is told whether it has to offer the step', () => {
    expect(route).toContain('filesItself:')
    expect(route).toContain('filingAddress:')
  })

  it('and only on a deal whose address the provider refuses', () => {
    // Not on a test deal, not on one with no code, not on a working one.
    expect(route).toContain('where.redirected || bccIsSendable(deal?.salestrekker_bcc)')
  })

  it('the button appears only after the client has been sent to', () => {
    expect(screen).toContain('{sent && !!preview?.filingAddress && (')
  })

  it('it copies the email before handing over the mailto', () => {
    // A mailto: can cut short whatever is still in flight. The lending options
    // learned this the hard way - see the note in LOForm.
    const fn = screen.slice(screen.indexOf('async function fileItByHand'))
    const copy = fn.indexOf('copyHtmlAndPlain')
    const mail = fn.indexOf('window.location.href')
    expect(copy).toBeGreaterThan(-1)
    expect(copy, 'the mailto is opened before the email is copied').toBeLessThan(mail)
  })

  it('and addresses it To, not Bcc, because the client already has theirs', () => {
    const fn = screen.slice(screen.indexOf('async function fileItByHand'),
                            screen.indexOf('async function send('))
    expect(fn).toContain('mailto:${encodeURIComponent(to)}')
    expect(fn, 'there is nobody left to hide the address from').not.toContain('bcc=')
  })

  it('and Send cannot be pressed twice', () => {
    expect(screen).toContain('disabled={busy || sent ||')
  })
})
