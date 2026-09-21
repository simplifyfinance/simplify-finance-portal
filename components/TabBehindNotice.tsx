'use client'
import type { TabBehind } from '@/lib/tab-behind'
import { behindLine } from '@/lib/tab-behind'

// WHAT JUST HAPPENED, SAID ONCE.
//
// This is not a question. By the time it appears the tab has already put the
// saved work back, keeping every box the person had typed in - see
// keepWhatTheyTyped in lib/tab-behind.ts. There is nothing for anybody to
// decide and nothing to get wrong; the strip exists so the screen changing
// under somebody is explained rather than mysterious.
//
// It appears only when the record held materially more than the screen, which
// on a normal day is never.

export default function TabBehindNotice({ behind, savedBy, savedAt, onDismiss }: {
  behind: TabBehind | null
  savedBy?: string | null
  savedAt?: string | null
  onDismiss: () => void
}) {
  if (!behind) return null

  return (
    <div className="mb-3 rounded-lg border border-[#BFE0F2] bg-[#F4FAFE] px-3.5 py-2.5 flex items-start gap-3"
      role="status" data-tab-behind="1">
      <span className="flex-none mt-[1px] w-[17px] h-[17px] rounded-full bg-[#2DBEFF] text-white text-[11px] font-bold flex items-center justify-center">i</span>
      <div className="min-w-[220px] flex-1">
        <div className="text-[12.5px] font-semibold text-[#0E5E86]">
          This tab was behind the deal, and has caught up
        </div>
        <div className="text-[12px] text-[#3B5C6E] leading-relaxed mt-0.5">
          {behindLine(behind, savedBy, savedAt)}
        </div>
      </div>
      <button onClick={onDismiss} aria-label="Dismiss"
        className="flex-none text-[#7A97A8] hover:text-[#3B5C6E] text-[15px] leading-none px-1">
        &times;
      </button>
    </div>
  )
}
