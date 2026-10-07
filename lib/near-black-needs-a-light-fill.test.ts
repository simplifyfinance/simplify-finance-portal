import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// NEAR-BLACK WRITING NEEDS A LIGHT BLUE FILL UNDER IT. NOT A TINT, NOT A DARK
// BLUE, AND NEVER THE SIDEBAR.
//
// 6 Oct 2026, and this one reached Fabio's screen. text-on-brand is #0F1115 -
// the near-black that sits ON the brand blue, because white on that blue reads
// at 2.2 to 1. A sweep moved white writing onto it wherever a line had both a
// brand background and white writing, and got this wrong:
//
//     path.startsWith(item.href) ? 'text-brand bg-brand/12'
//                                : 'text-white/60 hover:text-white'
//
// One line, two states. The tint belongs to the SELECTED tab; the white belongs
// to every OTHER tab, which sits on the near-black sidebar. Every unselected
// item in the left-hand column went black on black. They were all still there
// and nobody could see them.
//
// THREE SHAPES ARE BANNED, and each one is the same mistake:
//
//   text-on-brand/NN   an opacity on near-black. The only reason to fade
//                      near-black is that it is standing on something dark,
//                      which is exactly where it must not be.
//   bg-brand-ink ... text-on-brand    brand-ink is #107EA8, a DARK blue. White
//                      on it is 4.6 to 1. Near-black on it is unreadable.
//   text-on-brand with no bg-brand anywhere on the line - nothing is holding
//                      the light blue fill up.
//
// bg-brand/NN is deliberately NOT banned on its own: a line may legitimately
// carry a tint for one state and a solid fill for another. The three rules
// above catch the real fault without guessing at which branch is which.
const ROOTS = ['app', 'components']

const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '_to_delete') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

describe('near-black writing stands on the light blue, or nowhere', () => {
  const files = ROOTS.flatMap(d => walk(d))

  it('finds the screens to check', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('nothing fades near-black, puts it on the dark blue, or leaves it unsupported', () => {
    const caught: string[] = []
    for (const f of files) {
      const lines = readFileSync(f, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (!line.includes('text-on-brand')) return
        const where = `${f}:${i + 1}`
        if (/text-on-brand\/\d/.test(line)) {
          caught.push(`${where}: text-on-brand with an opacity - near-black is being faded onto something dark`)
        }
        if (line.includes('bg-brand-ink') && line.includes('text-on-brand')) {
          caught.push(`${where}: near-black on brand-ink, which is itself a dark blue`)
        }
        if (!line.includes('bg-brand')) {
          caught.push(`${where}: text-on-brand with no brand fill on the line to stand on`)
        }
      })
    }
    expect(caught, 'text-on-brand is #0F1115. It belongs on the solid brand blue\n'
      + 'and nowhere else. Use text-white on the sidebar and on brand-ink.\n'
      + caught.join('\n')).toEqual([])
  })

  // THE LEFT-HAND COLUMN IS NEAR-BLACK IN BOTH THEMES. Nothing in it may wear a
  // near-black ink except the initials, which sit inside a blue circle.
  it('the sidebar writes in white, not in near-black', () => {
    const src = readFileSync('components/Sidebar.tsx', 'utf8')
    const bad = src.split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(x => x.line.includes('text-on-brand') && !x.line.includes('bg-brand text-on-brand'))
      .map(x => `  line ${x.n}: ${x.line}`)
    expect(bad, 'the sidebar is near-black. Near-black writing on it cannot be seen,\n'
      + 'which is exactly how every unselected tab disappeared on 6 Oct 2026.\n'
      + bad.join('\n')).toEqual([])
  })
})

// ================================================================= 7 Oct 2026
//
// THE SECOND HALF OF THE SAME FAULT: WHITE LETTERS ON A NEAR-WHITE PILL.
//
// The sidebar one above was near-black ink on a near-black fill. This is the
// mirror image, and it was on 27 buttons across 22 files.
//
//   --color-ink   #17140F light   #E9EDF1 dark    it inverts, as it must
//   text-white    #FFFFFF         #FFFFFF         it does not
//
// bg-ink with text-white is 17 to 1 on the light theme and 1.1 to 1 on the dark
// one. Every selected broker pill, every selected settlement step, the Save on
// a handover - all blank in dark mode, the words still sitting there.
//
// bg-brand-ink is the same thing reversed: #107EA8 light, #6FD3FF - a LIGHT
// blue - dark, so white on it is 1.3 to 1.
//
// text-page is the ink that moves with them, and 68 places already used it.
//
// Matched only INSIDE one class string - no quote, backtick or brace between
// the fill and the ink - so a line carrying two states cannot be accused of a
// fault that belongs to neither half. That mistake is what put the sidebar on
// this list in the first place.
describe('an ink that does not invert never sits on a fill that does', () => {
  const files = ROOTS.flatMap(d => walk(d))
  const SAME_CLASS_STRING = /bg-(?:brand-)?ink[^"'`{}]*text-white|text-white[^"'`{}]*bg-(?:brand-)?ink/

  it('no white writing on bg-ink or bg-brand-ink', () => {
    const caught: string[] = []
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (SAME_CLASS_STRING.test(line)) caught.push(`${f}:${i + 1}`)
      })
    }
    expect(caught, 'text-white is #FFFFFF in BOTH themes. ink and brand-ink both\n'
      + 'invert, so in dark mode this is white on near-white - about 1.1 to 1,\n'
      + 'and the button reads as empty. Use text-page, which inverts with them.\n'
      + caught.join('\n')).toEqual([])
  })
})
