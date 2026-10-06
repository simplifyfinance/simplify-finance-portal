import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
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
  // brandInk -> brand-ink, cardChaseEdge -> card-chase-edge, gray50 -> gray-50.
  // The digit rule is not decoration: without it gray50 would look for
  // --color-gray50, which Tailwind has never heard of, and this test would pass
  // by comparing nothing against nothing.
  const toCss = (k: string) =>
    k.replace(/([A-Z])/g, '-$1').replace(/([a-z])(\d)/g, '$1-$2').toLowerCase()
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

  // The dark ramp is written out as hexes rather than as references, because a
  // key cannot point at another key inside the same object. So the steps that
  // are meant to match a surface are checked here instead of trusted.
  it('ties the dark grey ramp to the dark surfaces it is meant to match', () => {
    expect(C.DARK.gray50).toBe(C.DARK.panel)
    expect(C.DARK.gray100).toBe(C.DARK.lineSoft)
    expect(C.DARK.gray200).toBe(C.DARK.line)
    expect(C.DARK.gray400).toBe(C.DARK.faint)
    expect(C.DARK.gray500).toBe(C.DARK.muted)
    expect(C.DARK.gray600).toBe(C.DARK.body)
    expect(C.DARK.gray800).toBe(C.DARK.ink)
  })
})

describe('the grey the portal wears', () => {
  // 465 places ask Tailwind for a grey. These names decide what they get, so
  // the thing that matters is that they are OURS and not Tailwind's.
  const RAMP = ['50', '100', '200', '300', '400', '500', '600', '700', '800'] as const

  it('replaces every step Tailwind would otherwise supply', () => {
    for (const step of RAMP) {
      expect(cssColours[`gray-${step}`], `--color-gray-${step} is missing`).toBeTruthy()
    }
  })

  it('reuses the names it already has instead of a second copy of the same hex', () => {
    expect(C.GRAY_100).toBe(C.LINE_SOFT)
    expect(C.GRAY_200).toBe(C.LINE)
    expect(C.GRAY_400).toBe(C.FAINT)
    expect(C.GRAY_500).toBe(C.MUTED)
    expect(C.GRAY_600).toBe(C.BODY)
    expect(C.GRAY_800).toBe(C.INK)
  })

  it('gets darker every step, with no two the same', () => {
    const lum = (hex: string) =>
      parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)
    const light = RAMP.map(s => cssColours[`gray-${s}`])
    for (let i = 1; i < light.length; i++) {
      expect(lum(light[i]), `gray-${RAMP[i]} is not darker than gray-${RAMP[i - 1]}`)
        .toBeLessThan(lum(light[i - 1]))
    }
  })

  // THE WHOLE POINT. Tailwind's greys are cool - more blue than red. Ours are
  // warm. If a step ever comes back cool, the portal goes back to looking
  // faintly dirty and nobody will be able to say why.
  it('is warm at every step, which is the entire reason it exists', () => {
    const cold: string[] = []
    for (const step of RAMP) {
      const hex = cssColours[`gray-${step}`]
      const r = parseInt(hex.slice(1, 3), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      if (b >= r) cold.push(`gray-${step} (${hex}) has as much blue as red`)
    }
    expect(cold, cold.join('\n')).toEqual([])
  })

  it('and the page itself is no longer the cool grey it used to be', () => {
    // Comments stripped first - the old value is NAMED in a comment, on
    // purpose, so a reader knows what changed and why. Naming it is fine;
    // declaring it is not.
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(declarations).not.toContain('#F5F5F3')
    expect(declarations).toMatch(/body\s*\{[^}]*background-color:\s*var\(--color-page\)/)
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

  it('colours.ts keeps a note of where the migration is up to', () => {
    const src = readFileSync('lib/colours.ts', 'utf8')
    expect(src).toContain('THE MIGRATION')
    expect(src).toContain('THE BLUE IS DONE')
  })
})

// THE OLD BLUE CANNOT COME BACK TO A SCREEN.
//
// 6 Oct 2026. 272 places stopped spelling a blue out by hand in one ship. The
// only thing keeping them that way is this, because the next person reaching
// for a blue will reach for the one they remember - that is how it got to 361
// places the first time.
//
// TWO BLUES ARE BANNED, not one. #2DBEFF, and Tailwind's own blue-NNN ramp,
// which is COOL. The portal's page, lines and ink are warm; a cool blue on a
// warm off-white reads as dirty. That is the same fault lib/colours.ts fixed
// for the greys, written down there at length.
//
// WHAT IS NOT A SCREEN. app/api/ builds HTML emails, and so does every *-email
// file in lib/. Fabio, 4 Oct 2026: "these changes are esthetic to the portal we
// are not changing any html email forms". The emails still send the old blue,
// and the brand accent colour in Settings is the value they are built from - so
// that one file is named below rather than swept, and the exception is the
// decision, not an oversight.
describe('a screen does not spell a blue out by hand', () => {
  const ALLOWED = [
    // the accent colour the emails are built from - see above
    'app/(app)/settings/SettingsClient.tsx',
  ]

  const screens: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = `${dir}/${e.name}`
      if (e.isDirectory()) { if (f !== 'app/api') walk(f) }
      else if (/\.tsx?$/.test(e.name) && !ALLOWED.includes(f)) screens.push(f)
    }
  }
  walk('app')
  walk('components')

  it('there are screens to check', () => {
    expect(screens.length).toBeGreaterThan(100)
  })

  it('none of them has the retired blue or a Tailwind blue in it', () => {
    const caught: string[] = []
    for (const f of screens) {
      const src = readFileSync(f, 'utf8')
      if (src.includes(C.RETIRED[0])) caught.push(`${f}: ${C.RETIRED[0]}`)
      for (const m of src.matchAll(/\b(?:bg|text|border|ring)-blue-\d+/g)) {
        caught.push(`${f}: ${m[0]}`)
      }
    }
    expect(caught, `a blue is spelled out by hand here. Use a name from\n`
      + `lib/colours.ts instead - brand for a fill or an edge, brand-ink for a\n`
      + `word, info / info-bg / info-edge for a washed blue chip.\n`
      + caught.join('\n')).toEqual([])
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
