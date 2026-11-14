"use client"
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { orderPatch, orderFrom, moveBy, takeOff, putOn } from '@/lib/the-order-from-above'

// MANAGEMENT SETS THE ORDER.
//
// 12 Nov 2026. Fabio: "the brokers and admin always dictate for Katie and Mel
// what they want to be done first." And on what happens next: "Credit never
// disagrees with the order... if I give the order, they follow the order."
//
// SO THERE IS NO ACCEPT AND NO DECLINE. The only question the whole loop asks
// is whether she has seen it. Her day is not un-ticked and she is not made to
// agree to anything - 14 Nov, Fabio: "I don't want her to have to agree to it."
//
// IT IS HER OWN LIST, REORDERED. Not a day invented for her. Three of her own
// files moved to the top, which is what the instruction actually is.
//
// THE NOTE IS OPTIONAL. 14 Nov: "I think the option to tell them why, but I
// don't want it to be obligatory." A reason turns an instruction into a
// handover, so it is offered first and never demanded.
const ARROW = 'rounded-[3px] border border-line bg-page px-[4px] py-[2px] text-[8px] leading-none text-faint'

export default function SetHerOrder({ officerId, name, plan, deals, me, onDone }: {
  officerId: string
  name: string
  /** Her daily_plans row for today, or null if she has none yet. */
  plan: any
  /** Her open deals, newest order irrelevant - this is what can be ordered. */
  deals: Array<{ id: string; deal_name?: string; where?: string }>
  me: { id?: any; name?: any }
  onDone: () => void
}) {
  const supabase = createSupabaseBrowser()
  const existing = orderFrom(plan)
  const [ids, setIds] = useState<string[]>(
    existing?.dealIds?.length ? existing.dealIds : (plan?.deal_ids || []).map(String))
  const [note, setNote] = useState(existing?.note || '')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  const byId = new Map(deals.map(d => [String(d.id), d]))
  const chosen = ids.map(id => byId.get(id)).filter(Boolean) as typeof deals
  const rest = deals.filter(d => !ids.includes(String(d.id)))

  async function send() {
    setBusy(true); setProblem('')
    const patch = orderPatch(me, ids, note)
    // Her row may not exist yet today, so this is an upsert on the same key the
    // rest of the screen uses. A blocked policy returns no rows and no error -
    // see lib/checked-write.ts, which is why this is not a bare await.
    const trouble = await checkedWrite(
      supabase.from('daily_plans').upsert(
        { officer_id: officerId, plan_date: plan?.plan_date || undefined, ...patch },
        { onConflict: 'officer_id,plan_date' }),
      'The order')
    setBusy(false)
    if (trouble) { setProblem(trouble); return }
    onDone()
  }

  return (
    <div className="mb-3 rounded-xl border-2 border-ink bg-card px-4 py-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-muted">
          {name}&rsquo;s order
        </span>
        <span className="ml-auto text-[10.5px] text-faint">move with the arrows</span>
      </div>

      {problem && (
        <p className="mb-2 rounded-lg border border-chase-edge bg-chase-bg px-3 py-1.5
                      text-[12.5px] text-chase">{problem}</p>
      )}

      {chosen.length === 0 && (
        <p className="pb-2 text-[12.5px] italic text-faint">
          Nothing chosen yet. Pick from her open files below.
        </p>
      )}

      {chosen.map((d, i) => (
        <div key={d.id} className="flex items-center gap-2.5 border-b border-line-soft py-1.5
                                   text-[13px] last:border-b-0">
          <span className="w-[17px] text-[11px] font-bold text-faint">{i + 1}</span>
          <span className="flex flex-none flex-col gap-px">
            <button type="button" className={ARROW}
                    onClick={() => setIds(x => moveBy(x, d.id, -1))}>▲</button>
            <button type="button" className={ARROW}
                    onClick={() => setIds(x => moveBy(x, d.id, 1))}>▼</button>
          </span>
          <span className="flex-1 truncate font-semibold">{d.deal_name}</span>
          <span className="text-[11px] text-faint">{d.where}</span>
          <button type="button"
                  onClick={() => setIds(x => takeOff(x, d.id))}
                  className="rounded-[7px] border border-line bg-page px-[7px] py-px
                             text-[11px] text-faint">
            take off
          </button>
        </div>
      ))}

      {rest.length > 0 && (
        <div className="mt-2.5 max-h-[150px] overflow-y-auto rounded-[10px] border border-line
                        bg-page px-2.5 py-1.5">
          <div className="pb-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-faint">
            Her other open files
          </div>
          {rest.slice(0, 20).map(d => (
            <button key={d.id} type="button"
                    onClick={() => setIds(x => putOn(x, d.id))}
                    className="flex w-full items-center gap-2 border-b border-line-soft py-1
                               text-left text-[12.5px] last:border-b-0">
              <span className="flex-1 truncate">{d.deal_name}</span>
              <span className="text-[11px] text-faint">{d.where}</span>
              <span className="text-[11px] font-semibold text-brand-ink">add</span>
            </button>
          ))}
        </div>
      )}

      <textarea
        value={note}
        onChange={e => setNote(e.target.value.slice(0, 400))}
        placeholder="Why, if it helps. Optional."
        rows={2}
        className="mt-2.5 w-full rounded-[9px] border border-line bg-page px-2.5 py-2
                   text-[12.5px] text-body"
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        <button type="button" disabled={busy || ids.length === 0} onClick={send}
                className="rounded-[9px] bg-ink px-[15px] py-[7px] text-[13px] font-semibold
                           text-page disabled:opacity-40">
          {busy ? 'Sending…' : 'Send the order'}
        </button>
        <button type="button" onClick={onDone}
                className="text-[12px] text-faint">Cancel</button>
        <span className="text-[11.5px] text-faint">
          she will see it the next time she opens Today
        </span>
      </div>
    </div>
  )
}
