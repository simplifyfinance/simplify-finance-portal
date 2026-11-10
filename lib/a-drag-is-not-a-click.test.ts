// A DRAG THAT ENDS OUTSIDE A DIALOG IS NOT A CLICK OUTSIDE IT.
//
// 10 Nov 2026. Fabio's team, on the milestone send screen: "if I highlight
// what is on the box 'anything else' and press ctrl C to copy, the data
// disappears."
//
// Ctrl+C was innocent. Selecting text and letting go a few pixels past the
// edge of the panel makes the browser fire ONE click on the nearest element
// containing both ends of the drag - the backdrop - so the panel's own
// stopPropagation never runs and the screen closes with everything typed in
// it. Worst in the one box people drag in.
//
// Nothing about this is specific to that screen, which is why it is a rule
// rather than a fix in two files.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

const FILES = [...walk('app'), ...walk('components')]

describe('closing is something somebody means to do', () => {
  it('no full-screen backdrop closes on a bare click', () => {
    const bad: string[] = []
    for (const f of FILES) {
      const src = readFileSync(f, 'utf8')
      // The backdrop and its handler are on the same element, so they land
      // within a line or two of each other.
      const lines = src.split('\n')
      lines.forEach((line, i) => {
        if (!line.includes('fixed inset-0')) return
        const near = lines.slice(i, i + 4).join(' ')
        if (/onClick=\{\s*(onClose|\(\)\s*=>\s*(setOpen\(|onClose))/.test(near)) {
          bad.push(`${f}:${i + 1}`)
        }
      })
    }
    expect(bad,
      'these close on any click that ENDS on the backdrop, including the end of a '
      + 'text selection dragged out of a box. Use useBackdropClose(onClose) instead:\n  '
      + bad.join('\n  ')).toEqual([])
  })

  // A test that cannot find what it is checking passes for ever.
  it('and the hook it points at is still there', () => {
    const hook = readFileSync('components/useBackdropClose.ts', 'utf8')
    expect(hook).toContain('export function useBackdropClose')
    // Both ends, or it is not a fix.
    expect(hook).toContain('onMouseDown')
    expect(hook).toContain('e.target === e.currentTarget')
  })

  it('and the two send screens use it', () => {
    for (const f of ['components/MilestoneEmails.tsx', 'components/MilestoneFromTemplates.tsx']) {
      expect(readFileSync(f, 'utf8'), `${f} no longer guards its backdrop`)
        .toContain('useBackdropClose(onClose)')
    }
  })
})
