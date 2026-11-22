import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { propertyAddressOf } from './milestone-send'
import { valuationLine } from './offer-accepted-email'

// THE EMAIL CONGRATULATES THE RIGHT HOUSE.
//
// 22 Nov 2026. Camille Jardeleza's offer accepted email opened:
//
//   "Congratulations — 29 Clifton St, Bourkelands NSW 2650 is yours."
//
// She was not buying 29 Clifton St. She lives there. Camille, reading it:
// "Address is wrong...no idea where that is coming from."
//
// It came from securityOf(), which takes the first property on the FACT FIND
// that looks like a security and falls back to the first one with an address.
// On a purchase by somebody who already owns property - most purchases, and
// every SMSF one - that is their own house, sitting at the top of their own
// fact find.
//
// deals.purchase_address has held the right answer since 30 Oct. It is written
// at the offer accepted step, which is the step immediately before this email,
// and nothing here read it.

const ff = {
  properties: [
    { address: '29 Clifton St, Bourkelands NSW 2650', futureUse: 'Keep' },
    { address: '7 Macarthur Pl, Wagga NSW 2650', futureUse: 'Keep' },
  ],
}

describe('a purchase', () => {
  it('congratulates them on the house being bought', () => {
    expect(propertyAddressOf({
      purchase_address: '12 Jerilderie Rd, Bourkelands NSW 2650',
      fact_find_data: ff,
    })).toBe('12 Jerilderie Rd, Bourkelands NSW 2650')
  })

  it('never on the one they already live in', () => {
    const where = propertyAddressOf({
      purchase_address: '12 Jerilderie Rd, Bourkelands NSW 2650',
      fact_find_data: ff,
    })
    expect(where).not.toContain('Clifton')
  })
})

describe('everything else is unchanged', () => {
  it('a deal with no purchase address still reads the fact find', () => {
    expect(propertyAddressOf({ fact_find_data: ff }))
      .toBe('29 Clifton St, Bourkelands NSW 2650')
  })

  it('and an empty one is not an address', () => {
    expect(propertyAddressOf({ purchase_address: '   ', fact_find_data: ff }))
      .toBe('29 Clifton St, Bourkelands NSW 2650')
  })

  it('a deal with nothing recorded says nothing rather than guessing', () => {
    expect(propertyAddressOf({})).toBe('')
  })
})

// THE OTHER THREE THINGS CAMILLE REPORTED WERE ONE THING.
//
// "Ive got full val but its saying come back at purchase price. Ive got 4 days
// its still picking 2 days. And the anything else is not populating."
//
// Desktop, 2 days and an empty box are the screen's OPENING state. The email
// she was reading had been built before she touched anything. The wording
// itself was never wrong - this is the proof of that, so nobody goes looking
// in the builder next time.
describe('the valuation wording was right all along', () => {
  const ctx = (valuation: any) => ({
    valuation, lenderName: 'Firstmac', sentWith: 'the Contract',
  } as any)

  it('a full valuation promises an inspection, and does not mention price', () => {
    const line = valuationLine(ctx('full'))
    expect(line).toContain('inspection date')
    expect(line, 'that is the desktop sentence').not.toContain('come back at purchase price')
  })

  it('a desktop valuation is the one that came back at price', () => {
    expect(valuationLine(ctx('desktop'))).toContain('come back at purchase price')
  })

  it('and not ordered yet still says something', () => {
    expect(valuationLine(ctx('none'))).toContain('arranging the valuation now')
  })
})

const SCREEN = readFileSync('components/MilestoneEmails.tsx', 'utf8')

describe('a preview that failed to rebuild is not the email', () => {
  it('says so, above the email, in words', () => {
    expect(SCREEN).toContain('This is not your email.')
    expect(SCREEN).toContain('setStale(true)')
    expect(SCREEN).toContain('setStale(false)')
  })

  it('and Send is off until it redraws', () => {
    // The way to send the wrong email was one failed refresh and not noticing.
    expect(SCREEN).toContain('disabled={busy || sent || stale ||')
  })
})

// AND WHY THE OTHER THREE THINGS NEVER PICKED UP.
//
// Camille changed the valuation to Full, the days to 4, and typed into
// Anything else. The email kept showing desktop, 2, and nothing.
//
// docKeys was memoised on `outstanding`, which is memoised on the `deal`
// OBJECT. The deal page hands this component a fresh deal object on every one
// of its own renders, so docKeys was a new array every render, so `load` was a
// new function every render, so the 250ms debounce below restarted every
// render. While anybody is typing, renders come faster than 250ms - so the
// timer never finished and the fetch never ran.
//
// The first preview landed at mount. Nothing after it ever did, and nothing
// said so.
describe('the preview rebuilds when an answer changes', () => {
  it('the ticks no longer drag the deal object into the dependency', () => {
    expect(SCREEN).toContain('() => Object.keys(chasing).filter(k => chasing[k])')
    expect(SCREEN, 'this is what carried the deal in')
      .not.toContain('outstanding.filter((d: DocRow) => chasing[d.key])')
  })

  it('and the debounce is keyed on the answers, not on a function identity', () => {
    expect(SCREEN).toContain('const answers = JSON.stringify([')
    expect(SCREEN).toContain('}, [answers])')
    expect(SCREEN, 'a re-render must not postpone the rebuild')
      .not.toContain('}, [load])')
  })

  it('the route still drops ticks for documents no longer outstanding', () => {
    // The filter this removed was only doing that, and the route already does
    // it - so nothing is lost by taking it off the screen.
    const route = readFileSync('app/api/send-milestone-email/route.ts', 'utf8')
    expect(route).toContain('.filter((d: any) => want.has(d.key))')
  })
})

