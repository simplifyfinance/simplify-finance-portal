'use client'
import { useState } from 'react'
import {
  STEPS, STEP_LABEL, STEP_MEANS, stepOf, stepIndex, daysOnStep, movePatch, cannotMoveBecause,
  type Step,
} from '@/lib/the-seven-steps'
import {
  itemsFor, ticked, tickPatch, doneCount, leftBehind, leavingWords, stillOpen,
} from '@/lib/the-step-checklists'
import { type SettlementSettings } from '@/lib/settlement-settings'

// THE SEVEN STEPS, ON THE DEAL.
//
// 17 Nov 2026. Two of the board's four settlement columns have never held a
// deal, because the dates behind them were written by two buttons on a panel
// that nobody presses. These are the process; two of the moves write those
// dates as a side effect of the work.
//
// ONE COLOUR, AND IT MEANS ONE THING. Fabio, on an earlier mock: "Too many
// reds. I hate red. It makes it too busy." And then: "instead of red use our
// simplify blue." So blue means a person has to decide something. A step past
// its chase time goes BOLD, not coloured. See lib/the-seven-steps.ts.
//
// NOTHING BLOCKS. Moving on with items unticked says what is being left behind
// and carries it forward. The one refusal is Settlement Booked with no
// settlement date, because the step means the date is confirmed.

