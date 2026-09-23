"use client"
import { useState } from 'react'
import { downloadAssessment, type Deal } from '@/lib/assessment-download'

// THE FORM, OFFERED AT THE TWO MOMENTS IT IS ACTUALLY SAVED.
//
// Fabio, 23 Sep 2026: "that comes at the same time lost and settled" - the same
// two moments as the client's position, because they are the same job. A deal
// ends, the client's folder gets the position and the paper.
//
// It is an OFFER, never automatic. The download goes to the browser, and a file
// landing in Downloads that nobody asked for is a file nobody files.
export default function SaveTheAssessment({ deal, when }: { deal: Deal; when: 'settled' | 'lost' }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function go() {
    setBusy(true); setErr('')
    const problem = await downloadAssessment(deal)
    setBusy(false)
    if (problem) setErr(problem)
    else setDone(true)
  }

  return (
    <div className="border border-[#E8E1D6] bg-[#FDFCFA] rounded-xl px-3.5 py-3 mb-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="text-[12.5px] font-semibold text-[#3B3B3B]">
            Personal Assessment Form
          </div>
          <div className="text-[11.5px] text-gray-500 leading-relaxed mt-0.5">
            {when === 'settled'
              ? 'The position as it stands at settlement, on the form, for the client’s folder. Every box is still typeable.'
              : 'The position as declared, on the form, for the client’s folder. Every box is still typeable.'}
          </div>
        </div>
        <button onClick={go} disabled={busy}
          className="text-[12px] font-semibold rounded-lg px-3 py-1.5 border border-[#DDE2E6] bg-white text-[#2E3439] hover:bg-[#F6F7F9] disabled:opacity-40">
          {busy ? 'Building...' : done ? 'Download again' : 'Download'}
        </button>
      </div>
      {done && !err && (
        <div className="text-[11.5px] text-[#0F7B4F] mt-2">
          Saved to your downloads. File it in the client&rsquo;s folder.
        </div>
      )}
      {err && <div className="text-[11.5px] text-red-600 mt-2">{err}</div>}
    </div>
  )
}
