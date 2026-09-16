"use client"
import { draftWhen, type Draft } from '@/lib/draft-store'

// WORK THIS BROWSER HAS THAT THE DATABASE DOES NOT.
//
// Offered, never applied. The portal does not decide for somebody which version
// of their own sentence they meant - it says what it has, when it was typed, and
// waits. Nothing here writes to the database either: taking the draft puts it on
// screen, and the ordinary autosave does the rest, through every guard it always
// goes through.
export default function DraftBanner({ at, onRestore, onDiscard }: {
  at: number
  onRestore: () => void
  onDiscard: () => void
}) {
  return (
    <div className="mb-4 flex items-start gap-3 bg-amber-50 border-2 border-amber-400 rounded-xl px-4 py-3">
      <span className="text-amber-500 text-base leading-none mt-0.5">&#9888;</span>
      <div className="flex-1">
        <div className="text-xs font-semibold text-amber-800">
          Unsaved work from this computer, {draftWhen(at)}
        </div>
        <div className="text-xs text-amber-700 leading-relaxed mt-0.5">
          It never reached the database &mdash; the connection dropped, or the tab closed before the
          save went through. Nothing on screen has been changed.
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={onRestore}
            className="text-xs font-semibold bg-[#2DBEFF] text-[#343333] rounded-lg px-3 py-1.5">
            Put it back on screen
          </button>
          <button onClick={onDiscard}
            className="text-xs font-medium border border-amber-300 text-amber-800 rounded-lg px-3 py-1.5 hover:bg-amber-100">
            Discard it
          </button>
        </div>
      </div>
    </div>
  )
}
