'use client'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import {
  chooseTheme, prefersDark, readChoice, resolveTheme, applyTheme,
  type Theme, type ThemeChoice,
} from '@/lib/theme'

// SUN, MOON, AND A FOR AUTO.
//
// 2 Oct 2026. Three buttons rather than one toggle, because a toggle can only
// say light or dark - it has no way to say "whatever my Mac is doing", which is
// what most people actually want and is what this starts on.
//
// It renders with nothing selected on the first pass and fills in once it is in
// a browser. That is deliberate: the choice lives in the browser's own storage,
// which does not exist while the page is being built on the server, and
// pretending otherwise is how a page ends up rendering one thing and correcting
// itself a moment later.
//
// The theme itself is already correct before this component exists - the script
// in lib/theme.ts puts it on <html> before anything is painted. This only moves
// it afterwards.

type Props = {
  /** Told when the theme actually changes, for anything that cannot be done in
   *  CSS - the mark's artwork has two tones and has to be given the right one. */
  onChange?: (theme: Theme) => void
  className?: string
  /** Where it is standing. The sidebar is near-black in BOTH themes, so the
   *  page's own card-and-line colours would draw a white box on it. Stated
   *  rather than guessed from the theme, because the sidebar does not change
   *  when the theme does. */
  tone?: 'page' | 'sidebar'
}

const OPTIONS: { choice: ThemeChoice; label: string; title: string }[] = [
  { choice: 'light', label: 'Light', title: 'Always light' },
  { choice: 'dark',  label: 'Dark',  title: 'Always dark' },
  { choice: 'auto',  label: 'Auto',  title: 'Match my computer' },
]

export default function ThemeSwitch({ onChange, className, tone = 'page' }: Props) {
  const [choice, setChoice] = useState<ThemeChoice | null>(null)

  useEffect(() => {
    const now = readChoice()
    setChoice(now)
    onChange?.(resolveTheme(now, prefersDark()))

    // ON AUTO, THE MAC CAN CHANGE ITS MIND WHILE THE PAGE IS OPEN - at sunset,
    // or when somebody flips it in System Settings. Without this the portal
    // would stay on whichever theme it happened to start in.
    let media: MediaQueryList | null = null
    const follow = () => {
      if (readChoice() !== 'auto') return
      onChange?.(applyTheme(resolveTheme('auto', prefersDark())))
    }
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)')
      media.addEventListener('change', follow)
    } catch {
      media = null
    }
    return () => { try { media?.removeEventListener('change', follow) } catch { /* gone already */ } }
  }, [])

  function pick(next: ThemeChoice) {
    setChoice(next)
    onChange?.(chooseTheme(next))
  }

  return (
    <div
      role="group"
      aria-label="Appearance"
      className={`inline-flex items-center gap-[2px] rounded-[9px] border p-[2px] ${
        tone === 'sidebar' ? 'border-white/10 bg-white/5' : 'border-line bg-card'
      } ${className || ''}`}
    >
      {OPTIONS.map(o => {
        const on = choice === o.choice
        return (
          <button
            key={o.choice}
            type="button"
            onClick={() => pick(o.choice)}
            aria-pressed={on}
            title={o.title}
            className={`flex items-center gap-1 rounded-[7px] px-2 py-1 text-[11px] font-semibold transition-colors ${
              on
                ? (tone === 'sidebar' ? 'bg-brand/20 text-brand' : 'bg-brand/15 text-brand-ink')
                : (tone === 'sidebar' ? 'text-white/45 hover:text-white/80' : 'text-muted hover:text-body')
            }`}
          >
            {o.choice === 'light' && <Sun size={12} aria-hidden />}
            {o.choice === 'dark' && <Moon size={12} aria-hidden />}
            {o.choice === 'auto' && <span aria-hidden className="w-3 text-center leading-none">A</span>}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
