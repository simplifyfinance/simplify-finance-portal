import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// "IT JUST SITS THERE. YOU DON'T KNOW IF IT'S LOADING OR NOT."
//
// Fabio, 7 Oct 2026, about pressing RBA rate notice.
//
// Every screen answered that question on its own and every one of them
// answered it quietly: one line of small grey type at the top left of an empty
// page. On a wide monitor your eye is nowhere near that corner, so the page
// reads as broken rather than busy - and somebody who thinks nothing happened
// clicks again and loads the whole thing twice.
//
// Two devices replaced it. A bar across the top, which goes everywhere at once
// and answers "did my click land". And the page drawing its own shape in grey,
// which answers "is this going to be a page", and goes in one screen at a time.
//
// THIS FILE GUARDS THE PLUMBING, because the ways the bar breaks are all quiet
// ones: it either never appears, or it never goes away. Neither throws.

const busy = readFileSync('components/useBusy.ts', 'utf8')
const bar = readFileSync('components/TopProgress.tsx', 'utf8')
const sidebar = readFileSync('components/Sidebar.tsx', 'utf8')
const mark = readFileSync('components/OneMark.tsx', 'utf8')
const css = readFileSync('app/globals.css', 'utf8')

describe('the bar comes on', () => {
  it('the moment a nav item is pressed, not when its data lands', () => {
    // The whole complaint is about the second BEFORE anything has been
    // fetched. A bar that waits for the fetch to start is a bar that is late.
    expect(sidebar, 'a nav item no longer says it was pressed')
      .toContain('onClick={() => { navStarted();')
    expect(sidebar, 'a sub-page no longer says it was pressed')
      .toContain('navStarted(); window.location.hash')
  })

  it('and when any screen is fetching', () => {
    expect(busy).toContain('export function useBusyWhile')
  })
})

