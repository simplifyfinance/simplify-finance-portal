// The Paper palette, with the contrast repaired.
//
// The old label grey (#A29889) sits at 2.6:1 on white — below the 4.5:1 floor
// where text stops being readable rather than merely looking soft. These are
// the replacements. Import them rather than typing a hex, so the next screen
// cannot quietly reintroduce the unreadable one.
export const TONE = {
  ink:    '#221F1B',   // figures — near black
  body:   '#575046',   // body text, 7.2:1 on white
  label:  '#7A7266',   // labels and captions, 4.9:1 on white
  faint:  '#B3ABA0',   // genuinely decorative only — never a number that matters
  line:   '#E5DED2',
  hair:   '#EFEAE0',
  zebra:  '#FCFAF6',
  card:   '#FFFFFF',
  accent: '#0E8FCB',
  accentSoft: '#EAF6FD',
  accentLine: '#BFE2F5',
  pos:    '#1E7A4A',
  neg:    '#AD4227',
  // Needs an answer, not a loss. #B4761F was used by hand in several places and
  // measures 3.78:1 on white and 3.52:1 on its own amber chip - under the floor
  // this file exists to hold. This is the same hue taken down until it clears:
  // 5.32:1 on white, 4.96:1 on #FDF6EC.
  warn:   '#946017',
} as const

// Money, the way the mock reads it: a negative is -$144,316, never $-144,316,
// and a zero is shown as a greyed dash rather than set as though it mattered.
export function money(v: number | null | undefined): string {
  if (v === null || v === undefined || !isFinite(Number(v))) return '—'
  const n = Math.round(Number(v))
  if (n === 0) return '$0'
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-AU')
}
