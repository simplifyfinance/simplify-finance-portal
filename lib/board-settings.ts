// Everything the deal board lets you change, and the reading of it.
//
// Two separate things live here because they are saved together and read
// together, and splitting them would mean two loaders on every screen that
// draws a card:
//
//   1. the colour of each label chip
//   2. how many business days a column may sit before it goes amber, then red
//
// The board and the grouped list have always ACCEPTED both - DealBoard takes a
// `colours` prop and stageAge/ageGroupOf take a thresholds argument - and
// nothing has ever passed them anything. So every colour on the board today is
// guessed from the letters of a broker key, and every threshold is the constant
// in lib/deal-age.ts. This file is what finally gets handed in.
//
// Nothing here is authoritative on its own: a portal with an empty
// settings.deal_board behaves EXACTLY as it does today, because every read falls
// back to the same defaults the code already used.

import { DEFAULT_THRESHOLDS } from './deal-age'
import { TYPE_COLOUR, USE_COLOUR, type TypeId, type UseId } from './deal-labels'
import { type Phase } from './deal-phase'

// The columns that can go stale. Settled and lost are off the clock by
// definition - ageGroupOf answers "settled" and "lost" before it ever looks at a
// threshold - so putting numbers against them in Settings would be a box that
// does nothing.
export const AGED_PHASES: Phase[] = [
  'fact_find', 'bc', 'lo', 'compliance', 'compliance_sent',
  'lodged', 'preapproved', 'offer_accepted', 'formal',
  'contracts_returned', 'settlement_booked',
]

export type Threshold = { long: number; nudge: number }
export type ThresholdMap = Partial<Record<Phase, Threshold>>

export type BoardSettings = {
  type: Partial<Record<TypeId, string>>
  use: Partial<Record<UseId, string>>
  thresholds: ThresholdMap
}

// Ten to pick from. Every one is dark enough to carry white initials at 19px,
// and far enough from its neighbours to be told apart on a card the size of a
// business card. Someone who wants a colour outside this list types a hex.
export const SWATCHES = [
  '#3B5BA5', '#0E6FA0', '#0F6E6E', '#1E7A4A', '#946017',
  '#B25A33', '#A3376B', '#5B4B8A', '#7A2E2E', '#4A4A4A',
]

// The credit officer's avatar. Deliberately one grey for everybody: colour on a
// card answers ONE question - whose deal is this - and giving credit officers
// their own palette would put two colour languages on the same card.
// Fabio, 1 Sep 2026: "credit is grey broker with colour".
export const CREDIT_GREY = '#7A7266'

const HEX = /^#[0-9a-f]{6}$/i

export function isHex(v: any): boolean {
  return typeof v === 'string' && HEX.test(v.trim())
}

export function normHex(v: any): string | null {
  return isHex(v) ? String(v).trim().toUpperCase() : null
}

// --- the contrast guard -----------------------------------------------------
// A broker's colour is a filled circle with white letters on it. A pale one
// makes the initials vanish, so the box says so. It warns; it does not block -
// the same 4.5:1 floor the rest of the portal holds text to.

function channel(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function luminance(hex: string): number {
  const h = normHex(hex)
  if (!h) return 0
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05)
}

// True when white initials on this colour would fall below 4.5:1.
export function tooPaleForWhiteText(hex: string): boolean {
  if (!normHex(hex)) return false      // an unfinished hex is not yet wrong
  return contrastWithWhite(hex) < 4.5
}

// --- reading what was saved -------------------------------------------------

function readColours<K extends string>(raw: any, defaults: Record<string, string>): Partial<Record<K, string>> {
  const out: any = {}
  if (!raw || typeof raw !== 'object') return out
  for (const k of Object.keys(defaults)) {
    if (k === 'unknown') continue        // there is no chip for unknown, so no colour to set
    const v = normHex(raw[k])
    // Only a real change is stored. Saving the default back would freeze it:
    // change the default in code later and every portal would still show the old
    // one because it had been written down as if someone had chosen it.
    if (v && v !== String(defaults[k]).toUpperCase()) out[k] = v
  }
  return out
}

function readNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!isFinite(n) || n < 0) return null
  return Math.round(n)
}

