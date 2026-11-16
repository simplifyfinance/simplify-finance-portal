// THE MORNING LIST.
//
// 17 Nov 2026, from the 6 November spec: "One screen with everything that needs
// somebody, across every deal. You should not have to open a file to find out
// it has gone quiet." Belle, asked what else it needed: "All good with the
// morning list screen, no need to add anything on my end."
//
// THREE KINDS OF THING, AND THEY ARE NOT THE SAME KIND OF THING.
//
//   A CHASE is a deal that has sat on one step longer than it should. Nobody
//   decided it was late; a clock did. It is the only one of the three that can
//   be cleared by somebody simply touching the deal.
//
//   DATED WORK falls due on a day, whatever anybody has or has not done. The
//   settlement numbers go a week out. The contribution is checked three days
//   out and again on the day. A date does not care that the file was opened
//   yesterday.
//
//   A CHECK-IN is owed a month after settlement. The deal is finished and the
//   relationship is not.
//
// NOTHING HERE IS A REVIEW REQUEST. Reviews are their own project - the single
// ask lives in the settled email until that exists. See docs/backlog.md.
//
// IT COUNTS NOTHING IT CANNOT NAME. Every row says which deal, what is wanted
// and how long it has been - because a list of counts is a list somebody has
// to go and investigate, which is the screen this one replaces.
import { stepOf, isOverdue, daysOnStep, STEP_LABEL, type Step } from './the-seven-steps'
import { settlementDate, isPurchase } from './settlement'
import { lastSent } from './milestone-emails'
import { type SettlementSettings } from './settlement-settings'
import { OFFICE } from './same-date-everywhere'

const txt = (v: any) => String(v ?? '').trim()

const DAY = 86400000

/**
 * A CALENDAR DATE IN SYDNEY, whatever the server thinks the time is.
 *
 * 17 Nov 2026. The first version did `new Date(raw + 'T00:00:00')` and
 * subtracted milliseconds, which reads the date in the MACHINE'S timezone. The
 * tests passed on a UTC container and failed on Fabio's Mac in Sydney: the same
 * deal was "settling today" for one and "settlement was 1 days ago" for the
 * other.
 *
 * That is not a test problem. Vercel runs UTC, so on a live deal between 11am
 * and midnight Sydney time the morning list would have had the day wrong -
 * including, on settlement day, the row that is supposed to lead the screen.
 *
 * A settlement date is a calendar date, not a moment. 28 November is 28
 * November in Sydney whoever is looking, so the comparison is done on calendar
 * dates and never on clock arithmetic.
 */
function sydneyYmd(v: any): string {
  const raw = txt(v)
  if (!raw) return ''
  // ALREADY A CALENDAR DATE. confirmed_settlement_date and
  // expected_settlement_date are date columns - putting them through a timezone
  // is what breaks them.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  // en-CA gives YYYY-MM-DD, which is the one common locale that does.
  return new Intl.DateTimeFormat('en-CA', { timeZone: OFFICE }).format(d)
}

/** Whole days between two calendar dates, read as plain dates. */
function between(fromYmd: string, toYmd: string): number | null {
  if (!fromYmd || !toYmd) return null
  const a = Date.parse(fromYmd + 'T00:00:00Z')
  const b = Date.parse(toYmd + 'T00:00:00Z')
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / DAY)
}

/** Whole days from a date to today. Negative where it is still ahead. */
function daysSince(iso: any, today: Date): number | null {
  return between(sydneyYmd(iso), sydneyYmd(today))
}

/** Whole days from today to an ISO date. Negative where it has passed. */
function daysUntil(iso: any, today: Date): number | null {
  const n = daysSince(iso, today)
  return n === null ? null : -n
}

export type MorningKind = 'chase' | 'dated' | 'checkin' | 'nodate'

export type MorningItem = {
  kind: MorningKind
  dealId: string
  dealName: string
  /** What is wanted, in the words somebody would use to ask for it. */
  words: string
  /** How long it has been, or when it is due. */
  since: string
  /**
   * Bigger is more urgent. Within a kind this is days late, so the oldest
   * leads - the spec says "deals past their chase time, oldest first".
   */
  sort: number
}

/** On the day itself, a shortfall leads everything on the screen. */
const ON_THE_DAY = 10000

/**
 * ONE DEAL, AND EVERYTHING IT OWES.
 *
 * A deal can appear more than once and should: a file that is both late on its
 * step AND owes a shortfall check is two jobs, and rolling them into one row
 * would mean doing one and losing the other.
 */
