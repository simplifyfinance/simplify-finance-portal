'use client'
import { useState } from 'react'
import { showingOwner, ownerOf, daysOnStage, stageIsDone, type Stage } from '@/lib/who-did-this-stage'

// ONE ROW, THE SAME ON THE BC AND THE LENDING OPTIONS.
//
// 23 Oct 2026, after Fabio put two screenshots side by side. The same row,
// doing the same job, drawn five different ways:
//
//   "BC form"          vs  "LO Form"
//   "Preview & share"  vs  "Email Preview"
//   blue outline pill  vs  solid black
//   round pills        vs  square buttons
//   no Docs received   vs  Docs received
//
// And the worst of it: on the lending options the tab you are standing on and
// the button that moves the deal to Compliance were BOTH solid black. One
// changes what you are reading. The other moves the deal. They looked the same.
//
// So: the view switch is a quiet grey control on the left and can never be
// mistaken for an action. Everything after "What now" is an action, in one
// order, in one shape. Black is the one to press. Dashed grey is not yet.
// Green is already done, with the date and who did it.
//
// WHO IS DOING IT IS THE FIRST THING, AND IT IS NOT A LIST OF NAMES.
// Fabio, 23 Oct: "A broker still needs to either do the BC /LO or Allocate to
// credit... remeebr you're the one that fucking assigns. You have that ability
// on a round robin." Two answers - me, or the queue - and the portal picks the
// person. See lib/allocate-officer.ts.

export type Action = {
  label: string
  onClick: () => void
  /** The one somebody came here to press. Black. */
  primary?: boolean
  /** Already happened. Green, with whatever `since` says beside it. */
  done?: boolean
  /** Not yet. Dashed and unpressable, never hidden - a button that comes and
   *  goes is how a screen loses people's trust. */
  waiting?: boolean
  since?: string
  title?: string
  // A SECOND, QUIETER BUTTON BESIDE A FINISHED ONE.
  //
  // 27 Oct 2026. Fabio: "it needs to give us the ability of resnding emails to
  // client both BC and LO as right now once we mark email sent it locks and we
  // cant resend the email with rewoked figures".
  //
  // The green tick stays, because a sent date is a fact worth showing. What it
  // stopped being is a lock. This is deliberately small and outlined rather
  // than another black button - resending a client email is a thing somebody
  // chooses, never a thing they fall into.
  again?: { label: string; onClick: () => void; title?: string }
}

export default function WhatNow({
  stage, deal, view, onView, actions, onOwnerChange, canAllocate = true, emailStale,
}: {
  stage: Stage
  deal: any
  view: 'form' | 'email'
  onView: (v: 'form' | 'email') => void
  /** The saved email no longer matches the deal. A dot on the Email side -
   *  it used to sit on the old Preview pill and had to come with it, because
   *  a warning nobody can see is not a warning. */
  emailStale?: boolean
  /** At most three. More than that is a menu, and a menu is what this replaces. */
  actions: Action[]
  /** 'me' keeps it, 'queue' sends it to the round robin. */
  onOwnerChange?: (choice: 'me' | 'queue') => void
  canAllocate?: boolean
}) {
  const [open, setOpen] = useState(false)
  const owner = showingOwner(deal, stage)
  const settled = !!ownerOf(deal, stage)
  // FINISHED IS WHAT THE CARD ABOVE SAYS IT IS - see stageWindow() in
  // lib/who-did-this-stage.ts. This used to be a date the form handed down,
  // and on any deal where credit never pressed Done it never arrived, so a
  // BC closed in September read "Doing this" with the clock still running.
  const done = stageIsDone(deal, stage)
  const days = daysOnStage(deal, stage)

  return (
    <div className="flex gap-2.5 items-center flex-wrap">
      {/* THE VIEW. Quiet, grey, on the left, and never shaped like an action. */}
      <div className="inline-flex gap-[3px] bg-line-soft rounded-[10px] p-[3px]">
        {([['form', 'Form'], ['email', 'Email']] as const).map(([k, label]) => (
          <button key={k} onClick={() => onView(k)}
            className={`text-[13.5px] rounded-lg px-4 py-2 ${
              view === k ? 'bg-card text-ink font-semibold shadow-sm' : 'text-muted hover:text-ink'}`}>
            {label}
            {k === 'email' && emailStale && (
              <span title="The saved email is out of date" className="ml-1.5 text-chase">●</span>
            )}
          </button>
        ))}
      </div>

      <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-faint mx-0.5">What now</span>

      {/* WHO IS DOING IT. A fact with a dropdown, not a question anybody has to
          answer - it already says the right name when the screen opens. */}
      {owner && (
        <div className="relative">
          <button onClick={() => onOwnerChange && canAllocate && !done && setOpen(o => !o)}
            disabled={!onOwnerChange || !canAllocate || done}
            className="text-left text-[14px] rounded-[9px] px-3.5 py-1.5 border-[1.5px] border-brand-ink bg-info-bg text-brand-ink font-bold disabled:opacity-80">
            <span className="block text-[10px] font-bold uppercase tracking-[0.05em] text-info opacity-75">
              {done ? 'Did this' : 'Doing this'}
            </span>
            {owner.name}{owner.isCredit ? ' — credit' : ''}
            {days !== null && <span className="font-normal opacity-70"> · {days} days</span>}
            {onOwnerChange && canAllocate && !done && <span className="font-normal opacity-60 ml-1.5">▾</span>}
          </button>
          {open && onOwnerChange && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-card-line rounded-xl shadow-lg py-1 min-w-[230px]">
              <button onClick={() => { setOpen(false); onOwnerChange('me') }}
                className="block w-full text-left px-3.5 py-2.5 text-[13.5px] hover:bg-page">
                {'I’ll do it'}
              </button>
              <button onClick={() => { setOpen(false); onOwnerChange('queue') }}
                className="block w-full text-left px-3.5 py-2.5 text-[13.5px] hover:bg-page">
                <span>Put it in the credit queue</span>
                <span className="block text-[11.5px] text-muted leading-snug mt-0.5">
                  Whoever covers this broker and is carrying the least
                </span>
              </button>
            </div>
          )}
        </div>
      )}
      {!settled && owner && (
        <span className="text-[11.5px] text-faint">nobody has said yet</span>
      )}

      {actions.map((a, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          <button onClick={a.onClick} disabled={a.waiting || a.done} title={a.title}
            className={`text-[14px] rounded-[9px] px-4 py-2 font-bold border ${
              a.done ? 'bg-done-bg text-done border-done-edge'
              : a.waiting ? 'bg-line-soft text-faint border-field-line border-dashed font-normal'
              : a.primary ? 'bg-ink text-page border-ink'
              : 'bg-card text-ink border-field-line hover:bg-page'}`}>
            {a.done ? `✓ ${a.label}` : a.label}
          </button>
          {a.since && <span className="text-[12px] text-faint">{a.since}</span>}
          {a.again && (
            <button onClick={a.again.onClick} title={a.again.title}
              className="text-[12px] rounded-lg px-2.5 py-1 font-semibold border border-card-line bg-card text-brand-ink hover:bg-page">
              {a.again.label}
            </button>
          )}
        </span>
      ))}
    </div>
  )
}
