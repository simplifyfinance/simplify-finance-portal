// THE BRAND, AND THE BOX.
//
// 22 Oct 2026, both asked for by Fabio on the same screen.
//
// THE BRAND. The lending options printed "- Simplify Finance" after every
// broker's name, typed into the page, so a Navigate broker read as Simplify.
// And it had no brand box at all - it copied brandId off the BC, so a deal
// whose BC nobody had worked arrived with an empty brand, which resolves to
// the DEFAULT in lib/brand.ts. Simplify's logo, trading name and CREDIT
// LICENCE on another brand's client email.
//
// THE BOX. The handover notes box was wired only to "Done - send to broker for
// review", which exists only when a credit officer is assigned. A broker doing
// their own deal pressed Send to client and the deal moved with nothing
// written down. Fabio: "Always have the box pop up whne they move stages."
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const lo = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

// A COMMENT EXPLAINING A RULE IS NOT A BREACH OF IT.
//
// 27 Oct 2026, and the third time in one day - see the same note in
// scripts/check-email-html.sh and scripts/check-broker-keys.sh. The comment in
// LOForm.tsx that explains why it stopped reading the frozen broker list
// quotes the old call, and the test looking for that call found the
// explanation. Checked against code only; the words above it are free.
const codeOnly = (src: string) =>
  src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

describe('the lending options knows its brand', () => {
  it('no longer types a trading name into the page', () => {
    expect(lo, 'the broker dropdown is hard-coding a brand again')
      .not.toContain('— Simplify Finance</option>')
  })

  // THESE THREE WERE REWRITTEN ON 27 Oct 2026, AND IT IS WORTH SAYING WHY.
  //
  // They locked in the fix made on 23 Oct, and that fix was half wrong. It had
  // the lending options look the broker up by full name - "Justin Cornock" -
  // in a list the deal addresses by key - "justin". The two never match, so
  // every broker resolved to Simplify only, and the "never leave it blank"
  // rule below then wrote Simplify over a chosen Navigate.
  //
  // Catherine, Operations Manager, 27 Oct: "When Navigate is selected at the BC
  // level, it switches back to Simplify Finance after moving on." She was
  // describing this, four days after we shipped it.
  //
  // A test that holds a bug in place is worse than no test. These now assert
  // the rule rather than the spelling of it - the rule itself, with its own
  // cases, is lib/the-brand-follows-the-broker.test.ts.

  it('reads the brands from settings and the BROKERS from the register', () => {
    // settings.brokers is frozen and was already out of date about Kylie.
    expect(lo).toContain("supabase.from('settings').select('brands')")
    expect(lo).toContain("from('brokers').select('broker_key, name, brand_ids, active')")
    expect(codeOnly(lo), 'the frozen broker list is being read again').not.toContain("select('brokers,")
  })

  it('offers the brands that broker holds, matched properly and not by name', () => {
    expect(lo).toContain('brandsOffered(brokersList, d.brokerSig')
    expect(lo).toContain('availableBrands.map')
    expect(codeOnly(lo), 'a broker is being matched on their full name again')
      .not.toContain('b.name === d.brokerSig')
  })

  it('never leaves the brand blank, and never overwrites a chosen one', () => {
    // Blank falls through to the default brand in lib/brand.ts, so blank is
    // still filled. What has stopped is overwriting a brand somebody picked
    // because we could not identify the broker.
    expect(lo).toContain('brandToSettleOn(brokersList, d.brokerSig')
    expect(codeOnly(lo), 'the Simplify guess is back').not.toContain("|| ['simplify']")
  })

  it('the brand box is in broker personalisation, beside the signature', () => {
    const i = lo.indexOf('>Broker personalisation</div>')
    const block = lo.slice(i, i + 2200)
    expect(block).toContain('Broker signature')
    expect(block).toContain('Brand')
  })
})

describe('the notes box pops whenever the deal moves', () => {
  for (const [name, src, send] of [
    ['the BC', bc, 'sendToClient()'],
    ['the LO', lo, 'sendEmail()'],
  ] as const) {
    it(`${name}: sending to the client asks first`, () => {
      expect(src, `${name} sends without opening the box`)
        .toContain('setThenSend(true); setHandingOver(true)')
      expect(src).toContain(`if (thenSend) { setThenSend(false); ${send} }`)
    })

    it(`${name}: and never asks twice on the same deal`, () => {
      // Credit already answered it on the handover, so the broker who sends
      // afterwards is not made to answer the same questions again.
      expect(src).toMatch(/if \((bc|lo)CompletedAt\) \{ send(ToClient|Email)\(\); return \}/)
    })

    it(`${name}: cancelling the box sends nothing`, () => {
      expect(src).toContain('setHandingOver(false); setThenSend(false)')
    })
  }
})
