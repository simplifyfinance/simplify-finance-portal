'use client'
import { useState } from 'react'
import { canUnlock, unlockNote, reasonIsEnough, TAB_LABEL } from '@/lib/deal-lock'
import { addSystemNote } from '@/components/DealFile'

// Read only past lodgement.
//
// The tabs were never the risk for READING - clicking one writes only which tab
// you were last on, and the progress bar reads what happened to the deal, never
// which tab is showing. The risk was that they stayed live forms: somebody could
// type into a fact find, or press Generate with AI, on a deal already sitting
// with an assessor.
//
// A real <fieldset disabled> is what does the work. The browser disables every
// input, textarea, select and button inside it, so all five tabs are covered
// without touching five large forms and hoping nothing was missed.

export default function TabLock({ locked, tab, dealId, role, me, onUnlocked, children }: {
  locked: boolean
  tab: string
  dealId: string
  role: string | undefined
  me: { id: string | null; name: string }
  onUnlocked: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  if (!locked) return <>{children}</>

  const mayUnlock = canUnlock(role)

  async function unlock() {
    if (!reasonIsEnough(reason)) { setMsg('Say why in a few words - it goes on the file.'); return }
    setBusy(true); setMsg('')
    const { data, error } = await addSystemNote(dealId, unlockNote(tab, reason), me)
    setBusy(false)
    if (error || !data?.length) {
      // The record is the whole point of the unlock. If it cannot be written,
      // nothing is unlocked - an untraceable edit is worse than a locked tab.
      setMsg('NOT UNLOCKED - the file note could not be saved' + (error ? ': ' + error.message : '.'))
      return
    }
    setOpen(false); setReason('')
    onUnlocked()
  }

  return (
    <div>
      <fieldset disabled className="border-0 p-0 m-0 min-w-0 opacity-[.72]">
        {children}
      </fieldset>

      <div className="flex items-center gap-2.5 flex-wrap bg-[#FCFAF6] border border-[#E5DED2] rounded-xl px-3 py-2.5 mt-3">
        <span>🔒</span>
        <span className="text-[12px] text-[#7A7266]">
          Read only &mdash; this deal is lodged. Reading it changes nothing.
        </span>
        {mayUnlock ? (
          <button onClick={() => { setOpen(true); setMsg('') }}
            className="ml-auto text-[11.5px] text-[#6E665C] border border-[#E8E1D6] bg-white rounded-lg px-2.5 py-1 hover:bg-[#FAF7F2]">
            Unlock to edit
          </button>
        ) : (
          <span className="ml-auto text-[11.5px] text-[#A29889]">
            Ask a broker or an admin, or leave a file note.
          </span>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 p-6 overflow-y-auto"
             onClick={() => setOpen(false)}>
          <div className="bg-white border border-[#E8E1D6] rounded-2xl px-6 py-5 max-w-[460px] w-full mt-24 shadow-xl"
               onClick={e => e.stopPropagation()}>
            <p className="text-[14px] font-[640] text-[#221F1B] m-0 mb-1">Unlock the {TAB_LABEL[tab] || tab}</p>
            <p className="text-[12px] text-[#7A7266] m-0 leading-[1.5]">
              This deal is already with the lender. Say why it needs changing &mdash; it goes on the
              file with your name against it.
            </p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} autoFocus
              className="w-full border border-[#E8E1D6] rounded-lg px-3 py-2 text-[12.5px] my-3 focus:outline-none focus:border-[#2DBEFF] resize-y"
              placeholder="e.g. employer was recorded as the wrong entity" />
            <div className="flex gap-2 items-center">
              <button onClick={unlock} disabled={busy}
                className="text-[12.5px] font-semibold bg-[#343333] text-white rounded-lg px-4 py-2 disabled:opacity-40">
                {busy ? 'Unlocking…' : 'Unlock'}
              </button>
              <button onClick={() => setOpen(false)} className="text-[12.5px] text-[#A29889]">Cancel</button>
            </div>
            {msg && <p className="text-[12px] text-[#C4553B] m-0 mt-2.5">{msg}</p>}
            <p className="text-[11px] text-[#A29889] m-0 mt-3 leading-[1.45]">
              Unlocks this tab only, and re-locks when you leave the deal.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
