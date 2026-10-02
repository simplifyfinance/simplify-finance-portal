import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import * as C from './colours'

// TWO FILES HOLD THE PALETTE, SO SOMETHING HAS TO STOP THEM DRIFTING.
//
// lib/colours.ts is what TypeScript reads. app/globals.css is what Tailwind
// reads. They have to carry the same values, and the way that quietly stops
// being true is somebody changing one of them in a hurry.
//
// So this reads both and compares them. Not a list of expected colours written
// down a third time - the third copy would drift too. It derives the pairing
// from the names and checks every single one.

const css = readFileSync('app/globals.css', 'utf8')

// THE FILE NOW HOLDS TWO SETS OF THE SAME NAMES - the light ones in @theme and
// the dark ones in the [data-theme="dark"] block. Reading the whole file at once
// let the second set silently overwrite the first, which made the pairing test
// pass while comparing light values against dark ones. So each block is cut out
// by name and read on its own.
function section(opener: string): string {
  const i = css.indexOf(opener)
  if (i < 0) throw new Error(`globals.css no longer contains "${opener}"`)
  const end = css.indexOf('\n}', i)
  if (end < 0) throw new Error(`"${opener}" in globals.css is never closed`)
  return css.slice(i, end)
}

// --color-brand-ink: #107EA8;  ->  { 'brand-ink': '#107EA8' }
function coloursIn(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/--color-([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    out[m[1]] = m[2].toUpperCase()
  }
  return out
}

const cssColours = coloursIn(section('@theme {'))
const cssDark = coloursIn(section(':root[data-theme="dark"] {'))

// BRAND_INK -> brand-ink
const toCssName = (k: string) => k.toLowerCase().replace(/_/g, '-')

// The flat string exports, which are the ones Tailwind mirrors. DARK and
// RETIRED are not colours-with-a-name, they are a group and a list.
const tsColours: Record<string, string> = {}
for (const [k, v] of Object.entries(C)) {
  if (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)) tsColours[k] = v.toUpperCase()
}

describe('the palette exists at all', () => {
  it('globals.css carries a @theme block with colours in it', () => {
    expect(css).toContain('@theme {')
    expect(Object.keys(cssColours).length).toBeGreaterThan(25)
  })

  it('and colours.ts carries the same number of them', () => {
    expect(Object.keys(tsColours).length).toBe(Object.keys(cssColours).length)
  })
})

describe('the two files agree, colour by colour', () => {
  // THE TEST THAT MATTERS. Every name in TypeScript has to exist in the CSS
  // with the same value, and nothing can exist in one and not the other.
  it('every colour in colours.ts is in globals.css with the same value', () => {
    const wrong: string[] = []
    for (const [k, v] of Object.entries(tsColours)) {
      const name = toCssName(k)
      if (!(name in cssColours)) { wrong.push(`${k} is in colours.ts but --color-${name} is not in globals.css`); continue }
      if (cssColours[name] !== v) wrong.push(`${k} is ${v} in colours.ts but --color-${name} is ${cssColours[name]}`)
    }
    expect(wrong, wrong.join('\n')).toEqual([])
  })

  it('and nothing is in globals.css that colours.ts has never heard of', () => {
    const known = new Set(Object.keys(tsColours).map(toCssName))
    const stray = Object.keys(cssColours).filter(n => !known.has(n))
    expect(stray, `in globals.css only: ${stray.join(', ')}`).toEqual([])
  })
})

describe('the dark half agrees with itself too', () => {
  // brandInk -> brand-ink,  cardChaseEdge -> card-chase-edge
  const toCss = (k: string) => k.replace(/([A-Z])/g, '-$1').toLowerCase()
  const tsDark: Record<string, string> = Object.fromEntries(
    Object.entries(C.DARK).map(([k, v]) => [toCss(k), String(v).toUpperCase()])
  )

  it('every dark value in colours.ts is in globals.css with the same value', () => {
    const wrong: string[] = []
    for (const [name, v] of Object.entries(tsDark)) {
      if (!(name in cssDark)) { wrong.push(`DARK.${name} is in colours.ts but --color-${name} is not in the dark block`); continue }
      if (cssDark[name] !== v) wrong.push(`DARK.${name} is ${v} in colours.ts but --color-${name} is ${cssDark[name]}`)
    }
    expect(wrong, wrong.join('\n')).toEqual([])
  })

  it('and nothing is in the dark block that colours.ts has never heard of', () => {
    const stray = Object.keys(cssDark).filter(n => !(n in tsDark))
    expect(stray, `in the dark block only: ${stray.join(', ')}`).toEqual([])
  })

  // A dark name that is not also a light name is a colour that appears out of
  // nowhere when somebody presses the switch.
  it('every dark name is the name of a colour that exists in light', () => {
    const orphans = Object.keys(tsDark).filter(n => !(n in cssColours))
    expect(orphans, `dark-only names: ${orphans.join(', ')}`).toEqual([])
  })

  // The three that must NOT move. The left-hand column is the one fixed thing
  // on screen; the brand blue is a fill and works on either surface.
  it('leaves the sidebar and the brand fill alone', () => {
    for (const fixed of ['sidebar', 'brand', 'on-brand']) {
      expect(fixed in tsDark, `${fixed} must not change between themes`).toBe(false)
      expect(fixed in cssDark, `--color-${fixed} must not be in the dark block`).toBe(false)
    }
  })

  it('keeps a field darker than the card it sits in, which is the whole reason it has a name', () => {
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)
    expect(lum(C.DARK.field)).toBeLessThan(lum(C.DARK.card))
  })

  it('lifts the blue for words rather than inventing a second blue', () => {
    expect(C.DARK.brandInk).toBe(C.BRAND_LIFT)
    expect(C.DARK.info).toBe(C.BRAND_LIFT)
  })
})

