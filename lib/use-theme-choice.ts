'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowser } from './supabase-browser'
import {
  applyTheme, chooseTheme, isChoice, prefersDark, readChoice, resolveTheme, writeChoice,
  type Theme, type ThemeChoice,
} from './theme'

// THE THEME THIS PERSON PICKED, remembered against their login.
//
// 6 Oct 2026. Same shape as useBoardFilters beside it, and for the same reason:
// a theme is one person's view of their own screen, never a setting. Fabio:
// "Browser-only today, so your team loses it on another machine."
//
// THREE STEPS, IN THIS ORDER, AND THE ORDER IS THE WHOLE DESIGN:
//
//   1. The script in lib/theme.ts has ALREADY painted the page from the
//      browser's own storage, before React existed. Nothing involving a network
//      can beat a paint, and trying is how a dark mode ends up flashing white.
//   2. This reads theme_choice off the profile. If it disagrees with what the
//      browser said - because the last pick happened on another machine - the
//      theme moves now, and the browser is corrected, so the next load on THIS
//      machine is right immediately rather than a beat late.
//   3. A pick changes the screen first and writes second.
//
// THE WRITE IS FIRE AND FORGET, exactly as the board filters are. A refused
// write leaves the theme right for this session and forgotten at the next sign
// in, which is no worse than today. Blocking a click on a round trip, or
// throwing a banner across the portal because a preference did not save, would
// both be worse than that.
//
// BEFORE THE COLUMN EXISTS this does nothing at all: the read comes back empty,
// nothing is applied, and the portal behaves exactly as it does today. No
// screen may break because a migration has not been run yet.
export function useThemeChoice(onChange?: (theme: Theme) => void) {
  const [choice, setChoice] = useState<ThemeChoice | null>(null)
  const userId = useRef<string | null>(null)

  // Held in a ref so the effect below does not re-run every time the component
  // that owns the callback re-renders. Re-running would re-read the profile and
  // could move the theme out from under somebody who had just picked.
  const told = useRef(onChange)
  told.current = onChange

  useEffect(() => {
    let alive = true

    // What the browser said, which is already what is on the screen.
    const here = readChoice()
    setChoice(here)
    told.current?.(resolveTheme(here, prefersDark()))

    const supabase = createSupabaseBrowser()
    supabase.auth.getUser().then(({ data }) => {
      const id = data?.user?.id || null
      userId.current = id
      // THE SIGN-IN SCREEN. Nobody is signed in, so there is nobody to look a
      // theme up against. It follows the computer, and that is correct rather
      // than a gap.
      if (!id) return
      supabase.from('user_profiles').select('theme_choice').eq('id', id).maybeSingle()
        .then(({ data: row }: any) => {
          if (!alive) return
          const saved = row?.theme_choice
          // Checked into shape rather than trusted - a column holding anything
          // other than light, dark or auto is ignored, not applied.
          if (!isChoice(saved) || saved === here) return
          setChoice(saved)
          writeChoice(saved)
          told.current?.(applyTheme(resolveTheme(saved, prefersDark())))
        })
    })

    return () => { alive = false }
  }, [])

  // THE THEME IS CHANGED FIRST, AND TELLING ANYBODY COMES SECOND.
  //
  // 5 Oct 2026, and this is why dark mode never worked. The switch used to read
  //
  //     onChange   ?.   ( chooseTheme(next) )      <- spaced out on purpose, so
  //                                                   the guard in
  //                                                   lib/theme.test.ts does
  //                                                   not match this comment
  //
  // and `a?.(b())` does not call b() when a is undefined - optional chaining
  // skips the whole call, arguments and all. Neither the sign-in screen nor the
  // sidebar passes onChange, so chooseTheme was NEVER CALLED on either. The
  // button lit up, because the state above it had already changed, and nothing
  // else on the page moved. Fabio spent an afternoon on it: "the button is
  // there but when I click nothing happnes".
  //
  // So: one line changes the theme, the next line tells anybody who asked, and
  // lib/theme.test.ts fails the ship if they are ever folded together again.
  const pick = useCallback((next: ThemeChoice) => {
    setChoice(next)
    const theme = chooseTheme(next)
    told.current?.(theme)

    const id = userId.current
    if (id) {
      // fire-and-forget: a theme is not a record of anything. If this write is
      // refused the screen is already the colour they asked for, and it is
      // forgotten at the next sign in - which is exactly where this started.
      // Blocking the click on a round trip, or throwing a banner across the
      // portal because a preference did not save, would both be worse than the
      // thing they protect against. Same reasoning, same words, as the board
      // filters in lib/use-board-filters.ts.
      createSupabaseBrowser().from('user_profiles')
        .update({ theme_choice: next }).eq('id', id).then(() => {})
    }
    return theme
  }, [])

  return { choice, pick }
}
