'use client'
import type { ReactNode, CSSProperties } from 'react'

// EVERY SECTION OF THE DEAL PAGE IS ONE OF THESE.
//
// deal-page-stages.html, approved 16 Nov 2026. Fabio, looking at the page as it
// was: "look how busy this is... do an audit. Like, how do we make this
// better?"
//
// The audit's answer was not fewer things. It was that nothing on the page
// agreed with anything else: eight headings in six sizes, buttons in whatever
// colour each one was written in, and three bands fighting for the top of the
// screen. So every box is drawn here instead, wears ONE colour, and has ONE
// filled button - the thing you opened that box to do.
//
// IT ADDS NO FEATURES AND REMOVES NONE. This decides what a section looks like.
// What is inside each one is the component that was already drawing it. See
// lib/nothing-on-the-deal-page-is-lost.test.ts, which names all 49 and fails
// the ship if one goes missing.

// THE SEVEN, AND WHY THERE ARE ONLY SEVEN.
//
// Four of them already had a name in lib/colours.ts, because they already mean
// something everywhere else in the portal: info is us, done is finished,
// waiting is the client, muted is nothing in particular. Reusing them is the
// whole point - a green heading on this page means what a green chip means on
// the board.
export type Tone = 'info' | 'done' | 'urgent' | 'docs' | 'notes' | 'plain'

const ACCENT: Record<Tone, string> = {
  info:   'var(--color-info)',     // the deal, the form you are on, open BC
  done:   'var(--color-done)',     // where it is, agreed, settled
  urgent: 'var(--color-urgent)',   // needs action, mark urgent, send it back
  docs:   'var(--color-docs)',     // what we need from the client
  notes:  'var(--color-waiting)',  // sales notes, and the client's questions
  plain:  'var(--color-muted)',    // links, something wrong, edit, more
}

export function toneColour(tone: Tone): string { return ACCENT[tone] }

export function Bubble({ tone = 'plain', icon, title, actions, children, style, faded }: {
  tone?: Tone
  icon?: ReactNode
  title: string
  actions?: ReactNode
  children?: ReactNode
  style?: CSSProperties
  /** The box that is there when you want it and quiet when you do not. */
  faded?: boolean
}) {
  return (
    <section className="bub"
      style={{ ['--acc' as any]: ACCENT[tone], ...(faded ? { opacity: .78 } : null), ...style }}>
      <div className="bub-h">
        {icon && <span className="bub-ic">{icon}</span>}
        <h2>{title}</h2>
        {actions && <span className="acts">{actions}</span>}
      </div>
      {children}
    </section>
  )
}

// ONE BUTTON, AND THE FOUR THINGS A BUTTON CAN BE.
//
//   main     filled. One per box. The thing you came here to do.
//   (plain)  outlined in the same colour. Everything else.
//   waiting  there, but not earned yet - the client cannot agree to a BC that
//            has not been sent. Fabio was clear that these do not disappear:
//            "I do not want to lose functionality."
//   disabled genuinely not available.
export function Act({ tone = 'plain', main, small, waiting, icon, children, ...rest }: {
  tone?: Tone
  main?: boolean
  small?: boolean
  waiting?: boolean
  icon?: ReactNode
  children: ReactNode
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'>) {
  return (
    <button {...rest} type={rest.type || 'button'} className="bt"
      data-main={main ? '' : undefined}
      data-small={small ? '' : undefined}
      data-waiting={waiting ? '' : undefined}
      style={{ ['--c' as any]: ACCENT[tone] }}>
      {icon}{children}
    </button>
  )
}

// A COUNT, BESIDE THE BOX'S BUTTON. deal-page-stages.html puts the number on
// the head rather than in the body, so the rail can be read down the side
// without opening anything.
export function Pill({ children, hot }: { children: ReactNode; hot?: boolean }) {
  return (
    <span className={`inline-flex items-center h-[18px] text-[9.5px] font-bold rounded-full px-2
      border ${hot ? 'bg-chase-bg border-chase-edge text-chase'
                   : 'bg-page border-card-line text-faint'}`}>{children}</span>
  )
}

// A FACT ABOUT THE DEAL: a label, the answer, and the way to change it.
//
// deal-page-stages.html. These were chips - a grey pill reading "BROKER Fabio
// de Castro", a red one reading "CREDIT Nobody assigned", a blue one for the
// scenario - all on one wrapping line, each a different colour, and a loud
// blue button in the middle of them. Fabio, 16 Nov 2026, with the mock beside
// the real page: "look how far are we from the mock up!"
//
// A row. A label the same width every time, so the answers line up and the eye
// runs down them. Whatever changes it sits on the right, in the same blue,
// every row.
export function KV({ label, children, end, tone }: {
  label: string
  children: ReactNode
  end?: ReactNode
  /** 'missing' is for an answer that is not there yet and should be. */
  tone?: 'missing'
}) {
  return (
    <div className="flex items-baseline gap-3 py-[7px] text-[13px] border-t border-line first:border-t-0">
      <span className="text-[9px] font-extrabold tracking-[.11em] uppercase text-faint
                       w-[104px] shrink-0 leading-[1.35]">{label}</span>
      <span className={`min-w-0 flex-1 ${tone === 'missing' ? 'text-chase font-semibold' : 'text-ink'}`}>
        {children}
      </span>
      {end && <span className="shrink-0 text-[11.5px] font-[650] text-info">{end}</span>}
    </div>
  )
}

// A ROW INSIDE A BOX: a label on the left, something to press on the right.
export function BubbleRow({ children, end }: { children: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[12px] text-muted py-1.5
                    border-t border-line-soft first:border-t-0">
      {children}
      {end && <span className="ml-auto">{end}</span>}
    </div>
  )
}

// The line under a heading that says what the box is for. Grey, small, and the
// reason nobody has to be told twice what Sales notes is.
export function BubbleWhy({ children }: { children: ReactNode }) {
  return <p className="text-[11.5px] text-faint leading-[1.6] m-0">{children}</p>
}
