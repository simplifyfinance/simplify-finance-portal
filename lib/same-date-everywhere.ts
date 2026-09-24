// ONE DATE, SPELLED THE SAME ON BOTH SIDES.
//
// 24 Sep 2026. Fabio settled a deal on staging and the prompt that asks about
// the client's position appeared and vanished, over and over, for hours. The
// console said:
//
//     Minified React error #418
//
// which is "the page the server drew and the page the browser drew are not the
// same". When React finds that, it throws the browser's whole page away and
// draws it again from scratch - and everything the page was holding in its head
// goes with it. Including the fact that it was showing a prompt.
//
// THE DIFFERENCE WAS ONE LETTER.
//
//     toLocaleDateString('en-AU', { day: '2-digit', month: 'short', ... })
//
// The server's copy of the world's date names and Chrome's copy disagree about
// the short form of exactly one month: one says "Sep", the other says "Sept".
// Every other month agrees. So a deal settled in September drew "24 Sep 2026"
// on one side and "24 Sept 2026" on the other, and the page tore itself up.
//
// It is why this started today and not a week ago: the settled date is only on
// the page once a deal is settled, and today was the first day anybody settled
// one.
//
// So a date shown on a page that is drawn twice is never asked of the operating
// system. It is spelled out here, the same way, everywhere, forever.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parts(value: any): { d: number; m: number; y: number } | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  // A plain yyyy-mm-dd is read as digits, never as a moment in time - `new
  // Date('2026-09-24')` is midnight UTC, which in Sydney is already the 24th
  // but in London is still the 23rd. The digits are what somebody typed.
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return { y: +iso[1], m: +iso[2] - 1, d: +iso[3] }
  const at = new Date(raw)
  if (!Number.isFinite(at.getTime())) return null
  return { y: at.getFullYear(), m: at.getMonth(), d: at.getDate() }
}

// "24 Sep 2026"
export function dayMonthYear(value: any): string {
  const p = parts(value)
  if (!p) return ''
  return `${String(p.d).padStart(2, '0')} ${MONTHS[p.m]} ${p.y}`
}

// "24 Sep" - for the rail along the top of a deal, where the year is noise.
// `pad` keeps whichever shape each place already had, so nothing on screen
// moves: some were asking for "05 Sep" and some for "5 Sep".
export function dayMonth(value: any, pad = true): string {
  const p = parts(value)
  if (!p) return ''
  return `${pad ? String(p.d).padStart(2, '0') : p.d} ${MONTHS[p.m]}`
}

// "24 September 2026", for a sentence rather than a label.
const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
              'August', 'September', 'October', 'November', 'December']

export function longDate(value: any): string {
  const p = parts(value)
  if (!p) return ''
  return `${p.d} ${FULL[p.m]} ${p.y}`
}

// "24 Sep, 3:45 pm" - a date AND a clock time, which is the harder case.
//
// A time is worse than a date. The server runs on UTC and the office is on
// Melbourne time, so the same instant is ten hours apart - the server drew one
// clock time and the browser drew another, on the compliance tab, on first
// paint. Same tear, same discarded page.
//
// So the clock is pinned to the office rather than to whichever machine is
// drawing. Two people on two laptops in two countries now read the same time on
// the same record, which is what anybody looking at a file actually wants.
// Only digits come from the operating system; the month is spelled here.
const MELBOURNE = 'Australia/Melbourne'

export function dayMonthTime(value: any): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const at = new Date(raw)
  if (!Number.isFinite(at.getTime())) return ''

  const bits: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat('en-GB', {
    timeZone: MELBOURNE, day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(at)) bits[p.type] = p.value

  const hour24 = Number(bits.hour)
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  const ampm = hour24 < 12 ? 'am' : 'pm'
  return `${Number(bits.day)} ${MONTHS[Number(bits.month) - 1]}, ${hour12}:${bits.minute} ${ampm}`
}
