'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SetHerOrder from '@/components/SetHerOrder'
import { seenState } from '@/lib/the-order-from-above'
import { creditMorning, othersFor, type CreditPerson } from '@/lib/the-credit-morning'
import { OFFICE } from '@/lib/same-date-everywhere'

// THE CREDIT QUEUE, OUT OF THE RAIL AND ON THE PAGE.
//
// 18 Nov 2026. Fabio: "the whole point of today for admin which is me Kylie Mark
// Alan and Catherine was so we can see credits queue and reallocate." And, of
// the old rail: "see Catherines screenshot... its cutting out."
//
// THREE THINGS CHANGED AND NOTHING ELSE.
//  1. Both assessors are open all the time. No button stands between management
//     and the work - which is why his screen and Catherine's looked different
//     when they were the same screen with one panel closed.
//  2. It is full width, so a name is a name. "Jam..." and "Dal..." were the
//     316px column, not the data.
//  3. Reallocating happens on the row. Moving a file off Katie used to mean
//     leaving the page for Team workload and coming back.
//
// IT IS THE SAME EDITOR. components/SetHerOrder.tsx, unframed and unscrolled -
// not a second one written for this bar. The order it writes, who it stamps and
// what the assessor sees are all unchanged.
//
// NO EMAIL ON A MOVE. 18 Nov, asked whether a move should mail her: "we spoken
// about this you have a warning sign on their Today." So the move is quiet and
// her own screen does the telling.

const KEY = 'text-[10px] font-extrabold tracking-[0.13em] uppercase text-[#9A948C]'
const DIM = 'text-[11px] text-[#9A948C]'

export default function CreditBand({ team, overloaded, me }: {
  team: Array<CreditPerson & { plan?: any; openDeals?: any[]; onLeave?: boolean }>
  overloaded: { name: string; open: number; average: number; unplanned: boolean } | null
  me: { id?: any; name?: any }
}) {
  const s = creditMorning(team)
  const now = new Date()
  const router = useRouter()

  // TWO PEOPLE, ONE QUEUE.
  //
  // 18 Nov 2026. Fabio, comparing his screen with Catherine's: "the point of
  // the TODAY page is for us to work collaboratively." The figures matched -
  // but only because both tabs had just been opened. Reorder Katie's list from
  // one screen and the other keeps yesterday's order with nothing to say so.
  //
  // SO THE CHAPTER RE-READS ITSELF. Ninety seconds, and only while the tab is
  // actually being looked at - a background tab costs the database a thousand
  // rows for nobody. router.refresh() re-runs the server component and leaves
  // scroll position and anything half-typed alone.
  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        router.refresh()
      }
    }
    const id = setInterval(tick, 90_000)
    return () => clearInterval(id)
  }, [router])

  // NO ASSESSORS, NO BAR. An empty black bar is furniture.
  if (team.length === 0) return null

  return (
    <>
      <div className="bg-[#1E1E1C] rounded-xl mb-3 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-2 bg-white/[0.055] border-b border-white/10">
          <span className="inline-block w-[8px] h-[8px] rounded-sm bg-[#6FD3FF]" />
          <span className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-page">
            Credit
          </span>
          <span className={DIM}>this morning</span>
          <span className={`ml-auto ${DIM}`}>
            {s.sent} of {s.team} sent their day
          </span>
        </div>

        <div className="px-4 py-3.5 flex items-center gap-6 flex-wrap">
          <div>
            <div className={KEY}>On today</div>
            <div className="text-[26px] font-extrabold leading-none text-[#6FD3FF] mt-1">{s.onToday}</div>
            <div className={`${DIM} mt-1`}>across the team</div>
          </div>
          <div className="text-[#56504A] text-[20px] font-light">&middot;</div>
          <div>
            <div className={KEY}>Done yesterday</div>
            <div className="text-[26px] font-extrabold leading-none text-[#64E8BB] mt-1">{s.doneYesterday}</div>
            <div className={`${DIM} mt-1`}>came off their list</div>
          </div>
          <div className="text-[#56504A] text-[20px] font-light">&middot;</div>
          <div>
            {/* THE NUMBER NOBODY WAS LOOKING AT. Open, and on no day at all. */}
            <div className={KEY}>Nobody is on</div>
            <div className="text-[26px] font-extrabold leading-none text-page mt-1">{s.unwatched}</div>
            <div className={`${DIM} mt-1`}>of {s.openTotal} open files</div>
          </div>

          {overloaded && (
            <div className="ml-auto text-right">
              <div className={KEY}>Carrying the most</div>
              <div className="text-[26px] font-extrabold leading-none text-page mt-1">
                {overloaded.open}
              </div>
              <div className={`${DIM} mt-1`}>
                {overloaded.name.split(' ')[0]}, against {overloaded.average} &middot;{' '}
                <Link href="/credit-team-workload" className="text-[#6FD3FF]">the whole team</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ONE COLUMN EACH. */}
      <div className="flex gap-3 items-start flex-wrap lg:flex-nowrap mb-3">
        {team.map(t => {
          const st = seenState(t.plan, now)
          return (
            <div key={t.id}
              className="flex-1 min-w-[360px] bg-card border border-card-line rounded-xl px-4 py-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-bold">{t.name}</span>
                {/* AWAY, NOT GONE. Her queue can be stacked and waiting; she
                    is not being asked for a plan this morning, and the round
                    robin is not sending her anything. */}
                {t.onLeave ? (
                  <span className="rounded-full border border-line bg-page text-muted
                                   px-2 py-px text-[10.5px] font-bold">
                    On leave
                  </span>
                ) : t.informedAt ? (
                  <span className="rounded-full border border-done-edge bg-done-bg text-done
                                   px-2 py-px text-[10.5px] font-bold">
                    Sent {new Date(t.informedAt).toLocaleTimeString('en-AU',
                      { timeZone: OFFICE, hour: 'numeric', minute: '2-digit' })}
                  </span>
                ) : (
                  <span className="rounded-full border border-chase-edge bg-chase-bg text-chase
                                   px-2 py-px text-[10.5px] font-bold">
                    Nothing yet
                  </span>
                )}
                {!st.none && (
                  <span className={`rounded-full border px-2 py-px text-[10.5px] font-bold ${st.seen
                    ? 'border-done-edge bg-done-bg text-done'
                    : 'border-info-edge bg-info-bg text-brand-ink'}`}>
                    {st.words}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-muted mt-1 mb-1">
                <b className="text-ink">{t.todayCount ?? 0}</b> on today &middot;{' '}
                <b className="text-ink">{t.yesterdayCount ?? 0}</b> done yesterday &middot;{' '}
                <b className="text-ink">{t.open ?? 0}</b> files open
              </div>

              <SetHerOrder
                officerId={t.id}
                name={t.name}
                plan={t.plan}
                deals={t.openDeals || []}
                me={me}
                others={othersFor(team, t.id)}
                framed={false}
                onDone={() => window.location.reload()}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}
