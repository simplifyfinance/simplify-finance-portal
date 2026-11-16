import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { creditColour, cardSkin, AGREED } from './who-in-credit-owns-it'

describe('the colour of a deal card', () => {
  it('is white until somebody in credit has it', () => {
    expect(creditColour(null)).toBe(null)
    expect(creditColour('')).toBe(null)
    expect(creditColour('   ')).toBe(null)
    expect(cardSkin(null).background).toBe('var(--color-card)')
  })

  it('is the colour Fabio named, whichever way the name is spelled', () => {
    expect(creditColour('Katie Amos')).toBe('#2A48B8')
    expect(creditColour('Mellissa Sedin')).toBe('#2B9BE0')
    expect(creditColour('Melissa Sedin')).toBe('#2B9BE0')
    expect(creditColour('Dinisha Devadason')).toBe('#7A4F7A')
  })

  // DINISHA IS NOT GREEN, AND IT IS NOT A NEAR MISS EITHER.
  //
  // 16 Nov 2026. Fabio asked to see Dinisha in green, with Katie and Mellissa
  // left alone. Four greens were drawn on the real board beside a card that had
  // turned green because the client agreed, and the closest of them could not
  // be told apart from it. He picked plum instead.
  //
  // So this does not check for plum - a colour written down twice is a colour
  // free to drift. It checks the thing the choice was made FOR: green is the
  // client's, and nobody in credit may wear it or anything near it.
  it('keeps Dinisha well clear of the green that means the client agreed', () => {
    const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
    const [r, g, b] = hex(creditColour('Dinisha')!)
    expect(g, 'a green-dominant card is the agreed card').not.toBeGreaterThan(Math.max(r, b))
    const [ar, ag, ab] = hex(AGREED)
    const apart = Math.abs(r - ar) + Math.abs(g - ag) + Math.abs(b - ab)
    expect(apart, `too close to ${AGREED}`).toBeGreaterThan(120)
  })

  it('gives anybody else a colour, and the same one every time', () => {
    const once = creditColour('Ria Mendoza')
    expect(once).toBeTruthy()
    expect(creditColour('Ria Mendoza')).toBe(once)
    expect(creditColour('ria')).toBe(once)
  })

  it('never hands anybody the green that means the client agreed', () => {
    const names = ['Katie', 'Mellissa', 'Dinisha', 'Ria', 'Ellesse', 'Belle', 'Julian', 'Alan']
    for (const n of names) expect(creditColour(n)).not.toBe(AGREED)
  })

  it('mixes against the theme, so the dark screen needs no second set of numbers', () => {
    const skin = cardSkin('#2A48B8')
    expect(skin.background).toContain('var(--color-card)')
    expect(skin.borderColor).toContain('var(--color-card-line)')
  })
})

describe('the card sits on a shadow', () => {
  // 18 Nov 2026. The approved mock has one on every card and the live board had
  // none, so hovering deepened nothing. Fabio: "the shading is still not
  // showing. It doesn't lift up when I'm hovering."
  it('tinted with the owner where there is one', () => {
    expect(cardSkin('#2A48B8')['--sh']).toContain('#2A48B8')
    expect(cardSkin('#2A48B8')['--shh']).toContain('#2A48B8')
  })

  it('and a plain one on a card nobody in credit has yet', () => {
    expect(cardSkin(null)['--sh']).toContain('rgba(20,20,15')
    expect(cardSkin(null)['--sh']).not.toContain('color-mix')
  })

  // AN INLINE SHADOW BEATS A HOVER CLASS, WHICH IS WHY NOTHING HAPPENED THE
  // FIRST TIME. Both shadows are variables now and the card wears them through
  // classes, so :hover can win.
  it('never hands the shadow back as an inline boxShadow again', () => {
    expect(cardSkin('#2A48B8').boxShadow).toBeUndefined()
    expect(cardSkin(null).boxShadow).toBeUndefined()
  })

  it('the board puts it on the card and deepens it on hover', () => {
    const board = readFileSync('components/DealBoard.tsx', 'utf8')
    expect(board).toContain('style={skin as React.CSSProperties}')
    expect(board).toContain('hover:-translate-y-[2px]')
    expect(board).toContain('shadow-[var(--sh)] hover:shadow-[var(--shh)]')
  })
})
