'use client'
import { doneThisWeek, sittingNow } from '@/lib/the-week-so-far'

// THIS WEEK, BOTH HALVES.
//
// Fabio, 10 Nov 2026: "I want both what we got done and what we have sitting."
//
// Two cards because they answer two questions. The left one counts events that
// happened between Monday and this morning; the right one counts deals
// standing in each state right now. A quiet week makes the left side small and
// does nothing to the right.
//
// A deal lodged on Tuesday is on both sides. The line underneath says so,
// because a number a reader cannot reconcile is a number they stop trusting.
//
// NO CHART. Three numbers do not need one, and the moment this has a chart it
// becomes a thing to admire rather than a thing to act on.

const CARD = 'bg-card border border-card-line rounded-xl px-4 py-3.5'
const ROW = 'flex items-baseline gap-2.5 py-[7px] border-t border-line-soft first:border-t-0 first:pt-0'
const N = 'text-[21px] font-bold text-ink tabular-nums min-w-[34px] leading-none'

export default function ThisWeek({ deals, now }: { deals: any[]; now?: Date }) {
  const when = now || new Date()
  const done = doneThisWeek(deals, when)
  const sitting = sittingNow(deals, when)

  return (
    <div className="bg-page border border-card-line rounded-2xl px-4 py-3.5 mb-4">
      <p className="text-[9.5px] font-bold tracking-[.09em] uppercase text-faint m-0 mb-2.5">
        This week
      </p>

      <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
        <div className={CARD}>
          <p className="text-[13.5px] font-bold text-ink m-0 mb-0.5">What we got done</p>
          <p className="text-[11.5px] text-faint m-0 mb-2.5 leading-[1.45]">
            Deals that crossed a line between Monday and this morning.
          </p>
          {done.map(l => (
            <div key={l.key} className={ROW}>
              <span className={N}>{l.count}</span>
              <span className="text-[13px] text-body">{l.words}</span>
              <span className="ml-auto text-[11.5px] text-faint text-right leading-[1.4]">
                last week <b className="text-muted font-semibold">{l.lastWeek}</b>
              </span>
            </div>
          ))}
        </div>

        <div className={CARD}>
          <p className="text-[13.5px] font-bold text-ink m-0 mb-0.5">What is sitting</p>
          <p className="text-[11.5px] text-faint m-0 mb-2.5 leading-[1.45]">
            Deals standing there this morning, and the one waiting longest.
          </p>
          {sitting.map(l => {
            // RED MEANS SOMETHING HAS BEEN LEFT, not that the pile is big. A
            // number on its own is a fact; one of them sitting a fortnight is
            // a thing to do today, which is what red is for in this portal.
            const late = l.longest !== null && l.longest >= l.longAt
            return (
              <div key={l.key} className={ROW}>
                <span className={N}>{l.count}</span>
                <span className="text-[13px] text-body">{l.words}</span>
                <span className="ml-auto text-[11.5px] text-faint text-right leading-[1.4]">
                  {l.longest === null ? '—' : (
                    <>longest{' '}
                      <b className={late ? 'text-chase font-bold' : 'text-muted font-semibold'}>
                        {l.longest} {l.longest === 1 ? 'day' : 'days'}
                      </b>
                    </>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[11.5px] text-faint leading-[1.5] m-0 mt-2.5">
        Got done counts what moved this week. Sitting counts what is standing there now. A deal
        lodged on Tuesday is in both, and that is correct — they answer different questions.
      </p>
    </div>
  )
}
