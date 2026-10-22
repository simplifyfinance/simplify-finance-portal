'use client'
import { useEffect, useRef, useState } from 'react'

// A BOX YOU CAN MAKE TALLER, AND IT REMEMBERS.
//
// 22 Oct 2026, Fabio, on the three note boxes: "make all 3 moxes bigger" and
// "the ability of increase them mannually".
//
// Internal notes has had this since 5 October - a word in the header, a bar to
// drag, and the height remembered per deal. It was the best thing on the rail
// and the only box that had it. So it is lifted out here and the other two get
// it too, rather than a second copy being written for each.
//
// REMEMBERED PER DEAL AND PER BOX, in this browser only. A deal with a long
// history comes back the way it was left and no other deal is touched.
export function useGrow(key: string, shut: number, tall: number) {
  const [h, setH] = useState<number>(shut)
  const [over, setOver] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)

  // Browser storage can be missing or refuse to answer - a private window, or
  // site data cleared. The box has to draw either way.
  useEffect(() => {
    try {
      const v = Number(window.localStorage.getItem(key))
      if (v >= shut && v <= 1600) setH(v)
    } catch { /* no memory - open at the normal height */ }
  }, [key, shut])

  const remember = (v: number) => {
    setH(v)
    try { window.localStorage.setItem(key, String(v)) } catch { /* nothing to do */ }
  }

  /** Is there anything below the fold? Call it when the content changes. */
  const measure = () => {
    const el = wrap.current
    if (el) setOver(el.scrollHeight > el.clientHeight + 4)
  }

  // Pointer events rather than mouse, so a trackpad and a touchscreen both work.
  const onGrab = (e: React.PointerEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = h
    const clamp = (y: number) => Math.max(shut, Math.min(1600, startH + (y - startY)))
    const move = (ev: PointerEvent) => setH(clamp(ev.clientY))
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      remember(clamp(ev.clientY))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /** The word in the header. One press, the other way. */
  const toggle = () => remember(h > shut ? shut : tall)
  const toggleWord = h > shut ? 'Shorter' : 'Taller'

  return { h, over, wrap, onGrab, toggle, toggleWord, measure, remember }
}