export function whatThisDealOwes(
  deal: any, s: SettlementSettings, today: Date = new Date(),
): MorningItem[] {
  const out: MorningItem[] = []
  const dealId = txt(deal?.id)
  const dealName = txt(deal?.deal_name) || 'Unnamed deal'
  const add = (kind: MorningKind, words: string, since: string, sort: number) =>
    out.push({ kind, dealId, dealName, words, since, sort })

  const step = stepOf(deal)
  const settled = txt(deal?.settled_at)

  if (step && !settled && isOverdue(deal, s.chase, today)) {
    const days = daysOnStep(deal, today)
    add('chase', `Nothing recorded on ${STEP_LABEL[step as Step]}`,
      `${days} business day${days === 1 ? '' : 's'} on this step`, days)
  }

  const on = settlementDate(deal)
  const until = daysUntil(on, today)

  if (!settled && until !== null) {
    // THE NUMBERS, A WEEK OUT. Only where they have not already gone - this is
    // a list of what is owed, not a list of what exists.
    if (until <= s.numbersDaysBefore && !lastSent(deal, 'settlement_numbers')) {
      add('dated', 'Settlement numbers have not gone out',
        until < 0 ? `settlement was ${-until} days ago`
          : until === 0 ? 'settling today' : `settling in ${until} days`,
        s.numbersDaysBefore - until)
    }

    // THE CONTRIBUTION, THREE DAYS OUT AND AGAIN ON THE DAY. A purchase only:
    // there is nothing for a refinancing client to bring.
    if (isPurchase(deal) && until <= s.shortfallDaysBefore && !txt(deal?.funds_to_complete_checked)) {
      add('dated', 'Funds to complete have not been checked',
        until === 0 ? 'settling today'
          : until < 0 ? `settlement was ${-until} days ago` : `settling in ${until} days`,
        // A SHORTFALL FOUND AT 3PM ON SETTLEMENT DAY is the worst phone call in
        // this business, so on the day it leads everything.
        until <= 0 ? ON_THE_DAY : s.shortfallDaysBefore - until)
    }
  }

  // --- approved, and in no month at all -----------------------------------
  //
  // 17 Nov 2026. The settlements band showed $2.2m for November against a
  // spreadsheet saying $24.2m. Nothing was broken: twelve deals were formally
  // approved, unsettled, and carried no settlement date of any kind - and a
  // deal with no date belongs to no month, so every one of them was invisible
  // to the total.
  //
  // Three of them had a date sitting in a spreadsheet cell and nowhere else.
  //
  // IT IS THE QUIETEST WAY TO LOSE MONEY ON A SCREEN. Nothing looks wrong. The
  // month is simply smaller than the business, and the only way anybody found
  // out was adding the spreadsheet up by hand. So it is named, every morning,
  // until somebody puts a date on it.
  if (!settled && txt(deal?.formal_approval_at) && !on) {
    add('nodate', 'Approved, but no settlement date',
      'it is in no month until there is one', 1)
  }

  if (settled) {
    const sinceSettled = daysSince(settled, today)
    if (sinceSettled !== null && sinceSettled >= s.checkInDaysAfter && !lastSent(deal, 'month_in')) {
      add('checkin', 'One month in call and email are owed',
        `settled ${sinceSettled} days ago`, sinceSettled)
    }
  }

  return out
}

/**
 * THE WHOLE LIST, IN THE ORDER IT IS WORKED.
 *
 * Dated work first, because a date cannot be moved. Then chases, oldest first.
 * Then the check-ins, which are the only ones that can wait a day without
 * costing anything.
 */
const KIND_ORDER: Record<MorningKind, number> = { dated: 0, nodate: 1, chase: 2, checkin: 3 }

export function morningList(
  deals: any[], s: SettlementSettings, today: Date = new Date(),
): MorningItem[] {
  const all = (deals || []).flatMap(d => whatThisDealOwes(d, s, today))
  return all.sort((a, b) =>
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.sort - a.sort
    || a.dealName.localeCompare(b.dealName))
}

/** "4 things need you this morning" / "Nothing needs you this morning". */
export function morningWords(items: MorningItem[]): string {
  const n = (items || []).length
  if (n === 0) return 'Nothing needs you this morning'
  return `${n} thing${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} you this morning`
}

export const KIND_HEADING: Record<MorningKind, string> = {
  dated: 'Due on a date',
  nodate: 'Approved with no settlement date',
  chase: 'Gone quiet',
  checkin: 'A month on',
}

/** The three groups, for a screen that draws them under their own headings. */
export function byKind(items: MorningItem[]): Record<MorningKind, MorningItem[]> {
  return {
    dated: items.filter(i => i.kind === 'dated'),
    nodate: items.filter(i => i.kind === 'nodate'),
    chase: items.filter(i => i.kind === 'chase'),
    checkin: items.filter(i => i.kind === 'checkin'),
  }
}
