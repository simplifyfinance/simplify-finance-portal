// EVERY NUMBER IN THE SETTLEMENTS PROCESS, IN ONE PLACE SOMEBODY CAN CHANGE.
//
// 17 Nov 2026. Fabio, on the chase times: "let's build a whole section in
// settings that these all can be changed as we see fit. Again, this is going to
// be a test and trial and error."
//
// He is right, and the reason is worth writing down. Every one of these numbers
// is a guess until Julian and Belle have run a month on them, and a guess that
// needs a ship to change is a guess nobody adjusts. Two days on Outstandings
// might be one. Five on Pending Booking might be eight over Christmas. This way
// they say so and he changes it before the next deal lands.
//
// NOTHING HERE IS AUTHORITATIVE ON ITS OWN. An empty settings.settlements
// behaves EXACTLY as the portal would with no settings page at all, because
// every read falls back to the default beside it - the same discipline
// lib/board-settings.ts already follows for the deal board's columns.
import { DEFAULT_CHASE, STEPS, type Step } from './the-seven-steps'

export type SettlementSettings = {
  /** How long each step may sit, in business days. null is never chased. */
  chase: Record<Step, number | null>
  /** The settlement numbers email goes this many days before settlement. */
  numbersDaysBefore: number
  /** The contribution shortfall is checked this many days before, and again on the day. */
  shortfallDaysBefore: number
  /** The month-in call and the four checks. */
  checkInDaysAfter: number
  /** The review request, this many days after the check-in. */
  reviewDaysAfter: number
  /** Nothing recorded against the deal for this many business days. */
  quietBusinessDays: number
  /** The deal is this close to its settlement date. */
  settlingSoonDays: number
  /** On a purchase, funds not checked this close to settling. */
  fundsToCompleteDays: number
}

/**
 * THE DEFAULTS, AND WHERE EACH ONE CAME FROM.
 *
 * The chase times are DEFAULT_CHASE in lib/the-seven-steps.ts, which carries the
 * argument between Julian and Belle that settled them. The last three already
 * existed as ATTENTION in lib/settlement.ts and already ran; they are listed
 * here because they are the same kind of number and nobody should have to
 * remember which screen a day lives behind.
 */
export const SETTLEMENT_DEFAULTS: SettlementSettings = {
  chase: { ...DEFAULT_CHASE },
  numbersDaysBefore: 7,
  shortfallDaysBefore: 3,
  checkInDaysAfter: 30,
  reviewDaysAfter: 3,
  quietBusinessDays: 10,
  settlingSoonDays: 5,
  fundsToCompleteDays: 5,
}

/**
 * A NUMBER SOMEBODY TYPED, OR THE DEFAULT.
 *
 * Nought is a real answer and is kept - "chase it the same day" is a thing
 * somebody might genuinely want. A negative, a fraction, a word or a blank is
 * not an answer, and falls back rather than being rounded into one.
 */
function days(v: any, fallback: number): number {
  if (v === null || v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= 999 ? n : fallback
}

/** A chase time, which may also be switched off entirely. */
function chaseDays(v: any, fallback: number | null): number | null {
  if (v === null) return null
  if (v === undefined || v === '') return fallback
  if (v === false || v === 'off' || v === 'never') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= 999 ? n : fallback
}

/**
 * WHAT THE PORTAL SHOULD USE, from whatever is on settings.settlements.
 *
 * Handed null, nonsense, or a half-filled object, it returns a complete set of
 * numbers. No screen reading this ever has to ask whether the settings page has
 * been opened.
 */
export function settlementSettings(raw: any): SettlementSettings {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const rawChase = r.chase && typeof r.chase === 'object' && !Array.isArray(r.chase) ? r.chase : {}
  const chase = {} as Record<Step, number | null>
  for (const s of STEPS) chase[s] = chaseDays(rawChase[s], DEFAULT_CHASE[s])
  return {
    chase,
    numbersDaysBefore: days(r.numbersDaysBefore, SETTLEMENT_DEFAULTS.numbersDaysBefore),
    shortfallDaysBefore: days(r.shortfallDaysBefore, SETTLEMENT_DEFAULTS.shortfallDaysBefore),
    checkInDaysAfter: days(r.checkInDaysAfter, SETTLEMENT_DEFAULTS.checkInDaysAfter),
    reviewDaysAfter: days(r.reviewDaysAfter, SETTLEMENT_DEFAULTS.reviewDaysAfter),
    quietBusinessDays: days(r.quietBusinessDays, SETTLEMENT_DEFAULTS.quietBusinessDays),
    settlingSoonDays: days(r.settlingSoonDays, SETTLEMENT_DEFAULTS.settlingSoonDays),
    fundsToCompleteDays: days(r.fundsToCompleteDays, SETTLEMENT_DEFAULTS.fundsToCompleteDays),
  }
}

/** Is this setting still the default? For "back to default" on the page. */
export function isDefault(s: SettlementSettings): boolean {
  return JSON.stringify(s) === JSON.stringify(SETTLEMENT_DEFAULTS)
}
