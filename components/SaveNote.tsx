'use client'
import { useEffect } from 'react'

// SOMETHING HAPPENED THAT YOU DID NOT DO.
//
// One note, three situations, and NONE of them stops anybody working:
//
//   info  somebody else's fields have been folded onto your screen, or they
//         have saved and your screen is a little out of date
//   warn  your save went over the top of theirs - theirs is kept, nothing lost
//
// There is deliberately no red banner and no reload button here any more. The
// version that had them told people they could not save and left them stuck, and
// on 7 Sep 2026 that cost Fabio's team a day. A screen that changes under you
// needs explaining; it does not need permission.
export default function SaveNote({ message, tone, onDismiss }:
  { message: string; tone: 'info' | 'warn'; onDismiss: () => void }) {

  useEffect(() => {
    if (!message) return
    // The louder one stays until it is read and dismissed. The quiet one goes by
    // itself - it is a courtesy, not something to action.
    if (tone === 'warn') return
    const t = setTimeout(onDismiss, 15000)
    return () => clearTimeout(t)
  }, [message, tone])

  if (!message) return null

  const warn = tone === 'warn'
  return (
    <div className={warn
      ? 'border border-[#EBD9BE] bg-[#FDF6EC] rounded-xl px-4 py-3 mb-4 flex items-start gap-3'
      : 'border border-[#2DBEFF] bg-[#2DBEFF]/8 rounded-xl px-4 py-3 mb-4 flex items-start gap-3'}>
      <p className={warn
        ? 'm-0 flex-1 text-[12.5px] leading-[1.6] text-[#6E4E12]'
        : 'm-0 flex-1 text-[12.5px] leading-[1.6] text-[#0B5C7A]'}>{message}</p>
      <button onClick={onDismiss} aria-label="Dismiss"
        className={warn
          ? 'text-[#6E4E12]/60 hover:text-[#6E4E12] text-lg leading-none px-1 -mt-0.5'
          : 'text-[#0B5C7A]/60 hover:text-[#0B5C7A] text-lg leading-none px-1 -mt-0.5'}>
        ×
      </button>
    </div>
  )
}
