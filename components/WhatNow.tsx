'use client'
import { useState } from 'react'
import { toneColour, type Tone } from '@/components/TheBubble'
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
  // WHAT KIND OF THING IT IS, AND THEREFORE WHAT COLOUR IT WEARS.
  //
  // 16 Nov 2026, deal-page-stages.html. Every button on this row used to be
  // black, white or grey, so "Done", "Send to client" and "Send it back" - a
  // handover, an email to a client, and telling somebody their work needs
  // redoing - were three identical rectangles. Fabio chose four meanings:
  // done is green, anything that goes out is blue, anything that hands work
  // back is the deep pink, and everything else is grey.
  //
  // The colour is named at the call site because only the form knows what the
  // button means. It is NOT guessed from the label - a guess would read
  // "Send it back" and "Send to client" as the same thing.
  tone?: Tone
  /** The one somebody came here to press. Black. */
  primary?: boolean
  /** Already happened. Green, with whatever `since` says beside it. */
  done?: boolean
  // WHAT IT SAYS ONCE IT HAS HAPPENED.
  //
  // 10 Nov 2026. Fabio: "it should read Sent to client not Send to client".
  // A green tick beside the words "Send to client" is a button telling you to
  // do the thing it has just told you is done. The tick carries the fact and
  // the label carried the instruction, and the two disagreed.
  //
  // Optional: a label that already reads as a finished thing - "Done",
  // "Client agreed" - needs nothing.
  doneLabel?: string
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
  showView = true,
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
  // COMPLIANCE HAS NO FORM AND EMAIL TO SWITCH BETWEEN.
  //
  // 27 Oct 2026, Catherine's item 8. The BC and the lending options are each
  // two views of one thing, so the switch earns its place there. Compliance is
  // one page. Drawing a switch with one side to it would be a control that
  // does nothing, which is the fault this whole row was built to remove.
  showView?: boolean
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

  // ROOM UNDER IT. 17 Nov 2026 - the questions band sat straight against the
  // buttons and read as part of the same cluster. Fabio: "see the gap between
  // questions going out and the button Done? Just build a gap. It's very
  // smushed together."
  return (
    <div className="flex gap-2.5 items-center flex-wrap mb-4">
      {/* THE VIEW. Quiet, grey, on the left, and never shaped like an action. */}
      {/* THE VIEW IS A DROPDOWN, AND IT SITS ON THE RIGHT.
          docs/approved-looks/deal-page-stages.html: "VIEW  Form ▾", away from
          the buttons, because it changes what you are READING and the others
          move the deal. Fabio, 17 Nov 2026: "the view form between form and
          email is a drop-down box, remember?"
          It was two pills that looked like two more actions. */}
      {showView && (
      <label className="order-last ml-auto inline-flex items-center gap-2 border border-card-line
                        rounded-[9px] px-3 py-[6px] bg-card cursor-pointer">
        <span className="text-[9px] font-extrabold tracking-[.1em] uppercase text-faint">View</span>
        <select value={view} onChange={e => onView(e.target.value as 'form' | 'email')}
          aria-label="What to look at"
          className="text-[12.5px] text-ink bg-transparent outline-none cursor-pointer">
          <option value="form">Form</option>
          <option value="email">Email{emailStale ? ' — out of date' : ''}</option>
        </select>
        {emailStale && <span title="The saved email is out of date" className="text-chase">&bull;</span>}
      </label>
      )}

      {/* "WHAT NOW" IS GONE. The buttons say what they do; a label in front of
          them was a word nobody read. 17 Nov 2026. */}

      {/* WHO IS DOING IT. A fact with a dropdown, not a question anybody has to
          answer - it already says the right name when the screen opens. */}
      {/* WHO IS DOING IT - ONLY WHILE NOBODY IS.
          17 Nov 2026. Fabio, with the mock beside the real page: "Doing this,
          Mellissa Sedin, credit, 0.8 days - that button doesn't need to be
          there. See where it says WHERE IT IS? It's already with Mellissa."
          He is right: once a stage has an owner, the head of the Where it is
          box says so, and this said it a second time in a blue box the size
          of a button.
          IT IS STILL THE ONLY WAY TO TAKE A STAGE ON. So it stays while the
          stage has nobody - "I'll do it" and "Put it in the credit queue" -
          and disappears the moment somebody has it. Reassigning after that is
          the Credit row in the deal box, which is where the mock puts it. */}
      {owner && !settled && (
        <div className="relative">
          <button onClick={() => onOwnerChange && canAllocate && !done && setOpen(o => !o)}
            disabled={!onOwnerChange || !canAllocate || done}
            className="text-left text-[12.5px] rounded-[9px] px-3 py-[5px] border border-info-edge
              bg-info-bg text-brand-ink font-semibold disabled:opacity-80">
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
          {/* THE SAME BUTTON THE WHOLE DEAL PAGE USES - see .bt in
              app/globals.css and components/TheBubble.tsx. Only the CLASSES
              changed here on 16 Nov 2026. Every onClick, every disabled rule
              and every piece of wording is the one that was already there:
              these are the buttons that move a deal and email a client, and
              a look is not a reason to touch what they do. */}
          <button onClick={a.onClick} disabled={a.waiting || a.done} title={a.title}
            className="bt"
            data-main={a.primary && !a.done && !a.waiting ? '' : undefined}
            data-done={a.done ? '' : undefined}
            data-waiting={a.waiting ? '' : undefined}
            style={{ ['--c' as any]: a.done ? 'var(--color-done)' : toneColour(a.tone || 'info') }}>
            {a.done ? `✓ ${a.doneLabel || a.label}` : a.label}
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
