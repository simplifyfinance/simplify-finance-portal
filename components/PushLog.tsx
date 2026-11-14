"use client"
import {
  listOf, latest, pushedButNotSent, theProblem, whatHappened, type Push,
} from '@/lib/the-push-leaves-a-mark'
import { dayMonthTime } from '@/lib/same-date-everywhere'

// WHO PRESSED IT, WHEN, AND WHETHER IT ARRIVED.
//
// 13 Nov 2026, Jayver Varghese. The push button was pressed, no email went,
// and the portal wrote nothing - so a deal somebody had pushed looked exactly
// like a deal nobody had touched. It took three SQL queries and the request
// logs to find out, at midnight, and it came close to being a conversation
// with a member of staff about whether they were telling the truth.
//
// Fabio, 14 Nov: "show on the deal keep it."
//
// NOTHING IS DRAWN ON A DEAL NOBODY HAS PUSHED. A deal that is not ready is
// not a problem and does not need a row saying so.
//
// A SUCCESSFUL PUSH STAYS. It is the record of who sent a regulated pack and
// where it went, and that is worth keeping for the same reason the pack is.
export default function PushLog({ pushLog }: { pushLog: any }) {
  const all = listOf(pushLog)
  if (all.length === 0) return null

  const problem = theProblem(pushLog)

  return (
    <div className="mb-3">
      {/* THE LINE THAT WOULD HAVE SAVED THE NIGHT. A deal pushed and never
          arrived now looks different from one nobody has touched, on the card,
          at a glance. */}
      {problem && (
        <p className="mb-2 flex gap-2 rounded-xl border border-chase-edge bg-chase-bg px-3 py-2.5
                      text-[13px] leading-snug text-chase">
          <span aria-hidden>&#9888;</span>
          <span>{problem}</span>
        </p>
      )}

      <div className="rounded-xl border border-card-line bg-card px-3.5 py-3">
        <p className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-muted">
          Pushed to SalesTrekker
        </p>
        {all.map((p: Push, i: number) => (
          <div key={`${p.at}-${i}`}
               className="flex items-center gap-2.5 border-b border-line-soft py-1.5 text-[13px]
                          last:border-b-0">
            <span aria-hidden
                  className={'h-2 w-2 flex-none rounded-full '
                    + (p.state === 'sent' ? 'bg-done' : 'bg-chase')} />
            <span className="font-semibold">{p.by}</span>
            {/* Sydney's clock, like every other time in the portal. */}
            <span className="text-[12px] text-faint">{dayMonthTime(p.at)}</span>
            <span className="text-body">{whatHappened(p)}</span>
            <span className={'ml-auto whitespace-nowrap rounded-full border px-2 py-px '
              + 'text-[10.5px] font-bold '
              + (p.state === 'sent'
                ? 'border-done-edge bg-done-bg text-done'
                : 'border-chase-edge bg-chase-bg text-chase')}>
              {p.state === 'sent' ? 'Sent' : 'Failed'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export { pushedButNotSent, latest }