// The saved thresholds are merged OVER the defaults, and a phase written as null
// (or with either box left empty) means "stop ageing this column" - not "use the
// default". That is the only way to switch one off, and Formal ships switched
// off.
export function readThresholds(raw: any): ThresholdMap {
  const out: any = { ...(DEFAULT_THRESHOLDS as any) }
  const t = raw && typeof raw === 'object' ? raw.thresholds : null
  if (!t || typeof t !== 'object') return out
  for (const p of AGED_PHASES) {
    if (!(p in t)) continue
    const long = readNum(t[p]?.long)
    const nudge = readNum(t[p]?.nudge)
    if (long === null || nudge === null) { delete out[p]; continue }
    // Red can never arrive before amber. Someone typing 5 and 3 means 5 then 5,
    // not a card that turns red and then back to amber a day later.
    out[p] = { long, nudge: Math.max(nudge, long) }
  }
  return out
}

export function readBoardSettings(raw: any): BoardSettings {
  return {
    type: readColours<TypeId>(raw?.type, TYPE_COLOUR),
    use: readColours<UseId>(raw?.use, USE_COLOUR),
    thresholds: readThresholds(raw),
  }
}

// --- what the Settings screen edits ----------------------------------------
// The editor works in strings, because a half-typed hex and an empty day box are
// both legal mid-edit. This turns the screen's state into the thing we save.

export type ThresholdDraft = Partial<Record<Phase, { long: string; nudge: string }>>

export function draftFromThresholds(t: ThresholdMap): ThresholdDraft {
  const out: any = {}
  for (const p of AGED_PHASES) {
    const v = (t as any)[p]
    out[p] = v ? { long: String(v.long), nudge: String(v.nudge) } : { long: '', nudge: '' }
  }
  return out
}

export function thresholdsFromDraft(d: ThresholdDraft): Record<string, Threshold | null> {
  const out: Record<string, Threshold | null> = {}
  for (const p of AGED_PHASES) {
    const v = (d as any)[p]
    const long = readNum(v?.long)
    const nudge = readNum(v?.nudge)
    // Written explicitly as null so readThresholds knows this column was turned
    // off on purpose, rather than never configured.
    out[p] = long === null || nudge === null ? null : { long, nudge: Math.max(nudge, long) }
  }
  return out
}

// What the whole pane hands back to be written to settings.deal_board.
export function boardSettingsToSave(
  type: Record<string, string>,
  use: Record<string, string>,
  draft: ThresholdDraft,
): any {
  const clean = (src: Record<string, string>, defaults: Record<string, string>) => {
    const out: Record<string, string> = {}
    for (const k of Object.keys(defaults)) {
      if (k === 'unknown') continue
      const v = normHex(src?.[k])
      if (v && v !== String(defaults[k]).toUpperCase()) out[k] = v
    }
    return out
  }
  return {
    type: clean(type, TYPE_COLOUR),
    use: clean(use, USE_COLOUR),
    thresholds: thresholdsFromDraft(draft),
  }
}

// A broker with no colour of their own is not an error - the board has always
// worked without one, and lib/deal-labels.ts still answers with a stable guess.
export function brokerColourMap(rows: any[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows || []) {
    const key = String(r?.broker_key || '').trim().toLowerCase()
    const col = normHex(r?.colour)
    if (key && col) out[key] = col
  }
  return out
}

// Plain English for the thresholds table. Not decoration: the number only makes
// sense if you know who you are waiting on, and "3 days" means something very
// different at Fact find than at Compliance sent.
export const WAITING_ON: Partial<Record<Phase, string>> = {
  fact_find:       'The client, to send documents. Slow is normal.',
  bc:              'Us, to run the numbers.',
  lo:              'The client, to pick an option.',
  compliance:      'Us, to write it up.',
  compliance_sent: 'Support, to move the SalesTrekker card. Should be quick.',
  lodged:          'The lender, to acknowledge the file.',
  preapproved:     'The client, to find a property. Months, not days.',
  offer_accepted:  'The lender, to turn an accepted offer into a formal approval.',
  formal:          'Governed by the settlement date, not by sitting still.',
  contracts_returned: 'The settlement date decides this one, not the clock.',
  settlement_booked:  'Booked. Waiting for the day itself.',
}
