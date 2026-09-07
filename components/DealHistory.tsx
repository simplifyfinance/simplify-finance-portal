'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { listVersions, describeVersion, type Version } from '@/lib/deal-history'
import { patchDealColumn } from '@/lib/patch-deal-column'

// PUTTING A PREVIOUS VERSION BACK, WITHOUT ASKING ANYBODY.
//
// Every save keeps a copy of what it replaced. Until this existed those copies
// could only be reached by somebody with database access, which made "your work
// is recoverable" true but useless - it still meant messaging Fabio and waiting.
//
// Two named people can open this. See canSeeHistory in lib/permissions.ts.
//
// PUTTING ONE BACK IS ITSELF A SAVE, so the version being replaced is kept too.
// There is no way to make things worse by pressing the button: whatever is on
// screen now becomes the top of this same list.

const TAB_COLUMN: Record<string, string> = {
  FactFind: 'fact_find_data',
  BC: 'bc_data',
  LO: 'lo_data',
  Compliance: 'compliance_data',
}

export default function DealHistory({ dealId, tab, me }:
  { dealId: string; tab: string; me?: { id?: string | null; name?: string | null } }) {
  const supabase = createSupabaseBrowser()
  const column = TAB_COLUMN[tab]
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [problem, setProblem] = useState('')

  // Statements has no single record of its own, so there is nothing to show.
  if (!column) return null

  async function show() {
    setOpen(true)
    setVersions(null)
    setProblem('')
    setVersions(await listVersions(supabase, dealId, column))
  }

  async function putBack(v: Version) {
    setBusy(true)
    setProblem('')
    // Through the same door as every other save: what is on screen right now is
    // kept before this lands, so pressing the button is always reversible.
    const { problem: p } = await patchDealColumn(supabase, dealId, column, () => v.data, null, me)
    setBusy(false)
    if (p) { setProblem(p); return }
    // A real reload rather than trying to push fifty fields onto a live form.
    window.location.reload()
  }

  return (
    <>
      <button onClick={show}
        className="text-[12px] text-gray-400 hover:text-[#2DBEFF] underline underline-offset-2">
        History
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center p-6 overflow-auto"
             onClick={() => !busy && setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-xl mt-16 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h3 className="m-0 text-[15px] font-semibold text-[#2E2A26]">Previous versions of this {tab === 'FactFind' ? 'Fact Find' : tab}</h3>
              <button onClick={() => !busy && setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <p className="mt-0 mb-4 text-[12.5px] text-gray-500 leading-[1.6]">
              A copy is kept every few minutes, and always when a save removes something. Putting one back
              is itself a save — whatever is on screen now will appear at the top of this list, so nothing
              you do here can lose anything.
            </p>

            {problem && <p className="text-[12.5px] text-[#8A3A2E] mb-3">{problem}</p>}

            {versions === null && <p className="text-[12.5px] text-gray-400">Looking…</p>}

            {versions !== null && versions.length === 0 && (
              <p className="text-[12.5px] text-gray-500">
                Nothing kept yet for this tab. Copies start from the first save after 7 September 2026.
              </p>
            )}

            {(versions || []).map(v => (
              <div key={v.id} className="border border-gray-100 rounded-xl px-4 py-3 mb-2 flex items-center gap-3">
                <div className="flex-1 text-[12.5px] text-[#2E2A26]">{describeVersion(v)}</div>
                {confirming === v.id ? (
                  <>
                    <button disabled={busy} onClick={() => putBack(v)}
                      className="bg-[#343333] text-white rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50">
                      {busy ? 'Putting it back…' : 'Yes, put it back'}
                    </button>
                    <button disabled={busy} onClick={() => setConfirming(null)}
                      className="text-[12px] text-gray-400 hover:text-gray-600">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setConfirming(v.id)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#2E2A26] hover:border-[#2DBEFF]">
                    Put this back
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
