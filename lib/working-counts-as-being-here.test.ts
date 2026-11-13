// WORKING COUNTS AS BEING THERE.
//
// 13 Nov 2026. Katie signed in at 1:42pm, saved Jayver Varghese's compliance
// card at 3:11pm, and was signed out for inactivity at 3:14pm. The portal's
// own logs have her write, with her name on it, three minutes before it
// decided she had been doing nothing for an hour.
//
// The cause was the rule I wrote on 21 October. It counted a keydown and a
// pointerdown and nothing else, because that day's fault was a laptop left
// open overnight. It is the wrong measure: this portal SAVES AS YOU TYPE, so
// the proof somebody is at their desk is the save, not a key event measured a
// particular way.
//
// These tests hold both ends of that. Working keeps you signed in. A tab
// nobody is using still times out.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { shouldTell, someoneIsHere, forgetLastTold, SIGNS_OF_LIFE } from './still-here'
import { TOUCH_EVERY_MS } from './two-factor'

describe('how often the server is told', () => {
  it('tells it the first time, whatever the clock says', () => {
    expect(shouldTell(0, 1_000)).toBe(true)
    expect(shouldTell(NaN, 1_000)).toBe(true)
  })

  // A PERSON HAMMERING A KEYBOARD COSTS ONE REQUEST EVERY FIVE MINUTES.
  it('says nothing again until five minutes have passed', () => {
    const at = 1_000_000
    expect(shouldTell(at, at + 1_000)).toBe(false)
    expect(shouldTell(at, at + TOUCH_EVERY_MS - 1)).toBe(false)
    expect(shouldTell(at, at + TOUCH_EVERY_MS)).toBe(true)
  })
})

describe('what counts as somebody being there', () => {
  // THE ONE THAT WAS MISSING. Typing into a box is how this portal is used.
  it('includes typing into a box, not only pressing a key', () => {
    expect(SIGNS_OF_LIFE).toContain('input')
    expect(SIGNS_OF_LIFE).toContain('keydown')
    expect(SIGNS_OF_LIFE).toContain('pointerdown')
  })

  // THE ASSERTION THAT WOULD HAVE SAVED KATIE'S AFTERNOON.
  it('and a save, because a save cannot happen without a person', () => {
    const code = readFileSync('lib/checked-write.ts', 'utf8')
    expect(code, 'every checked write must say somebody is here')
      .toContain('someoneIsHere()')
  })

  it('and the listener and the save share one counter', () => {
    const comp = readFileSync('components/StillHere.tsx', 'utf8')
    expect(comp).toContain("from '@/lib/still-here'")
    // Its own five minute timer would let a save and a keystroke send two.
    expect(comp, 'StillHere keeps its own clock instead of the shared one')
      .not.toContain('TOUCH_EVERY_MS')
  })
})

describe('a laptop left open overnight still times out', () => {
  const realFetch = globalThis.fetch
  let sent = 0

  beforeEach(() => {
    sent = 0
    forgetLastTold()
    ;(globalThis as any).fetch = vi.fn(() => { sent++; return Promise.resolve({ ok: true }) })
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', { hidden: false })
  })
  afterEach(() => {
    ;(globalThis as any).fetch = realFetch
    vi.unstubAllGlobals()
  })

  it('sends nothing at all when nobody touches it and nothing saves', () => {
    // Twelve hours of a tab sitting there. someoneIsHere is only ever called
    // BY a person or BY a save; neither happens here.
    expect(sent).toBe(0)
  })

  // Fabio, 21 Oct 2026: "I leave the portal open and it stays open overnight."
  it('and a hidden tab says nothing even if something fires in it', () => {
    vi.stubGlobal('document', { hidden: true })
    someoneIsHere(1_000_000)
    expect(sent).toBe(0)
  })

  it('but somebody working sends one heartbeat, then holds for five minutes', () => {
    const at = 1_000_000
    someoneIsHere(at)
    someoneIsHere(at + 1_000)
    someoneIsHere(at + 60_000)
    expect(sent).toBe(1)
    someoneIsHere(at + TOUCH_EVERY_MS)
    expect(sent).toBe(2)
  })
})
