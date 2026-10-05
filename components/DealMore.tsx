'use client'
import { useEffect, useRef, useState } from 'react'

// MORE.
//
// one-inside-the-deal-v4.html keeps the header to the things you reach for on
// every deal and puts the rest behind one word. Fabio, 5 Oct 2026: "more is the
// right move we need to simplify the view so dont want them visible."
//
// NOTHING IN HERE CHANGES WHAT IT DOES. Clone is the same clone, Close deal is
// the same component. They are one click further away and that is the whole
// difference.

export default function DealMore({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)

  // Clicking anywhere else shuts it, and so does Escape. A menu you cannot get
  // out of without picking something is worse than no menu.
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu"
        className="text-xs text-muted bg-page border border-line rounded-[10px] px-3.5 py-2
          hover:bg-line-soft hover:text-ink transition inline-flex items-center gap-1.5">
        More
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={open ? 'M12 10L8 6l-4 4' : 'M4 6l4 4 4-4'} />
        </svg>
      </button>

      {open && (
        <div role="menu" onClick={() => setOpen(false)}
          className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[215px]
            bg-card border border-card-line rounded-xl shadow-lg p-1.5 flex flex-col gap-0.5">
          {children}
        </div>
      )}
    </div>
  )
}
