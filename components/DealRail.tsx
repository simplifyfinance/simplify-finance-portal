'use client'
import { useEffect, useRef, useState } from 'react'
import InternalNotes from '@/components/InternalNotes'

// THE RAIL.
//
// one-inside-the-deal-v4.html puts the context down the right of every tab
// instead of stacking it full width above the form. Fabio, 5 Oct 2026, after
// hard refreshing and finding the page looked nothing like the mock: "so what
// was the point of working on all those pages".
//
// Until now Important and File notes were inside the SETTLEMENT grid, which is
// only drawn once a deal is with a lender - so on a Fact Find they were not on
// screen at all - and Internal notes, Documents and the PDFs were full width
// under the form.
//
// NOTHING NEW IS DRAWN HERE. Every box is the component that already drew it.
// This decides where they sit and nothing else.

export function RailCard({ title, action, children, tone }: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  tone?: 'chase'
}) {
  return (
    <div className={`rounded-xl border mb-3 ${
      tone === 'chase' ? 'bg-chase-bg border-chase-edge' : 'bg-card border-card-line'}`}>
      <div className="flex items-center gap-2 px-3.5 pt-3">
        <span className={`text-[9.5px] font-bold tracking-[.09em] uppercase ${
          tone === 'chase' ? 'text-chase' : 'text-faint'}`}>{title}</span>
        {action && <span className="ml-auto text-[11px] font-[650] text-info">{action}</span>}
      </div>
      <div className="px-3.5 pt-2.5 pb-3">{children}</div>
    </div>
  )
}

// INTERNAL NOTES, AND MAKING IT TALLER.
//
// Fabio picked option C on 5 Oct 2026: the words fade where they are cut off, a
// word in the header makes it taller, and the bottom edge can be dragged. The
// fade is the part that earns its place - without it the notes stop mid-sentence
// and nothing says there is more.
//
// The height is remembered per deal, in this browser only. A deal with long
// notes comes back the way it was left and the others are untouched.
const SHUT = 92
const TALL = 320

export function RailNotes({ dealId, initial, meId }: {
  dealId: string; initial?: string; meId?: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [h, setH] = useState<number>(SHUT)
  const [over, setOver] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)
  const key = `one.notes.h.${dealId}`

  // Browser storage can be missing or refuse to answer - a private window, or
  // site data cleared. The box has to draw either way.
  useEffect(() => {
    try {
      const v = Number(window.localStorage.getItem(key))
      if (v >= SHUT && v <= 1200) setH(v)
    } catch { /* no memory - open at the normal height */ }
  }, [key])

  // Is there anything below the fold? A fade over the last line of a short note
  // would be saying there is more when there is not.
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    setOver(el.scrollHeight > el.clientHeight + 4)
  }, [h, initial, editing])

  const remember = (v: number) => {
    setH(v)
    try { window.localStorage.setItem(key, String(v)) } catch { /* nothing to do */ }
  }

  // Pointer events rather than mouse, so a trackpad and a touchscreen both work.
  const onGrab = (e: React.PointerEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = h
    const clamp = (y: number) => Math.max(SHUT, Math.min(1200, startH + (y - startY)))
    const move = (ev: PointerEvent) => setH(clamp(ev.clientY))
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      remember(clamp(ev.clientY))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Editing is the box exactly as it was, with every protection it has - the
  // merge, the version check, the copy that survives a dead tab.
  if (editing) return (
    <div className="mb-3">
      <InternalNotes dealId={dealId} initial={initial} meId={meId} />
      <button onClick={() => setEditing(false)}
        className="mt-1.5 text-[11px] font-[650] text-info">Done</button>
    </div>
  )

  const text = (initial || '').trim()

  return (
    <RailCard title="Internal notes" action={
      <span className="flex items-center gap-3">
        <button onClick={() => setEditing(true)} aria-label="Edit internal notes">Edit</button>
        <button onClick={() => remember(h > SHUT ? SHUT : TALL)}>
          {h > SHUT ? 'Shorter' : 'Taller'}
        </button>
      </span>
    }>
      <div ref={wrap} className="relative overflow-hidden" style={{ maxHeight: h }}>
        {text
          ? text.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="text-[12.5px] leading-[1.6] text-body m-0 mb-2.5 last:mb-0">{para}</p>
            ))
          : <p className="text-[12.5px] text-faint italic m-0">Nothing written yet — what the client told us goes here.</p>}
        {over && text && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-9
            bg-[linear-gradient(to_bottom,transparent,var(--color-card))]" />
        )}
      </div>
      <div onPointerDown={onGrab} title="Drag to make this taller"
        className="mt-2 -mb-1 h-3.5 flex items-center justify-center cursor-ns-resize border-t border-line-soft">
        <span className="w-[26px] h-[3px] rounded-sm bg-line block" />
      </div>
    </RailCard>
  )
}

// THE RAIL ITSELF. The order is the mock's order.
export default function DealRail({ children }: { children: React.ReactNode }) {
  return <aside className="min-w-0">{children}</aside>
}
