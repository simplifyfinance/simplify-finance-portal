// The Paper palette, with the contrast repaired.
//
// The old label grey (#A29889) sits at 2.6:1 on white — below the 4.5:1 floor
// where text stops being readable rather than merely looking soft. These are
// the replacements. Import them rather than typing a hex, so the next screen
// cannot quietly reintroduce the unreadable one.
export const TONE = {
  // NAMED, NOT SPELLED. These were hexes, which meant every screen built on
  // this palette stayed light-on-warm-grey when the portal went dark. A CSS
  // variable is the same colour in light and its counterpart in dark, and it
  // works in style={{}} where a Tailwind class cannot reach.
  ink:    'var(--color-ink)',
  body:   'var(--color-body)',
  label:  'var(--color-muted)',
  faint:  'var(--color-faint)',
  line:   'var(--color-line)',
  hair:   'var(--color-line-soft)',
  zebra:  'var(--color-page)',
  card:   'var(--color-card)',
  accent: 'var(--color-info)',
  accentSoft: 'var(--color-info-bg)',
  accentLine: 'var(--color-info-edge)',
  pos:    'var(--color-done)',
  neg:    'var(--color-chase)',
  // Needs an answer, not a loss. This was amber, which we banned - the middle
  // of every scale in the portal is the blue now.
  warn:   'var(--color-info)',
} as const

// Money, the way the mock reads it: a negative is -$144,316, never $-144,316,
// and a zero is shown as a greyed dash rather than set as though it mattered.
export function money(v: number | null | undefined): string {
  if (v === null || v === undefined || !isFinite(Number(v))) return '—'
  const n = Math.round(Number(v))
  if (n === 0) return '$0'
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-AU')
}
