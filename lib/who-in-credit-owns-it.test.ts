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
    expect(creditColour('Katie Amos')).toBe('#E23D93')
    expect(creditColour('Mellissa Sedin')).toBe('#6D5DF6')
    expect(creditColour('Melissa Sedin')).toBe('#6D5DF6')
    expect(creditColour('Dinisha Devadason')).toBe('#B5762F')
  })

  // BRONZE, NOT GOLD. Fabio, 17 Nov 2026, rejecting the first attempt:
  // "Bronze is definitely the color now for the nation, not yellow."
  it('gives Dinisha bronze and never a yellow', () => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(creditColour('Dinisha')!.slice(i, i + 2), 16))
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
    expect(b).toBeLessThan(90)
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
    const skin = cardSkin('#E23D93')
    expect(skin.background).toContain('var(--color-card)')
    expect(skin.borderColor).toContain('var(--color-card-line)')
  })
})

describe('the card sits on a shadow', () => {
  // 18 Nov 2026. The approved mock has one on every card and the live board had
  // none, so hovering deepened nothing. Fabio: "the shading is still not
  // showing. It doesn't lift up when I'm hovering."
  it('tinted with the owner where there is one', () => {
    expect(cardSkin('#E23D93')['--sh']).toContain('#E23D93')
    expect(cardSkin('#E23D93')['--shh']).toContain('#E23D93')
  })

  it('and a plain one on a card nobody in credit has yet', () => {
    expect(cardSkin(null)['--sh']).toContain('rgba(20,20,15')
    expect(cardSkin(null)['--sh']).not.toContain('color-mix')
  })

  // AN INLINE SHADOW BEATS A HOVER CLASS, WHICH IS WHY NOTHING HAPPENED THE
  // FIRST TIME. Both shadows are variables now and the card wears them through
  // classes, so :hover can win.
  it('never hands the shadow back as an inline boxShadow again', () => {
    expect(cardSkin('#E23D93').boxShadow).toBeUndefined()
    expect(cardSkin(null).boxShadow).toBeUndefined()
  })

  it('the board puts it on the card and deepens it on hover', () => {
    const board = readFileSync('components/DealBoard.tsx', 'utf8')
    expect(board).toContain('style={skin as React.CSSProperties}')
    expect(board).toContain('hover:-translate-y-[2px]')
    expect(board).toContain('shadow-[var(--sh)] hover:shadow-[var(--shh)]')
  })
})
