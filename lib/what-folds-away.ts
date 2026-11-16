// A FOLD IS STILL A BOX. IT IS JUST A CLOSED ONE.
//
// 17 Nov 2026. Fabio, looking at a deal: "just finding the deal cards too
// busy... also the purple section is there a way we can make it expandable so
// we only see when we want to?"
//
// Three tall coloured slabs sat above the work on every deal - the handover
// note from credit, who shares the deal, and the questions going out with the
// email - and the first two are read once while the third is read never, once
// all of its questions have gone.
//
// WHAT CHANGED, AND WHAT DID NOT. Each becomes ONE LINE in the colour it
// already had. Fabio, on a first attempt that made them all plain: "I think
// you went too far in terms of blending... I do like, for example, lending
// options and doing this. It's all blue and then sent to the client. I don't
// have an issue with that being green."
//
// So nothing is quietened. The headline, the count and the age stay on screen,
// and pressing Show gives back exactly the block that is there today - not a
// smaller version of it. Folding changes how TALL a deal is, never what is in
// it.
//
// ---------------------------------------------------------------------------
// AND A FOLD MUST NEVER HIDE SOMETHING NOBODY HAS SEEN
// ---------------------------------------------------------------------------
//
// That is the one way this could do harm, so each fold opens itself. The rules
// are below, in questionsStartOpen() and noteStartsOpen(), and they are all
// worked out from what is already on the deal - nothing new is stored, and
// there is no "have you read this" flag to go stale.
import { daysSince, shortDate, markFor, type Question, type Closed } from './what-we-still-need'

/** Days a thing stays open by itself after it happens. */
export const STILL_NEW = 2

const txt = (v: any) => String(v ?? '').trim()

/**
 * THE FIRST FEW WORDS, CUT ON A WORD.
 *
 * A fold line that ends mid-word reads as a bug. Nothing is cut at all when it
 * already fits.
 */
export function firstWords(text: any, max = 64): string {
  const all = txt(text).replace(/\s+/g, ' ')
  if (all.length <= max) return all
  const cut = all.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—-]+$/, '')}…`
}

/** "15 Oct 2026 · “Re-checked servicing and apart from AMP…”" */
export function noteFoldLine(row: any): string {
  const when = shortDate(row?.created_at)
  const note = firstWords(row?.note, 64)
  const said = note ? `“${note}”` : ''
  return [when, said].filter(Boolean).join(' · ')
}

/**
 * A HANDOVER NOTE OPENS BY ITSELF WHILE IT IS NEW.
 *
 * Credit writes it, the broker reads it that day, and after that it is a
 * record. The newest one is open for two days and everything older is folded,
 * which needs nothing stored: a "read" flag would be one more thing to get
 * wrong and one more write on a page that already has enough.
 */
export function noteStartsOpen(createdAt: any, newest: boolean, today = new Date()): boolean {
  if (!newest) return false
  const d = daysSince(createdAt, today)
  // A note with no date on it is shown. An unreadable date is not a reason to
  // hide what somebody wrote.
  return d === null || d < STILL_NEW
}

/**
 * THE QUESTIONS, IN ONE LINE.
 *
 * Everything somebody would have opened the block to find out: how many are
 * going, when they went, how long ago, and whether anybody answered.
 */
export function questionsFoldLine(
  deal: any, open: Question[], closed: Closed[], today = new Date(),
): string {
  // THROUGH markFor(), never by reaching into the column. The marks live on
  // deal.questions_state and one place in this repo is allowed to know that.
  const asked = (open || [])
    .map(q => txt(markFor(deal, q.key).askedAt))
    .filter(Boolean)
    .sort()
  const bits: string[] = []

  // SOME HAVE NEVER GONE OUT. This used to be the block's business: a
  // question nobody had sent held it open, so the fact announced itself by
  // taking up the screen. The block is always shut now - Fabio, 16 Nov 2026 -
  // so the line has to carry it, or the fact disappears.
  const never = (open || []).filter(q => !txt(markFor(deal, q.key).askedAt)).length

  if (asked.length === 0) {
    bits.push('nothing has gone out yet')
  } else {
    const last = asked[asked.length - 1]
    const days = daysSince(last, today)
    bits.push(`asked ${shortDate(last)}`)
    if (days !== null && days > 0) bits.push(`${days} ${days === 1 ? 'day' : 'days'}`)
    if (never > 0) {
      bits.push(`${never} ${never === 1 ? 'has' : 'have'} not gone out`)
    }
    // NOBODY HAS ANSWERED is worth saying out loud. It is the whole reason a
    // broker would open this, and it was previously only findable by reading
    // three rows.
    bits.push((closed || []).length ? `${closed.length} answered` : 'nobody has answered')
  }
  return bits.join(' · ')
}

/** "3 of 3", for the chip on the fold. */
export function questionsCount(going: Question[], open: Question[]): string {
  return `${(going || []).length} of ${(open || []).length}`
}

/**
 * IT IS ALWAYS SHUT. ALWAYS.
 *
 * Fabio, 16 Nov 2026: "questions going out with this email are always always
 * hidden first, then we can expand if we want."
 *
 * This used to open itself on three conditions, and every one of them was a
 * good argument: a question that had never gone out, a question somebody had
 * just unticked, a client who had answered in the last two days. All three
 * said "somebody has not seen this yet".
 *
 * The trouble is that on a BC being written, all three are true at once and
 * the block is eight questions tall. It opened on top of the form, every
 * time, on the screen where the work actually happens.
 *
 * NOTHING IS HIDDEN BY THIS. The folded line still carries the count - "8 of
 * 8" - and still says in words whether they have gone out and whether anybody
 * has answered. See questionsFoldLine above, which is the line you read
 * without opening anything. One press and it is all there.
 *
 * The three reasons live on in that line. They just no longer decide the
 * height of the page.
 */
export function questionsStartOpen(
  _deal?: any, _open?: Question[], _dropped?: string[], _closed?: Closed[], _today?: Date,
): boolean {
  return false
}
