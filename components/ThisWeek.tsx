'use client'
import Link from 'next/link'
import { doneThisWeek, sittingNow } from '@/lib/the-week-so-far'
import { mondayOf, ymd } from '@/lib/lodging-when'
import { byReferral } from '@/lib/who-brought-us-this'

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
  // WHO BROUGHT THIS WEEK'S WORK. 11 Nov 2026, Fabio: "I want the reports to
  // be able to break it down and say, this is how many deals we did on this
  // referral split." Off the commission split chosen on the fact find, so it
  // is the same answer the deal itself gives. See lib/who-brought-us-this.ts.
  const span = { from: mondayOf(when), to: ymd(when) }
  const came = byReferral(deals, span).filter(r => r.lodged.length > 0).slice(0, 4)

  return (
    <div className="bg-page border border-card-line rounded-2xl px-4 py-3.5 mb-4">
      <p className="text-[9.5px] font-bold tracking-[.09em] uppercase text-faint m-0 mb-2.5">
        This week
      </p>

      <div className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-[760px]:grid-cols-1">
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
        <div className={CARD + ' border-info-edge'}>
          <p className="text-[13.5px] font-bold text-ink m-0 mb-0.5">Where it came from</p>
          <p className="text-[11.5px] text-faint m-0 mb-2.5 leading-[1.45]">
            This week&rsquo;s {done.find(l => l.key === 'lodged')?.count || 0} lodged, by who
            brought it.
          </p>
          {came.length === 0 ? (
            <p className="text-[12.5px] text-faint m-0">Nothing lodged yet this week.</p>
          ) : came.map(r => (
            <div key={r.key} className={ROW}>
              <span className={N}>{r.lodged.length}</span>
              <span className="text-[13px] text-body">{r.name}</span>
              <span className="ml-auto text-[11.5px] text-faint text-right leading-[1.4]">
                {r.terms || '—'}
              </span>
            </div>
          ))}
          <Link href="/lodgements"
            className="block text-[11.5px] font-semibold text-brand-ink mt-2.5 no-underline">
            The week&rsquo;s report →
          </Link>
        </div>
      </div>

      <p className="text-[11.5px] text-faint leading-[1.5] m-0 mt-2.5">
        Got done counts what moved this week. Sitting counts what is standing there now. A deal
        lodged on Tuesday is in both, and that is correct — they answer different questions.
      </p>
    </div>
  )
}
