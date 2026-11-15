'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import {
  STEPS, STEP_LABEL, stepOf, stepIndex, daysOnStep, movePatch, cannotMoveBecause, type Step,
} from '@/lib/the-seven-steps'
import { itemsFor, ticked, tickPatch, type Item } from '@/lib/the-step-checklists'
import { useSettlementSettings } from '@/lib/use-settlement-settings'

// MARKING THINGS OFF WITHOUT OPENING THE DEAL.
//
// 17 Nov 2026. Fabio: "we have build deal card with magnifying glass ability
// for a reason for example so we can quickly marking thinghs off whitout having
// to get into deal... lets build productivity."
//
// THE WALKING WAS ALREADY THERE. The quick look has taken left and right since
// it was built - its own footer says "← → to step through the column" - and
// nobody uses it, because there is nothing to do once you arrive. Give it
// something to do and the walking becomes the point: open the first card in
// Outstandings, press 1 and 3, press right, repeat. Twelve deals in ninety
// seconds instead of a quarter of an hour.
//
// AND IT IS AN OPTION, NOT A RULE. Fabio, asked straight: "remeber its an
// option but not a rule as we can still do the same inside the deal card."
// Everything here is also on the settlement panel, unchanged.
//
// ---------------------------------------------------------------------------
// WHAT IT STILL REFUSES, AND WHY THAT IS NOT THE OLD RULE BENDING
// ---------------------------------------------------------------------------
//
// DealPeek says, in its own header: "NOTHING on it is editable - it is a look,
// not a second place to change things, for the same reason dragging a card
// opens the real panel rather than writing a half record."
//
// That rule is about HALF RECORDS. A lodgement needs a lender and its splits or
// the commission history is destroyed. A checklist tick is one boolean with
// nothing else hanging off it - there is no second field it can leave
// inconsistent and no snapshot it can skip. So ticks happen here; anything that
// needs a figure, and Settlement Booked with no date, still open the deal.

export default function PeekSettlement({ deal, onSaved }: {
  deal: any
  onSaved?: (patch: Record<string, any>) => void
}) {
  const supabase = createSupabaseBrowser()
  const settings = useSettlementSettings()
  const [d, setD] = useState<any>(deal)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { setD(deal); setMsg('') }, [deal])

  const step = stepOf(d)
  const items = step ? itemsFor(step, d) : []
  // The ones a person can press. A derived item is the portal reporting what it
  // already knows, so it gets no key.
  const pressable = items.filter(i => !i.derived)

  async function write(patch: Record<string, any>, what: string) {
    setBusy(true); setMsg('')
    const problem = await checkedWrite(
      supabase.from('deals').update(patch).eq('id', d.id), what)
    setBusy(false)
    if (problem) { setMsg(problem); return }
    const next = { ...d, ...patch }
    setD(next)
    onSaved?.(patch)
  }

  async function tick(i: Item) {
    if (!step) return
    const patch = tickPatch(d, step, i, !ticked(d, step, i))
    if (patch) await write(patch, i.what)
  }

  async function moveOn() {
    if (!step) return
    const to = STEPS[stepIndex(step) + 1] as Step | undefined
    if (!to) return
    const no = cannotMoveBecause(d, to)
    // IT SAYS WHY AND POINTS AT THE DEAL. It never half-moves.
    if (no) { setMsg(`${no} Open the deal to add it.`); return }
    await write(movePatch(d, to, new Date()), `Moving to ${STEP_LABEL[to]}`)
  }

  // 1-9 TICK, ENTER MOVES ON. Left and right already walk the column and are
  // handled by DealPeek itself, so nothing here touches them.
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      // Never while somebody is typing.
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key >= '1' && e.key <= '9') {
        const i = pressable[Number(e.key) - 1]
        if (i) { e.preventDefault(); void tick(i) }
        return
      }
      if (e.key === 'Enter') { e.preventDefault(); void moveOn() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, step, pressable.length])

  // A deal nobody has put on a settlement step has nothing to show here.
  if (!step) return null

  const chase = settings.chase[step]
  const days = daysOnStep(d)
  const over = chase !== null && chase !== undefined && days >= chase
  const allDone = items.every(i => ticked(d, step, i))
  const next = STEPS[stepIndex(step) + 1] as Step | undefined
  const waiting = String(d?.outstandings || '').trim()

  return (
    <div className="border-t border-line-soft bg-page px-[18px] pb-3 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[9.5px] font-bold uppercase tracking-[.09em] text-muted">Settlement</span>
        <span className="rounded-[5px] border border-ink px-[7px] text-[9.5px] font-extrabold uppercase tracking-[.04em] leading-[17px]">
          {STEP_LABEL[step]}
        </span>
        <span className={`ml-auto text-[11px] ${over ? 'font-bold text-ink' : 'text-faint'}`}>
          {days} day{days === 1 ? '' : 's'}
        </span>
      </div>

      {step === 'outstandings' && waiting && (
        <div className="mb-2 rounded-[9px] border border-card-line bg-card px-2.5 py-[7px] text-[12px] text-body">
          <span className="block text-[9.5px] font-bold uppercase tracking-[.07em] text-faint">Waiting on</span>
          {waiting}
        </div>
      )}

      {items.map(i => {
        const on = ticked(d, step, i)
        const n = pressable.indexOf(i)
        return (
          <div key={i.key} className="flex items-start gap-2 border-b border-line-soft py-[6px] last:border-b-0">
            <span className="w-[19px] flex-none rounded-[5px] border border-field-line bg-card text-center font-mono text-[10.5px] font-extrabold leading-[17px] text-faint">
              {n >= 0 && n < 9 ? n + 1 : '·'}
            </span>
            <button type="button" disabled={busy || !!i.derived} onClick={() => void tick(i)}
              aria-pressed={on}
              className={`mt-[1px] h-[17px] w-[17px] flex-none rounded-[5px] border text-[10.5px] font-extrabold leading-[14px] ${
                on ? 'border-ink bg-ink text-page' : 'border-field-line bg-card text-transparent'
              } ${i.derived ? 'opacity-60' : ''}`}>
              &#10003;
            </button>
            <span className={`flex-1 text-[12px] leading-[1.4] ${on ? 'text-faint' : 'text-ink'}`}>
              {i.what}
            </span>
          </div>
        )
      })}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-faint">
        {allDone && next ? (
          <>
            <span>All done &middot;</span>
            <kbd className="rounded-[5px] border border-field-line bg-card px-[6px] font-mono text-[10.5px] font-bold text-body">Enter</kbd>
            <span>move to {STEP_LABEL[next]}</span>
          </>
        ) : (
          <>
            <span>Press</span>
            {pressable.slice(0, 9).map((_, n) => (
              <kbd key={n} className="rounded-[5px] border border-field-line bg-card px-[6px] font-mono text-[10.5px] font-bold text-body">{n + 1}</kbd>
            ))}
            <span>to tick</span>
          </>
        )}
        <span>&middot;</span>
        <kbd className="rounded-[5px] border border-field-line bg-card px-[6px] font-mono text-[10.5px] font-bold text-body">&rarr;</kbd>
        <span>next deal</span>
      </div>

      {msg && <p className="mt-2 mb-0 text-[11.5px] text-chase">{msg}</p>}
    </div>
  )
}
