'use client'

// THE SHUT LINE OF A FOLD.
//
// 17 Nov 2026. A deal carried three tall coloured slabs above the work. Fabio:
// "just finding the deal cards too busy... is there a way we can make it
// expandable so we only see when we want to?"
//
// AND IT KEEPS ITS COLOUR. The first attempt made every one of them plain and
// he was right about it: "I think you went too far in terms of blending... I
// do like, for example, lending options and doing this. It's all blue and then
// sent to the client." A blue block stays a blue block. It is one line tall
// instead of twelve, and the headline, the count and the age are all still on
// the page, so nothing has to be opened to be known.
//
// See lib/what-folds-away.ts for what the line says and when a fold refuses to
// stay shut.

const TONE = {
  info: {
    box: 'border-info-edge bg-info-bg border-l-[4px] border-l-info',
    title: 'text-info', carat: 'text-info',
    press: 'border-info-edge text-info',
    chip: 'bg-info text-page',
  },
  waiting: {
    box: 'border-waiting-edge bg-waiting-bg border-l-[4px] border-l-waiting',
    title: 'text-waiting', carat: 'text-waiting',
    press: 'border-waiting-edge text-waiting',
    chip: 'bg-waiting text-page',
  },
} as const

export type FoldTone = keyof typeof TONE

export function FoldLine({ tone, title, line, count, onShow, press = 'Show' }: {
  tone: FoldTone
  /** The headline the open block carries. Word for word. */
  title: string
  /** Everything somebody would have opened it to find out. */
  line?: string
  /** "3 of 3", or nothing. */
  count?: string
  onShow: () => void
  press?: string
}) {
  const t = TONE[tone]
  return (
    <div className={`mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-4 py-2.5 ${t.box}`}>
      <span className={`text-[10px] leading-none ${t.carat}`}>&#9654;</span>
      <b className={`text-[12.5px] ${t.title}`}>{title}</b>
      {line && <span className="text-[12px] text-body">{line}</span>}
      {count && (
        <span className={`whitespace-nowrap rounded-full px-2 py-[2px] text-[10.5px] font-bold ${t.chip}`}>
          {count}
        </span>
      )}
      {/* THE PRESS IS ON THE RIGHT AND IT SAYS WHAT IT DOES. A line that opens
          when you click anywhere on it opens by accident all day. */}
      <button type="button" onClick={onShow}
        className={`ml-auto whitespace-nowrap rounded-lg border bg-card px-3 py-1 text-[12px] font-semibold ${t.press}`}>
        {press}
      </button>
    </div>
  )
}

/** The Hide that sits in the open block's own header. */
export function HideIt({ tone, onHide }: { tone: FoldTone; onHide: () => void }) {
  const t = TONE[tone]
  return (
    <button type="button" onClick={onHide}
      className={`ml-auto whitespace-nowrap rounded-lg border bg-card px-3 py-1 text-[12px] font-semibold ${t.press}`}>
      Hide
    </button>
  )
}