describe('the bar only ever goes forward', () => {
  // 7 Oct 2026, the second version. The first ran a CSS animation on a loop -
  // out to 92%, snap back to 4%, again - and Fabio said what it looked like:
  // "it keeps loading back and forth, back and forth, which is very troubling."
  // A bar that restarts is movement carrying no information.
  it('has no looping animation left in it', () => {
    expect(bar, 'the bar is animated again. An animation that repeats WILL walk\n'
      + 'it backwards; its width has to be a number that never decreases.')
      .not.toMatch(/animation:[^;'`]*infinite/)
    expect(css, 'the looping keyframes are back in globals.css')
      .not.toMatch(/\.creep\s*\{[^}]*infinite/)
  })

  it('never lets the width fall', () => {
    // Math.max against its own previous value is the whole guarantee. Without
    // it, a slow creep and a fast completion can disagree and the bar jumps
    // back - which is the fault being fixed.
    expect(bar).toMatch(/Math\.max\(p,/)
  })

  it('measures some of it from work that has actually landed', () => {
    // Fabio: "the blue line at the top really loads in progression to how much
    // you're loading". One fetch cannot show progress, but a page firing five
    // can, and this is the half that is not guesswork.
    expect(busy).toContain('export function busyProgress')
    expect(bar).toContain('busyProgress()')
  })

  it('stops short of the end until the work is done', () => {
    // Nothing here knows how long a query takes, so the bar must not reach 100
    // on a guess. It creeps to a ceiling and only completes for real.
    expect(bar).toMatch(/CREEP_CEILING = 9\d/)
  })
})

describe('the bar goes off again', () => {
  it('when the address changes, not when the thing that started it says so', () => {
    // navStarted cannot know whether the page it asked for turned up. If the
    // only thing that cleared it were the caller, a click that goes nowhere -
    // a dead link, a cancelled route - would leave the bar running forever.
    expect(bar).toContain('navArrived()')
    expect(bar, 'the bar no longer watches the address').toContain('usePathname()')
    expect(bar, 'the panes under Settings and the Lender library are hash-driven,\n'
      + 'so for those the hash IS the address').toContain("addEventListener('hashchange'")
  })

  it('when a screen is swapped out mid-fetch', () => {
    // Press RBA rate notice, change your mind, press Products & policy. The
    // first pane unmounts with its fetch still in the air. Without the cleanup
    // its count stays behind and the bar runs until the next full reload.
    const fn = busy.slice(busy.indexOf('export function useBusyWhile'))
    expect(fn, 'useBusyWhile no longer gives its count back when it unmounts')
      .toMatch(/return \(\) => \{[\s\S]*dataCount = Math\.max\(0, dataCount - 1\)/)
  })

  it('counts screens rather than flipping a flag', () => {
    // Two panes can be fetching at once. With a boolean, the first to finish
    // switches the bar off while the second is still going.
    expect(busy).toContain('let dataCount = 0')
    expect(busy).not.toMatch(/let dataBusy = (true|false)/)
  })
})

describe('the mark runs, and does not move while it does', () => {
  it('draws the ring INSIDE the dot, not over it', () => {
    // 7 Oct 2026. The first version stroked a circle AT the dot's radius, which
    // puts half the stroke width outside it - over a filled disc that was still
    // there underneath. Fabio: "the spinning wheel, it's actually going over the
    // actual dot ... it just looks terrible."
    //
    // A stroke of width w centred on radius rr reaches rr + w/2. For that to
    // land exactly on the dot's edge, rr must be r - w/2. These two lines are
    // the whole of it, and nothing else may set the ring's radius.
    expect(mark, 'the ring no longer derives its width from the dot').toContain('const ringW = g.dot.r / 2')
    expect(mark, 'the ring is not inset by half its stroke, so it overflows the dot')
      .toContain('const ringR = g.dot.r - ringW / 2')

    const dot = mark.slice(mark.indexOf('{busy ? ('), mark.indexOf('</svg>'))
    expect(dot, 'the ring is drawn at some other radius').toContain('r={round3(ringR)}')
    expect(dot, 'a filled disc is back behind the ring. It shows through the hole\n'
      + 'in the middle, which is the thing that looked wrong.')
      .not.toMatch(/fill=\{DOT_COLOUR\}[^/]*\/>\s*<circle[^>]*fill="none"/)

    const centres = dot.match(/cx=\{round3\(g\.dot\.cx\)\} cy=\{round3\(g\.dot\.cy\)\}/g) || []
    expect(centres.length, 'the busy dot is drawn somewhere other than the still one')
      .toBeGreaterThanOrEqual(3)
  })

  it('is driven by whether anything is loading, not by a style choice', () => {
    expect(sidebar).toContain('busy={busy}')
    expect(sidebar).toContain('onBusyChange')
  })
})

// A RATCHET, NOT A RULE.
//
// Nine screens still answer with a line of text. That is fine - the bar covers
// all of them now, and the shapes go in as each page is rebuilt. What is not
// fine is the number going UP, which is how this crept across the portal in
// the first place.
describe('the bare "Loading..." line only ever goes away', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(n => {
      const full = join(dir, n)
      if (n === 'node_modules' || n === '.next' || n === '_to_delete') return []
      if (statSync(full).isDirectory()) return walk(full)
      return full.endsWith('.tsx') ? [full] : []
    })
  }

  it('is down to no screens and must not climb', () => {
    const bare = walk('app').concat(walk('components'))
      // The fault is WORDS where a shape or the mark should be, so this looks
      // for text sitting directly inside the element - not for any element at
      // all. Settlements wraps <Loading /> in a div to carry the page width,
      // which is the right answer, not the wrong one.
      .filter(f => /return <(p|div)[^>]*>[^<>]*Loading/.test(readFileSync(f, 'utf8')))
    expect(bare.length, 'a screen went back to answering "am I loading" with a\n'
      + 'line of grey text. components/Skeleton.tsx draws the shape instead -\n'
      + 'and if one of these was converted, lower the number here.\n'
      + bare.join('\n')).toBeLessThanOrEqual(0)
  })
})
