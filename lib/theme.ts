// LIGHT, DARK, OR WHATEVER THE MAC IS DOING.
//
// 2 Oct 2026. One home for the choice, so the login screen, the portal and the
// script that runs before the page paints cannot disagree about which theme is
// on. The answer is always written in one place - the data-theme attribute on
// <html> - and lib/colours.ts and app/globals.css take it from there.
//
// NOTHING HERE TOUCHES REACT. It is plain functions so the maths tests can read
// it without a browser, and so the boot script below can be a string.

export type ThemeChoice = 'light' | 'dark' | 'auto'
export type Theme = 'light' | 'dark'

/** What the person picked. 'auto' is a choice too, not the absence of one. */
export const CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'auto'] as const

/** Where it is remembered. Named once; the boot script below reads this. */
export const THEME_KEY = 'one-theme'

/** Until somebody picks a side, follow the Mac. */
export const DEFAULT_CHOICE: ThemeChoice = 'auto'

/** Written on <html>. Always 'light' or 'dark' - never 'auto', because the
 *  stylesheet has to be told an answer rather than a question. */
export const THEME_ATTRIBUTE = 'data-theme'

export function isChoice(v: unknown): v is ThemeChoice {
  return typeof v === 'string' && (CHOICES as readonly string[]).includes(v)
}

/** The whole decision, in one line, testable without a browser. */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  if (choice === 'light' || choice === 'dark') return choice
  return prefersDark ? 'dark' : 'light'
}

// ------------------------------------------------------- reading and writing
//
// Every one of these is wrapped. A browser in private mode throws on the first
// touch of localStorage, and an exception here would take the sign-in screen
// down with it - which is the one screen nobody can work around.

export function readChoice(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(THEME_KEY)
    return isChoice(v) ? v : DEFAULT_CHOICE
  } catch {
    return DEFAULT_CHOICE
  }
}

export function writeChoice(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_KEY, choice)
  } catch {
    // Remembering failed. The theme still changes for this visit, which is
    // better than refusing to change at all.
  }
}

export function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** Put the answer on <html>, and hand it back. */
export function applyTheme(theme: Theme): Theme {
  try {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme)
  } catch {
    // Server, or no document. Nothing to paint.
  }
  return theme
}

/** Pick, remember, and paint - the thing the switch calls. */
export function chooseTheme(choice: ThemeChoice): Theme {
  writeChoice(choice)
  return applyTheme(resolveTheme(choice, prefersDark()))
}

// ------------------------------------------------------------- the boot line
//
// WHY THIS IS A STRING OF JAVASCRIPT AND NOT A COMPONENT.
//
// React runs after the browser has already painted. If the theme were decided
// in a component, every dark-mode visitor would see a white flash first - the
// one thing that makes a dark mode feel broken rather than dark.
//
// So this runs in the <head>, before anything is drawn. It is deliberately
// tiny, has no dependencies, and cannot throw: if localStorage is unavailable
// it falls back to light rather than leaving the page with no theme at all.
//
// It duplicates the resolve rule above in miniature, which is the one piece of
// duplication in this file - so lib/theme.test.ts runs this exact string
// against the same cases as resolveTheme and fails the ship if they disagree.
export const THEME_BOOT =
  `(function(){try{` +
  `var c=localStorage.getItem(${JSON.stringify(THEME_KEY)});` +
  `if(c!=='light'&&c!=='dark'){` +
  `c=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}` +
  `document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},c);` +
  `}catch(e){document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},'light');}})()`
