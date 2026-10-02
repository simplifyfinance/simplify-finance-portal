import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import {
  CHOICES, DEFAULT_CHOICE, THEME_ATTRIBUTE, THEME_BOOT, THEME_KEY,
  isChoice, resolveTheme, type ThemeChoice,
} from './theme'

// THE RULE IS WRITTEN TWICE, SO SOMETHING HAS TO PROVE THEY AGREE.
//
// 2 Oct 2026. resolveTheme() is the rule in TypeScript. THEME_BOOT is the same
// rule in a string of JavaScript, because it has to run in the <head> before
// React exists or every dark-mode visitor gets a white flash on the way in.
//
// Two copies of one decision is exactly the fault behind nearly every bug we
// fixed in September. It is allowed to stand here only because this file runs
// both against the same cases and fails the ship the moment they disagree.

// Runs the real boot string in a tiny fake browser and reports what it wrote
// onto <html>. Nothing is mocked except the browser itself.
function runBoot(opts: { stored: string | null; osDark: boolean; storageThrows?: boolean }): string | undefined {
  const written: Record<string, string> = {}
  const localStorage = {
    getItem() {
      if (opts.storageThrows) throw new Error('private browsing')
      return opts.stored
    },
  }
  const win = { matchMedia: () => ({ matches: opts.osDark }) }
  const doc = {
    documentElement: {
      setAttribute(name: string, value: string) { written[name] = value },
    },
  }
  // eslint-disable-next-line no-new-func
  new Function('localStorage', 'window', 'document', THEME_BOOT)(localStorage, win, doc)
  return written[THEME_ATTRIBUTE]
}

describe('the choice is one of three, and auto is one of them', () => {
  it('offers light, dark and auto', () => {
    expect([...CHOICES]).toEqual(['light', 'dark', 'auto'])
  })

  it('starts on auto, so a new person gets whatever their Mac is doing', () => {
    expect(DEFAULT_CHOICE).toBe('auto')
  })

  it('recognises only those three', () => {
    for (const good of CHOICES) expect(isChoice(good)).toBe(true)
    for (const bad of ['Light', 'DARK', '', 'system', null, undefined, 1, {}]) {
      expect(isChoice(bad)).toBe(false)
    }
  })
})

describe('the rule itself', () => {
  it('honours a person who picked a side, whatever their Mac says', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('light', false)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('dark', true)).toBe('dark')
  })

  it('follows the Mac only when nobody has picked', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('auto', false)).toBe('light')
  })

  it('never answers "auto" - the stylesheet needs an answer, not a question', () => {
    for (const c of CHOICES) {
      for (const os of [true, false]) {
        expect(['light', 'dark']).toContain(resolveTheme(c, os))
      }
    }
  })
})

// ---------------------------------------------------------------------------

describe('the script that runs before the page paints says the same thing', () => {
  // EVERY COMBINATION, BOTH IMPLEMENTATIONS, SAME ANSWER.
  const CASES: { stored: string | null; osDark: boolean }[] = []
  for (const stored of ['light', 'dark', 'auto', null, '', 'nonsense'] as (string | null)[]) {
    for (const osDark of [true, false]) CASES.push({ stored, osDark })
  }

  it.each(CASES)('stored %o', ({ stored, osDark }) => {
    const choice: ThemeChoice = isChoice(stored) ? stored : DEFAULT_CHOICE
    expect(runBoot({ stored, osDark })).toBe(resolveTheme(choice, osDark))
  })

  it('reads the same storage key the rest of the portal writes', () => {
    expect(THEME_BOOT).toContain(JSON.stringify(THEME_KEY))
  })

  it('writes the same attribute the stylesheet reads', () => {
    expect(THEME_BOOT).toContain(JSON.stringify(THEME_ATTRIBUTE))
    const css = readFileSync('app/globals.css', 'utf8')
    expect(css).toContain(`[${THEME_ATTRIBUTE}="dark"]`)
  })

  // A sign-in screen that throws is a sign-in screen nobody can work around.
  it('still picks a theme when the browser refuses to let it read storage', () => {
    expect(runBoot({ stored: 'dark', osDark: true, storageThrows: true })).toBe('light')
  })

  it('is small enough to belong in the head', () => {
    expect(THEME_BOOT.length).toBeLessThan(500)
  })
})

describe('it is actually wired into the page', () => {
  it('the root layout runs the boot script', () => {
    const src = readFileSync('app/layout.tsx', 'utf8')
    expect(src).toContain('THEME_BOOT')
    // Without this React logs a mismatch on every single page load, because the
    // script changes <html> before React gets there.
    expect(src).toContain('suppressHydrationWarning')
  })

  it('the login screen offers the switch', () => {
    expect(readFileSync('app/login/page.tsx', 'utf8')).toContain('<ThemeSwitch')
  })

  // Tailwind's dark: variant watches the operating system by default, which
  // would ignore somebody who chose light on a dark Mac. If this line goes, the
  // switch and the colours stop agreeing on screens that use dark:.
  it('the dark: variant follows the switch rather than the operating system', () => {
    const css = readFileSync('app/globals.css', 'utf8')
    expect(css).toMatch(/@custom-variant\s+dark\s*\([^)]*data-theme="dark"/)
  })
})

// ---------------------------------------------------------------- the gate

describe('one place decides the theme', () => {
  const ALLOWED = new Set([
    join('lib', 'theme.ts'),
    join('lib', 'theme.test.ts'),
    join('components', 'ThemeSwitch.tsx'),
    join('app', 'layout.tsx'),
    // Reads the dark block out of globals.css by name to check it against
    // lib/colours.ts. It names the attribute in order to find it, which is the
    // opposite of setting it behind everyone's back.
    join('lib', 'colours.test.ts'),
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

  it('nobody else writes the theme attribute by hand', () => {
    const found = files
      .filter(f => !ALLOWED.has(f))
      .filter(f => readFileSync(f, 'utf8').includes(THEME_ATTRIBUTE))
    expect(found, 'these set the theme themselves - go through lib/theme.ts').toEqual([])
  })

  it('nobody else reaches for the remembered choice by hand', () => {
    const found = files
      .filter(f => !ALLOWED.has(f))
      .filter(f => readFileSync(f, 'utf8').includes(`'${THEME_KEY}'`) || readFileSync(f, 'utf8').includes(`"${THEME_KEY}"`))
    expect(found, 'these read the stored choice themselves - go through lib/theme.ts').toEqual([])
  })
})
