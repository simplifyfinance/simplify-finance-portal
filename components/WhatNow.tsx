'use client'

// ONE STRIP, THE SAME ON EVERY STAGE.
//
// 22 Oct 2026. Fabio spent an afternoon telling me why the buttons confuse his
// team, and the thing that finally landed was this: I had been drawing two
// different things as one row.
//
//   "I don't understand the mock-up of the buttons."
//   "I think we need to find a way that these buttons are just very intuitive."
//
// WHERE THE DEAL IS is a picture. You cannot press it.
// WHAT TO DO NEXT is a button. There are never more than two.
//
// Mixing those was the confusion. A row of four boxes that are sometimes status
// and sometimes actions means nobody knows which ones do anything.
//
// AND NOBODY IS ASKED WHO IS DOING IT. The old screen had "I'll do this myself"
// and "Send to credit team" - two buttons for one question, asked before any
// work had started. Fabio: "I think it's just one more question that it doesn't
// need to be... a broker comes in, he fills up the fact find, he's doing the
// BC, and then doesn't need to answer that question."
//
// So whoever is typing owns it. The only question is asked when they stop, and
// it is headed "What now".
//
// THE WORDS ARE HIS. "Done", "Hand to credit", "Send to client", "Client said
// yes". Not "mark complete", not "submit", not "progress deal".

export type Step = {
  label: string
  /** Finished. Green. */
  done?: boolean
  /** Where the deal is right now. Blue, or purple when it is the client's turn. */
  now?: boolean
  /** The client is the one holding it. Purple rather than blue. */
  client?: boolean
  /** Under the label - a date, a name, how long it took. */
  under?: string
}

export type Action = {
  label: string
  onClick: () => void
  /** The one somebody came here to press. Black. */
  primary?: boolean
  /** The client's own decision - purple, to match the step above it. */
  client?: boolean
  disabled?: boolean
  title?: string
}

export default function WhatNow({ steps, actions, hint, note }: {
  steps: Step[]
  /** At most two. Three is a menu, and a menu is what this replaces. */
  actions: Action[]
  /** The quiet line beside the buttons. "or just close the tab", that sort of thing. */
  hint?: string
  /** A sentence under everything, for when a step needs explaining. */
  note?: React.ReactNode
}) {
  return (
    <div className="bg-card border-2 border-ink rounded-xl px-5 py-4">
      {/* THE PICTURE. Nothing here is clickable, on purpose. */}
      <div className="flex gap-2 mb-3.5">
        {steps.map((s, i) => (
          <div key={i}
            className={`flex-1 rounded-lg px-2 py-2 text-center border text-[12px] leading-tight ${
              s.done ? 'bg-done-bg text-done border-done-edge font-semibold'
              : s.now && s.client ? 'bg-waiting-bg text-waiting border-waiting-edge font-bold'
              : s.now ? 'bg-info-bg text-info border-info-edge font-bold'
              : 'bg-line-soft text-faint border-line'}`}>
            <div>{s.label}</div>
            {s.under && <div className="text-[10.5px] font-normal opacity-80 mt-0.5">{s.under}</div>}
          </div>
        ))}
      </div>

      <div className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-faint mb-2">What now</div>

      <div className="flex gap-2.5 items-center flex-wrap">
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick} disabled={a.disabled} title={a.title}
            className={`text-[14px] rounded-[10px] px-5 py-2.5 font-semibold border disabled:opacity-40 ${
              a.client ? 'bg-waiting text-white border-waiting'
              : a.primary ? 'bg-ink text-page border-ink'
              : 'bg-card text-ink border-line hover:bg-page'}`}>
            {a.label}
          </button>
        ))}
        {hint && <span className="text-[12px] text-faint">{hint}</span>}
      </div>

      {note && <div className="text-[12.5px] text-muted mt-3 leading-relaxed">{note}</div>}
    </div>
  )
}
