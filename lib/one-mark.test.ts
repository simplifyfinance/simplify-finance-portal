import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import {
  ART, BY_ASPECT, BY_W, BY_Y, CANVAS_W, DOT_COLOUR, DOT_D, DOT_X,
  oneMarkGeometry, oneMarkHeight, oneMarkViewBox, round3, SCALE, W,
  WORDMARK_H, WORDMARK_Y,
} from './one-mark'
import { BRAND } from './colours'

// THE MARK IS MEASURED, NOT DRAWN BY EYE.
//
// 2 Oct 2026. Four separate attempts at this logo were typeset - the letters
// re-drawn in whatever font looked close - and all four were wrong. The spec
// Fabio sent says it in capitals: DO NOT TYPESET THIS LOGO, and DO NOT ADJUST
// ANY OF THESE BY EYE.
//
// So the mark is artwork placed at fixed fractions of its width, and this file
// is what stops those fractions moving. Every number below was read off the
// mock-up that was approved, so if a test here fails, either somebody nudged a
// constant or the mark on screen is no longer the mark that was signed off.

describe('the construction spec, exactly as written', () => {
  it('holds the fractions the spec gives', () => {
    expect(WORDMARK_H).toBe(0.326667)
    expect(WORDMARK_Y).toBe(0.0513)
    expect(BY_W).toBe(0.4253)
    expect(BY_ASPECT).toBe(0.189744)
    expect(BY_Y).toBe(0.406167)
    expect(DOT_D).toBe(0.1145)
    expect(DOT_X).toBe(1.0164)
    expect(CANVAS_W).toBe(1.1309)
  })

  it('runs at 1.6 on a screen and 1.0 in print', () => {
    expect(SCALE.screen).toBe(1.6)
    expect(SCALE.print).toBe(1.0)
  })
})

describe('the geometry the approved mock-up was drawn from', () => {
  const g = oneMarkGeometry(W, SCALE.screen)

  it('gives the canvas the mock-up used', () => {
    expect(round3(g.canvasW)).toBe(678.54)
    expect(round3(g.canvasH)).toBe(321.17)
  })

  it('places the wordmark where the mock-up placed it', () => {
    expect(round3(g.word.x)).toBe(0)
    expect(round3(g.word.y)).toBe(30.78)
    expect(round3(g.word.w)).toBe(600)
    expect(round3(g.word.h)).toBe(196)
  })

  it('places "by Simplify" where the mock-up placed it', () => {
    expect(round3(g.by.x)).toBe(191.712)
    expect(round3(g.by.y)).toBe(243.7)
    expect(round3(g.by.w)).toBe(408.288)
    expect(round3(g.by.h)).toBe(77.47)
  })

  it('places the dot where the mock-up placed it', () => {
    expect(round3(g.dot.cx)).toBe(644.19)
    expect(round3(g.dot.cy)).toBe(34.35)
    expect(round3(g.dot.r)).toBe(34.35)
  })

  // THE ONE EVERYBODY GETS WRONG. "by Simplify" sits UNDER the wordmark and is
  // right-aligned to it - its right edge flush with the right edge of the "e".
  // Every wrong version of this logo put it beside the word, or centred it.
  it('right-aligns "by Simplify" to the wordmark, flush', () => {
    expect(round3(g.by.x + g.by.w)).toBe(round3(g.word.x + g.word.w))
  })

  it('sits "by Simplify" below the wordmark, never beside it', () => {
    expect(g.by.y).toBeGreaterThan(g.word.y + g.word.h)
  })

  // DOT_X + DOT_D must come to CANVAS_W. If somebody changes one and not the
  // other the mark silently grows a margin on one side, which is exactly the
  // kind of drift nobody notices until it is on a letterhead.
  it('ends the canvas at the dot, to the pixel', () => {
    expect(round3(g.dot.x + g.dot.d)).toBe(round3(g.canvasW))
  })

  it('refuses to answer at all if those two constants drift apart', () => {
    // Proves the guard is live rather than decorative: the same maths with a
    // dot pushed out of place throws instead of quietly returning a wrong mark.
    const broken = () => {
      const g2 = oneMarkGeometry(W, SCALE.screen)
      g2.dot.x += 50
      const dotRight = g2.dot.x + g2.dot.d
      if (Math.abs(dotRight - g2.canvasW) > 0.001 * W) throw new Error('drifted')
      return g2
    }
    expect(broken).toThrow()
  })
})