// ---------------------------------------------------------------------------
// THE TWO ANSWERS THAT DID NOT EXIST
// ---------------------------------------------------------------------------
//
// 22 Nov 2026. Camille had a full valuation already back at price and had to
// choose between a desktop that came back at price and a full one still
// awaiting inspection. Neither was true, and the email told her client the
// opposite of what had happened.
//
// Then Fabio: "a situation where a valuation, either desktop or full val, I
// don't want to describe, came back short, which is rare, but it could happen
// ... Valuation came in short at, and then a box that will put the amount,
// which means we would have to rework your deposit as per below. And then my
// credit team will know what to do."
//
// So five answers now, and the two new ones are tested on the sentence a
// client actually reads - not on the type.
describe('a full valuation that is already back', () => {
  const line = valuationLine({
    valuation: 'full_at_price', lenderName: 'Firstmac', sentWith: 'the Contract',
  } as any)

  it('says it was a full one, out loud', () => {
    expect(line).toContain('full valuation')
  })

  it('and says it came back at price', () => {
    expect(line).toContain('come back at purchase price')
  })

  it('and does not promise an inspection that has already happened', () => {
    expect(line).not.toContain('inspection date')
  })

  it('it still carries the contract on to the lender', () => {
    expect(line).toContain('move them to full assess')
  })
})

describe('a valuation that came in short', () => {
  const short = (valuationAmount?: string) => valuationLine({
    valuation: 'short', lenderName: 'Firstmac', sentWith: 'the Contract',
    valuationAmount,
  } as any)

  it('says it plainly, with the figure', () => {
    expect(short('850000')).toContain('come in short at $850,000')
  })

  it('and sends them straight to the reworked deposit below', () => {
    expect(short('850000')).toContain('rework your deposit as set out below')
  })

  // HIS WORDS: "either desktop or full val, I don't want to describe". Once it
  // is short, which kind of valuation it was stops being the news.
  it('never says which kind of valuation it was', () => {
    expect(short('850000')).not.toContain('desktop')
    expect(short('850000')).not.toContain('full valuation')
  })

  it('reads a typed figure however it was typed', () => {
    expect(short('$850,000')).toContain('$850,000')
    expect(short(' 850000 ')).toContain('$850,000')
  })

  // NO FIGURE, NO INVENTED ONE - and no half sentence either.
  it('still says it came in short when nobody typed an amount', () => {
    expect(short('')).toContain('come in short, which means')
    expect(short()).toContain('come in short, which means')
  })

  it('and never leaves a gap where a number should be', () => {
    expect(short('not a number')).not.toContain('short at ,')
    expect(short('not a number')).toContain('come in short, which means')
  })
})

const ROUTE = readFileSync('app/api/send-milestone-email/route.ts', 'utf8')

describe('both new answers survive the trip from the browser', () => {
  it('the route knows all five', () => {
    for (const v of ['desktop', 'full_at_price', 'full', 'short', 'none']) {
      expect(ROUTE, `${v} is not in VALUATIONS`).toContain(`'${v}'`)
    }
  })

  it('the screen offers all five', () => {
    expect(SCREEN).toContain("'full_at_price'")
    expect(SCREEN).toContain("'short'")
    expect(SCREEN).toContain('Came in short')
  })

  // THE ONE NUMBER IN THIS EMAIL A PERSON TYPES. Same rule as businessDays and
  // fixedTerm: digits out the far side, so a browser cannot put words into a
  // sentence a client reads. See lib/emails-survive-the-lock.test.ts.
  it('the figure is stripped to digits before it goes anywhere', () => {
    expect(ROUTE).toContain("valuationAmount: txt(get('valuationAmount'))")
    expect(ROUTE).toContain("replace(/[^0-9.]/g, '')")
  })

  it('the screen sends it, on the preview and on the send', () => {
    expect(SCREEN).toContain("body.set('valuationAmount', valuationAmount)")
    expect(SCREEN, 'the preview query string').toContain('valuationAmount,')
  })

  // A REBUILD IS WHAT MAKES A TYPED FIGURE REACH THE EMAIL. This is the same
  // fault Camille hit on the days box, so the figure is in the debounce key.
  it('and typing in it redraws the email', () => {
    const key = SCREEN.slice(SCREEN.indexOf('const answers = JSON.stringify(['))
    expect(key.slice(0, 400)).toContain('valuationAmount')
  })

  it('the box is only asked for where it applies', () => {
    expect(SCREEN).toContain("{valuation === 'short' && (")
  })
})
