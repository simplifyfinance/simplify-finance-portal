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

describe('the lending options knows its brand', () => {
  it('no longer types a trading name into the page', () => {
    expect(lo, 'the broker dropdown is hard-coding a brand again')
      .not.toContain('— Simplify Finance</option>')
  })

  it('reads brokers and brands from the one record that holds both', () => {
    expect(lo).toContain("supabase.from('settings').select('brokers, brands')")
  })

  it('offers only the brands that broker actually holds', () => {
    expect(lo).toContain("brokersList.find((b: any) => b.name === d.brokerSig)?.brandIds")
    expect(lo).toContain('availableBrands.map')
  })

  it('and never leaves the brand blank, which is what fell through to Simplify', () => {
    expect(lo).toContain('!availableBrands.some((br: any) => br.id === d.brandId)')
    expect(lo).toContain('brandId: availableBrands[0].id')
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
