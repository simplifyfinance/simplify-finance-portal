"use client"
import Link from 'next/link'
import { useSayTheWeek } from '@/lib/use-say-the-week'
import { answerOf, type AnswerKey } from '@/lib/lodging-when'
import { progress, progressWords, isMonday } from '@/lib/the-brokers-monday'
import { useWentThrough } from '@/lib/use-went-through'
import { whereItIs } from '@/lib/the-run-through'
import { money } from '@/lib/money'

// IT IS MONDAY - WHAT IS COMING THIS WEEK?
//
// 12 Nov 2026, mocked and approved. The one screen in the portal that asks a
// self-employed broker for anything.
//
// WHY IT EARNS ITS PLACE. His answers are not a report. They are exactly what
// fills the Simplify Finance Brokers section of the Monday run-through - same
// three buttons, same three answers, written to the same columns by the same
// function. Nobody types anything twice, and credit and settlements know what
// is coming before it arrives.
//
// NOTHING HERE PUSHES HIM. No target, no league table, nothing red. Keanen and
// Justin are not managed and the screen should not pretend otherwise. It asks
// once on a Monday and then gets out of the way.
//
// THE WRITE IS THE SHARED ONE. lib/use-say-the-week.ts, the same hook Due to
// lodge and the run-through use. A second copy is how the answer stops
// reaching the meeting - see lib/no-duplicate-logic.test.ts.
const BTN = 'rounded-lg border px-2.5 py-[3px] text-[11.5px] font-semibold whitespace-nowrap'
const OFF = 'border-line bg-card text-muted'
const ON: Record<AnswerKey, string> = {
  this: 'border-done bg-done text-page',
  next: 'border-brand-ink bg-brand-ink text-page',
  client: 'border-waiting-edge bg-waiting-bg text-waiting',
}
const WORD: Record<AnswerKey, string> = { this: 'This week', next: 'Next', client: 'Client' }
const KEYS: AnswerKey[] = ['this', 'next', 'client']

export default function BrokerWeek({ deals, now = new Date(), onAnswered }: {
  deals: any[]
  now?: Date
  /** Told after each answer, so the page can move its own counters. */
  onAnswered?: () => void
}) {
  const { say, busy, problem, withAnswers } = useSayTheWeek(now)
  // The bottom button. Its own write, its own failure, nothing shared with
  // the three answers above - see lib/use-went-through.ts.
  const week = useWentThrough(now)
  const rows = withAnswers(deals)
  const p = progress(rows, now)

  if (rows.length === 0) return null

  return (
    <div className="mb-3 rounded-xl border-2 border-ink bg-card px-4 py-3.5">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-muted">
          {isMonday(now) ? 'It is Monday — what is coming this week?' : 'What is coming this week?'}
        </span>
        <span className="ml-auto text-[11px] text-faint">
          nobody sees this but us, and it only takes a minute
        </span>
      </div>

      <p className="mb-3 text-[13px] leading-relaxed text-body">
        Tell us which of these you think will lodge, and we will have the credit and
        settlements team ready for them.{' '}
        <b className="text-ink">
          {rows.length} deal{rows.length === 1 ? '' : 's'} you are talking to clients about.
        </b>
      </p>

      {problem && (
        <p className="mb-2 rounded-lg border border-chase-edge bg-chase-bg px-3 py-1.5
                      text-[12.5px] text-chase">{problem}</p>
      )}

      {rows.map(d => {
        const said = answerOf(d, now)
        return (
          <div key={d.id}
               className="flex flex-wrap items-center gap-2.5 border-b border-line-soft py-2
                          last:border-b-0">
            {/* CLICKABLE, because the next thing he does after answering is
                open the one he is unsure about. 12 Nov 2026, Fabio's own list. */}
            <Link href={`/deals/${d.id}`}
                  className="min-w-0 flex-1 truncate text-[13.5px] font-semibold hover:underline">
              {d.deal_name}
            </Link>
            <span className="whitespace-nowrap text-[11px] text-faint">
              {[d.lender, whereItIs(d)].filter(Boolean).join(' · ')}
            </span>
            <span className="whitespace-nowrap text-[13px] font-bold tabular-nums">
              {money(d.loan_amount) || <span className="text-[11px] font-normal italic text-faint">no amount yet</span>}
            </span>
            <span className="flex flex-none gap-[5px]">
              {KEYS.map(k => (
                <button key={k} type="button"
                        disabled={busy === String(d.id)}
                        onClick={async () => { await say(d.id, k); onAnswered?.() }}
                        className={`${BTN} ${said === k ? ON[k] : OFF}`}>
                  {WORD[k]}
                </button>
              ))}
            </span>
          </div>
        )
      })}

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {/* IT IS A REAL BUTTON, AS OF 14 NOV 2026.
            It was a <span> for two days - text dressed as the solid dark
            button used everywhere else in the portal. A broker pressed it,
            believed he had told the office, and nothing was written anywhere.
            Fabio: "Why would I leave a button fake?"
            The three answers above each save on their own press. This one
            saves the only thing they cannot: that he has been through the
            whole list. It is what the Monday run-through reads to tell a
            broker with nothing coming apart from a broker who never looked. */}
        {week.told ? (
          <span className="rounded-[10px] border border-done-edge bg-done-bg px-[17px] py-2
                           text-[13.5px] font-semibold text-done">
            Told the team
          </span>
        ) : (
          <button type="button" disabled={week.busy} onClick={() => { week.say() }}
                  className="rounded-[10px] bg-ink px-[17px] py-2 text-[13.5px] font-semibold
                             text-page disabled:opacity-60">
            {week.busy ? 'Saving' : 'That is my week'}
          </button>
        )}
        <span className="text-[12px] text-faint">
          {week.told && week.toldAt ? week.toldAt : progressWords(p)}
        </span>
      </div>

      {/* A REFUSED WRITE IS SAID OUT LOUD. The whole point of the button is
          that somebody else reads the mark it leaves. */}
      {week.problem && (
        <p className="mt-2 rounded-lg border border-chase-edge bg-chase-bg px-3 py-1.5
                      text-[12.5px] text-chase">{week.problem}</p>
      )}
    </div>
  )
}
