'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { everyRow } from '@/lib/the-whole-book'
import { realDealsOnly, REAL_DEALS_OR } from '@/lib/test-deal'
import { PAGE_WIDE } from '@/lib/page-width'
import {
  myWork, orderAfterMove, brokerPlaceWords, urgentLine, STAGE_LABEL, type QueueItem,
} from '@/lib/my-work'

// MY WORK.
//
// Alan's item 3, and Fabio's answer to what a queue is: "my list, in order."
// Everything allocated to this person, sorted the way they want to do it - not
// the board with filters on it, and not a pool anybody can take from.
//
// THE ORDER IS THEIRS. Fabio: "credit can re-order their own queue." The
// arrows move a row and write every row's place, because a list half placed
// and half defaulted rearranges itself behind somebody's back.
//
// THE BROKER'S OWN ORDER RIDES BESIDE THE DEAL. A small grey chip - "Pat's
// 1st" - because it is worth knowing and it is not an instruction.
//
// AND NOTHING HERE IS TYPED. How long a deal has been waiting comes off the
// stage history; a rework is a rework because the broker sent it back; urgent
// carries the broker's own words. A queue somebody has to maintain is a queue
// that goes stale in a fortnight.

const ROW = 'flex items-center gap-3 bg-card border rounded-xl px-3.5 py-3 mb-2'
const TAG = 'text-[10.5px] font-bold rounded-md px-2 py-0.5 whitespace-nowrap border'
const ARROW = 'text-faint hover:text-ink text-[13px] leading-none px-1 disabled:opacity-30'

export default function MyWork({ officerId, officerName, brokerNames }: {
  officerId: string | null
  officerName?: string
  brokerNames?: Record<string, string>
}) {
  const supabase = createSupabaseBrowser()
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')

  async function load() {
    if (!officerId) { setLoading(false); return }
    setLoading(true)
    const { rows } = await everyRow<any>((from, to) => supabase
      .from('deals').select('*').or(REAL_DEALS_OR)
      .order('created_at', { ascending: false }).order('id').range(from, to))
    setItems(myWork(realDealsOnly(rows as any[]), officerId))
    setLoading(false)
  }
  useEffect(() => { void load() }, [officerId])

  async function move(from: number, to: number) {
    const next = orderAfterMove(items, from, to)
    if (!next.length) return
    // Shown first, written second. Waiting on nine round trips before the row
    // moves is how a list stops being used.
    const byId = new Map(next.map(n => [n.id, n.credit_order]))
    setItems(items
      .map(i => ({ ...i, order: byId.get(String(i.deal.id)) ?? i.order }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    setProblem('')
    for (const n of next) {
      const err = await checkedWrite(
        supabase.from('deals').update({ credit_order: n.credit_order }).eq('id', n.id), 'The order')
      if (err) { setProblem(err); break }
    }
  }

  if (!officerId) {
    return (
      <div className={PAGE_WIDE + ' px-6 py-6'}>
        <p className="text-[13.5px] text-muted m-0">
          This page is a credit officer&rsquo;s own list. Your login is not linked to one.
        </p>
      </div>
    )
  }

  return (
    <div className={PAGE_WIDE + ' px-6 py-6'}>
      <div className="flex items-baseline gap-2 mb-4">
        <h1 className="text-[18px] font-bold text-ink m-0">My work</h1>
        <span className="text-[12.5px] text-faint">
          {officerName ? officerName + ' · ' : ''}
          {loading ? 'loading…' : `${items.length} to do`}
        </span>
      </div>

      {problem && <p className="text-[12px] text-chase m-0 mb-2.5 leading-[1.5]">{problem}</p>}

      {!loading && items.length === 0 ? (
        <div className="bg-card border border-dashed border-card-line rounded-xl py-8 text-center
          text-[13.5px] text-faint">
          Nothing is waiting on you.
        </div>
      ) : items.map((item, n) => {
        const d = item.deal
        const broker = brokerNames?.[String(d.assigned_broker || '').toLowerCase()]
          || String(d.assigned_broker || '')
        const place = brokerPlaceWords(item, broker)
        return (
          <div key={d.id}
            className={ROW + (item.urgent || item.isRework ? ' border-chase-edge' : ' border-card-line')}>
            <div className="flex flex-col items-center gap-0.5 flex-none">
              <button onClick={() => void move(n, n - 1)} disabled={n === 0}
                title="Up" className={ARROW}>▲</button>
              <button onClick={() => void move(n, n + 1)} disabled={n === items.length - 1}
                title="Down" className={ARROW}>▼</button>
            </div>
            <span className="text-[12.5px] font-bold text-faint tabular-nums w-5 flex-none">
              {n + 1}
            </span>

            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <Link href={`/deals/${d.id}`}
                  className="text-[13.5px] font-bold text-ink hover:text-brand-ink">
                  {d.deal_name || 'Untitled deal'}
                </Link>
                {item.isRework
                  ? <span className={TAG + ' bg-chase-bg text-chase border-chase-edge'}>Rework</span>
                  : <span className={TAG + ' bg-info-bg text-brand-ink border-info-edge'}>
                      {STAGE_LABEL[item.stage]}
                    </span>}
              </div>
              <div className="text-[11.5px] text-faint mt-0.5">{broker}</div>
              {item.urgent && (
                <div className="text-[11.5px] text-chase leading-[1.45] mt-1">
                  <b className="text-ink">{urgentLine(d)}</b>
                </div>
              )}
            </div>

            {place && <span className={TAG + ' bg-line-soft text-muted border-line ml-auto'}>{place}</span>}

            <span className={`text-[11.5px] text-faint text-right flex-none ${place ? '' : 'ml-auto'}`}>
              {item.waitingDays === null ? '—'
                : item.waitingDays === 0 ? 'today'
                : `waiting ${item.waitingDays} ${item.waitingDays === 1 ? 'day' : 'days'}`}
            </span>

            <Link href={`/deals/${d.id}`}
              className="text-[12px] font-semibold bg-ink text-page rounded-lg px-3 py-1.5 flex-none
                no-underline">
              Open
            </Link>
          </div>
        )
      })}

      <p className="text-[11.5px] text-faint leading-[1.5] mt-4 max-w-[760px]">
        Your own order. The arrows move a row and keep it there. What the broker thinks matters most
        shows beside the deal rather than deciding the order — two people can have an opinion, one of
        them is doing the work. A rework or an urgent deal starts at the top until you move it.
      </p>
    </div>
  )
}