export default function SettlementSteps({
  deal, settings, onMove, onTick, busy,
}: {
  deal: any
  settings: SettlementSettings
  onMove: (patch: Record<string, any>) => void | Promise<void>
  onTick: (patch: Record<string, any>) => void | Promise<void>
  busy?: boolean
}) {
  const [refused, setRefused] = useState('')
  const now = stepOf(deal)
  const here: Step = now || 'formal'
  const items = itemsFor(here, deal)
  const count = doneCount(deal, here)
  const behind = leftBehind(deal, here)
  const open = stillOpen(deal, here, STEPS)
  const days = now ? daysOnStep(deal) : null

  async function move(to: Step) {
    const no = cannotMoveBecause(deal, to)
    if (no) { setRefused(no); return }
    setRefused('')
    await onMove(movePatch(deal, to, new Date()))
  }

  const nextStep = STEPS[stepIndex(here) + 1] as Step | undefined
  const chase = settings.chase[here]
  const over = chase !== null && chase !== undefined && days !== null && days >= chase

  return (
    <div className="px-4 pb-4">
      {/* THE LADDER. Where the file is, and how long it has been there. */}
      <div className="mb-3 flex flex-wrap gap-1">
        {STEPS.map(s => {
          const i = stepIndex(s)
          const atOrPast = now !== null && i < stepIndex(here)
          const isHere = now !== null && s === here
          const c = settings.chase[s]
          return (
            <button key={s} type="button" disabled={busy} onClick={() => void move(s)}
              title={STEP_MEANS[s]}
              className={`min-w-[96px] flex-1 rounded-[9px] px-2 py-1.5 text-center transition ${
                isHere ? 'border-2 border-ink bg-card'
                : atOrPast ? 'border border-done-edge bg-done-bg'
                : 'border border-card-line bg-page hover:bg-card'}`}>
              <div className={`text-[10px] font-extrabold uppercase tracking-[.04em] ${
                isHere ? 'text-ink' : atOrPast ? 'text-done' : 'text-faint'}`}>
                {STEP_LABEL[s]}
              </div>
              <div className={`text-[10.5px] ${
                isHere && over ? 'font-bold text-ink' : atOrPast ? 'text-done' : 'text-faint'}`}>
                {isHere ? (c === null ? 'no chase' : `${days} of ${c} days`)
                  : atOrPast ? '✓' : c === null ? '—' : `${c} days`}
              </div>
            </button>
          )
        })}
      </div>

      {!now && (
        <p className="mb-3 mt-0 text-[12.5px] text-muted">
          This deal has not been put on a step yet. Press <b>Formal</b> when it lands with settlements.
        </p>
      )}

      {/* THE CHECKLIST FOR THE STEP IT IS ON. */}
      {items.length > 0 && (
        <div className="rounded-xl border border-card-line bg-card px-4 py-3">
          <div className="mb-1 flex items-center gap-2.5">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[.08em] text-muted">
              {STEP_LABEL[here]} &mdash; before moving on
            </span>
            <span className="ml-auto text-[10.5px] font-bold text-faint">
              {count.done} of {count.all}
            </span>
          </div>
          {items.map(i => {
            const on = ticked(deal, here, i)
            const byPortal = !!i.derived
            return (
              <div key={i.key} className="flex items-start gap-2.5 border-b border-line-soft py-2 last:border-b-0">
                <button type="button" disabled={busy || byPortal}
                  onClick={() => { const p = tickPatch(deal, here, i, !on); if (p) void onTick(p) }}
                  aria-pressed={on}
                  title={byPortal ? 'The portal answers this one from the deal' : ''}
                  className={`mt-[2px] h-[18px] w-[18px] flex-none rounded-[5px] border text-[11px] font-extrabold leading-4 ${
                    on ? 'border-ink bg-ink text-page' : 'border-field-line bg-card text-transparent'
                  } ${byPortal ? 'opacity-60' : ''}`}>
                  &#10003;
                </button>
                <span className="flex-1 text-[13px] leading-snug">
                  {i.what}
                  {i.whose && <span className="ml-1.5 text-[11px] text-faint">&mdash; {i.whose}</span>}
                  {i.onlyWhy && <span className="block text-[11px] text-info">{i.onlyWhy}</span>}
                  {byPortal && !i.onlyWhy && (
                    <span className="block text-[11px] text-faint">Answered from the deal</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* MOVING ON. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {nextStep && (
          <button type="button" disabled={busy} onClick={() => void move(nextStep)}
            className="rounded-[10px] bg-ink px-4 py-2 text-[13px] font-bold text-page disabled:opacity-40">
            Move to {STEP_LABEL[nextStep]}
          </button>
        )}
        {here !== 'outstandings' && now && (
          <button type="button" disabled={busy} onClick={() => void move('outstandings')}
            className="rounded-[10px] border border-field-line bg-card px-4 py-2 text-[13px] font-bold disabled:opacity-40">
            Move to Outstandings
          </button>
        )}
        {!now && (
          <button type="button" disabled={busy} onClick={() => void move('formal')}
            className="rounded-[10px] bg-ink px-4 py-2 text-[13px] font-bold text-page disabled:opacity-40">
            Start at Formal
          </button>
        )}
      </div>

      {/* THE ONE REFUSAL IN THE WHOLE PROCESS. */}
      {refused && (
        <p className="mt-2.5 mb-0 rounded-[10px] border border-info-edge bg-info-bg px-3 py-2 text-[12.5px] text-info">
          {refused}
        </p>
      )}

      {/* WHAT IS BEING LEFT BEHIND. Never a stop, and never hidden. */}
      {behind.length > 0 && (
        <div className="mt-2.5 rounded-[10px] border border-card-line border-l-[3px] border-l-ink bg-card px-3.5 py-2.5">
          <div className="text-[12.5px] font-bold">{leavingWords(behind.length)}</div>
          <p className="m-0 text-[12.5px] text-body">
            {behind.map(i => i.what).join('. ')}. {behind.length === 1 ? 'It follows' : 'They follow'} the
            deal to the next step.
          </p>
        </div>
      )}

      {/* AND ANYTHING LEFT BEHIND EARLIER IS STILL FINDABLE FROM HERE. */}
      {open.length > 0 && (
        <div className="mt-2 text-[11.5px] leading-relaxed text-faint">
          Still open from earlier: {open.map(o => `${i18n(o.step)} — ${o.item.what}`).join(' · ')}
        </div>
      )}
    </div>
  )
}

const i18n = (s: Step) => STEP_LABEL[s]
