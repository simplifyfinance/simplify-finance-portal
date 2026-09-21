'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { canChangeTestFlag, testFlagNote, TEST_DEAL_SUMMARY } from '@/lib/test-deal'
import { addSystemNote } from '@/components/DealFile'

// A BAND ACROSS THE TOP OF EVERY TAB OF A TEST DEAL.
//
// Not a chip in a corner. Somebody opening this deal five weeks from now must
// not see a normal-looking deal and start working it - and somebody who ticked
// the box by mistake on a live deal must be able to find the way back.
//
// Turning it off is admin only, and both directions are written onto the file,
// because marking a real deal as a test is how a deal quietly disappears from
// every report there is.

export default function TestDealBand({ deal, userRole, me, onChanged }: {
  deal: any
  userRole: string | undefined
  me: { id: string | null; name: string }
  onChanged: (isTest: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const supabase = createSupabaseBrowser()

  if (deal?.is_test !== true) return null

  async function makeItReal() {
    setBusy(true); setMsg('')
    // Checked. Row level security returns zero rows and no error when it refuses
    // a write, so "no error" is not the same as "it happened".
    const { data, error } = await supabase.from('deals')
      .update({ is_test: false }).eq('id', deal.id).select('id')
    if (error || !data || data.length === 0) {
      setBusy(false)
      setMsg(error?.message || 'The database refused that. It is still a test deal.')
      return
    }
    await addSystemNote(deal.id, testFlagNote(false), me)
    setBusy(false)
    onChanged(false)
  }

  return (
    <div className="mb-4 rounded-xl border border-[#F0DCB4] bg-[#FFF8EC] px-4 py-3">
      <div className="flex items-start gap-3 flex-wrap">
        <span className="flex-none mt-0.5 text-[10.5px] font-bold tracking-[0.09em] text-white bg-[#C6952F] rounded px-2 py-1">
          TEST DEAL
        </span>
        <div className="min-w-[240px] flex-1">
          <div className="text-[13px] font-semibold text-[#7a4a08]">
            This is not a client. Nothing here reaches the business.
          </div>
          <div className="text-[12px] text-[#92400E] mt-0.5 leading-relaxed">
            {TEST_DEAL_SUMMARY}. Everything else works exactly as it does on a real deal,
            and a client email built here is sent to whoever presses send.
          </div>
          {msg && <div className="text-[12px] text-[#B91C1C] mt-1.5">{msg}</div>}
        </div>
        {canChangeTestFlag(userRole) && (
          <button onClick={makeItReal} disabled={busy}
            className="flex-none text-[12px] font-semibold text-[#7a5a12] border border-[#E4D9BE] bg-white rounded-md px-3 py-1.5 hover:bg-[#FFFDF8] disabled:opacity-40">
            {busy ? 'Changing...' : 'Make it a real deal'}
          </button>
        )}
      </div>
    </div>
  )
}