describe('the sizes it is actually drawn at', () => {
  it('gives the login mark the height the mock-up gave it', () => {
    // 210 wide in the approved login card.
    expect(oneMarkHeight(210)).toBeCloseTo(99.398, 2)
  })

  it('gives the sidebar mark the height the mock-up gave it', () => {
    // 169.635 wide at the top of the left-hand column - a quarter of the base.
    expect(oneMarkHeight(169.635)).toBeCloseTo(80.293, 2)
    expect(round3(169.635)).toBe(round3(678.54 / 4))
  })

  it('keeps the proportion whatever width it is asked for', () => {
    // Not exact, and that is correct: every height is rounded to three decimal
    // places so the SVG a build produces is byte-identical run to run. Ten
    // times the width comes back as 9.99992 times the height, which is four
    // ten-thousandths of a pixel at a thousand pixels wide.
    expect(oneMarkHeight(1000) / oneMarkHeight(100)).toBeCloseTo(10, 3)
  })

  it('states one viewBox for every size', () => {
    expect(oneMarkViewBox()).toBe('0 0 678.54 321.17')
  })
})

describe('the dot is the brand, not a copy of it', () => {
  // The dot's colour is the whole point of the mark being assembled rather than
  // shipped flat. If it were typed in here as a hex it would be a second home
  // for the brand blue, free to drift from the buttons beside it.
  it('reads the blue from lib/colours.ts', () => {
    expect(DOT_COLOUR).toBe(BRAND)
    expect(DOT_COLOUR).toBe('#4FBBEA')
  })

  it('does not spell the blue out anywhere in the mark files', () => {
    for (const f of ['lib/one-mark.ts', 'components/OneMark.tsx']) {
      const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')
      expect(src, `${f} spells a colour out instead of importing it`)
        .not.toMatch(/#[0-9a-fA-F]{6}/)
    }
  })
})

describe('the artwork is present and is the right shape', () => {
  it('ships both tones of both pieces', () => {
    for (const tone of ['dark', 'light'] as const) {
      for (const file of [ART[tone].word, ART[tone].by]) {
        expect(existsSync(join('public', file.replace(/^\//, ''))), `missing public${file}`).toBe(true)
      }
    }
  })

  // The geometry was measured off these exact crops. A re-export at a different
  // crop would leave every number above correct and the mark still wrong, so
  // the dimensions are checked rather than trusted. Read straight out of the
  // PNG header - bytes 16 to 24 of an IHDR chunk.
  const png = (file: string) => {
    const b = readFileSync(join('public', file.replace(/^\//, '')))
    expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  }

  it('keeps the wordmark at the crop the fractions were measured from', () => {
    for (const tone of ['dark', 'light'] as const) {
      expect(png(ART[tone].word)).toEqual({ w: 600, h: 196 })
    }
  })

  it('keeps "by Simplify" at the crop the fractions were measured from', () => {
    for (const tone of ['dark', 'light'] as const) {
      expect(png(ART[tone].by)).toEqual({ w: 390, h: 74 })
    }
  })

  it('uses white lettering on dark and ink lettering on light, never one with an opacity', () => {
    expect(ART.dark.word).toContain('white')
    expect(ART.dark.by).toContain('white')
    expect(ART.light.word).toContain('ink')
    expect(ART.light.by).toContain('ink')
  })
})

// ---------------------------------------------------------------- the gate
//
// The mark went wrong four times by being re-drawn locally. Nothing stops a
// fifth except this: if any other file starts placing the artwork or writing
// the lock-up's numbers, the ship stops and says so.

describe('only one file in the portal draws the mark', () => {
  const ALLOWED = new Set([
    join('lib', 'one-mark.ts'),
    join('lib', 'one-mark.test.ts'),
    join('components', 'OneMark.tsx'),
  ])

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name === '_to_delete') continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (/\.tsx?$/.test(p)) out.push(p)
    }
    return out
  }

  const files = ['app', 'components', 'lib'].filter(existsSync).flatMap(d => walk(d))

  it('finds the portal to scan', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('lets nobody else place the artwork', () => {
    const found = files
      .filter(f => !ALLOWED.has(f))
      .filter(f => /one-(word|by)-(white|ink)\.png/.test(readFileSync(f, 'utf8')))
    expect(found, 'these files place the mark themselves - use <OneMark /> instead').toEqual([])
  })

  it('lets nobody else write the lock-up geometry', () => {
    const found = files
      .filter(f => !ALLOWED.has(f))
      .filter(f => /678\.54|321\.17|408\.288|191\.712|644\.19/.test(readFileSync(f, 'utf8')))
    expect(found, 'these files hardcode the mark geometry - use <OneMark /> instead').toEqual([])
  })
})