describe('the few values that are not a matter of taste', () => {
  // These were measured, not chosen, and a careless edit to any of them
  // reintroduces a fault we have already fixed once.

  it('the brand blue is the one in the artwork', () => {
    expect(C.BRAND).toBe('#4FBBEA')
  })

  it('and it is not the blue the portal used to use', () => {
    expect(C.BRAND).not.toBe(C.RETIRED[0])
    expect(Object.values(tsColours)).not.toContain('#2DBEFF')
  })

  it('the sidebar and the thing that sits on a brand button are the same near-black', () => {
    expect(C.SIDEBAR).toBe(C.ON_BRAND)
  })

  it('there is no amber anywhere', () => {
    // Amber was indistinguishable from the chase red to a red-green colourblind
    // reader. Anything in this corner of the spectrum is suspect.
    const amberish = Object.entries(tsColours).filter(([, v]) => {
      const r = parseInt(v.slice(1, 3), 16), g = parseInt(v.slice(3, 5), 16), b = parseInt(v.slice(5, 7), 16)
      // a strong warm yellow-brown: red high, green middling, blue low
      return r > 120 && g > 70 && g < r && b < g * 0.6
    })
    expect(amberish.map(([k]) => k), 'this looks like amber coming back').toEqual([])
  })

  it('the dark set is present and separate, ready for its own ship', () => {
    expect(C.DARK.page).toBe('#1C2025')
    // The sidebar is #0F1115 in both themes, so the dark page must not be near
    // it - at #15181B they were 1.06 to 1 apart and the sidebar vanished.
    expect(C.DARK.page).not.toBe('#15181B')
  })
})

describe('what is actually wired up', () => {
  // This started life as "nothing is wired up yet". It is now the running
  // record of which screens have been migrated, so that the palette cannot
  // quietly claim to be the only home of every colour while the screens it
  // names are still spelling them out by hand.
  const MIGRATED = ['components/Sidebar.tsx', 'app/login/page.tsx']

  const code = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('the migrated screens use the names instead of spelling colours out', () => {
    const spelling: string[] = []
    for (const f of MIGRATED) {
      for (const m of code(readFileSync(f, 'utf8')).matchAll(/#[0-9A-Fa-f]{6}/g)) {
        spelling.push(`${f}: ${m[0]}`)
      }
    }
    expect(spelling, `these should be a palette name, not a hex:\n${spelling.join('\n')}`).toEqual([])
  })

  it('and the old blue is gone from them for good', () => {
    for (const f of MIGRATED) {
      expect(readFileSync(f, 'utf8'), `${f} still has the retired blue in it`)
        .not.toContain(C.RETIRED[0])
    }
  })

  it('colours.ts says the migration has started, so the note cannot go stale', () => {
    const src = readFileSync('lib/colours.ts', 'utf8')
    expect(src).toContain('THE MIGRATION HAS STARTED')
  })
})

// THE NAMES HAVE TO ACTUALLY WORK, NOT JUST EXIST.
//
// A @theme block with a typo in it does not fail the build - Tailwind simply
// does not produce the class, and the screen that asked for text-brand gets no
// colour at all. That is a silent failure, and the next ship is a hundred of
// these. So this compiles the real stylesheet and proves each name produces a
// utility that resolves to the right value.
//
// Tailwind v4 strips theme variables nothing uses, which is why this has to
// force them in. It is also why adding this block changed nothing on screen:
// today nothing uses them, so nothing is emitted.
describe('the names compile into real Tailwind classes', () => {
  it('every one produces a utility that resolves to its own hex', async () => {
    const postcss = (await import('postcss')).default
    const tailwind = (await import('@tailwindcss/postcss')).default

    const names = Object.keys(tsColours).map(toCssName)
    const utilities = names.map(n => `bg-${n}`).join(' ')
    const source = readFileSync('app/globals.css', 'utf8') + `\n@source inline("${utilities}");\n`

    const out = (await postcss([tailwind()]).process(source, { from: 'app/globals.css', to: undefined })).css.toLowerCase()

    const broken: string[] = []
    for (const [key, hex] of Object.entries(tsColours)) {
      const name = toCssName(key)
      if (!out.includes(`.bg-${name} {`)) { broken.push(`bg-${name} was not generated`); continue }
      const defined = new RegExp(`--color-${name.replace(/-/g, '\\-')}\\s*:\\s*${hex.toLowerCase()}`)
      if (!defined.test(out)) broken.push(`--color-${name} does not resolve to ${hex}`)
    }
    expect(broken, broken.join('\n')).toEqual([])
  }, 30000)
})
