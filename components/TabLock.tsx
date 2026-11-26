'use client'
import { useState } from 'react'
import { useBackdropClose } from '@/components/useBackdropClose'
import { canUnlock, unlockNote, reasonIsEnough, TAB_LABEL } from '@/lib/deal-lock'
import { addSystemNote } from '@/components/DealFile'
import SomethingChanged from '@/components/SomethingChanged'

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

export default function TabLock({ locked, lodged, tab, dealId, deal, role, me, onUnlocked,
                                  onRelock, onDealPatched, children }: {
  locked: boolean
  // IS THIS A LODGED DEAL THAT SOMEBODY HAS OPENED?
  //
  // `locked` is already false in two completely different situations: a normal
  // deal that was never locked, and a lodged deal standing open because
  // somebody unlocked it. They looked identical on screen, which is the whole
  // fault below.
  lodged?: boolean
  tab: string
  dealId: string
  // THE WHOLE DEAL, for the fact find's "Something changed" panel below. The
  // lock already knows the deal is lodged; this is what lets it offer the one
  // thing a lodged fact find still has to be able to do. See
  // components/SomethingChanged.tsx.
  deal?: any
  role: string | undefined
  me: { id: string | null; name: string }
  onUnlocked: () => void
  /** Closes it again, now, by hand. */
  onRelock?: () => void
  onDealPatched?: (patch: any) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // ABOVE THE EARLY RETURN, because it is a hook. Both ends of the click have
  // to be on the backdrop - a selection dragged out of a box is not a click
  // outside it. See components/useBackdropClose.ts.
  const backdrop = useBackdropClose(() => setOpen(false))

  // A DEAL THAT IS OPEN SAYS SO, AND SAYS HOW TO CLOSE IT.
  //
  // 26 Nov 2026. Until today the unlock was invisible once it worked: the bar
  // vanished, the form went live, and nothing on the page said this was a
  // lodged deal standing open. It re-locked when you left the deal, silently,
  // and there was no way to close it on purpose.
  //
  // Fabio, after reading three fixes and still not having the one he wanted:
  // "I want to be able to lock and unlock... And then once that's done, how do
  // we know it's locked again?"
  //
  // You could not know. That is the answer, and this is the fix: while it is
  // open you can see it, and one button shuts it.
  //
  // IT IS NOT A WARNING FOR ITS OWN SAKE. Somebody who unlocked a deal to
  // change one figure and then went to lunch has a live form on a file that is
  // with a bank. The bar is how they find that out.
  if (!locked) {
    if (!lodged || !onRelock) return <>{children}</>
    return (
      <div>
        <div className="flex items-center gap-2.5 flex-wrap bg-chase-bg border border-chase-edge
                        rounded-xl px-3 py-2.5 mb-3">
          <span>🔓</span>
          <span className="text-[12px] text-chase font-semibold">
            Unlocked &mdash; this deal is lodged.
          </span>
          <span className="text-[12px] text-muted">
            Everything you change is going on the file.
          </span>
          <button onClick={onRelock}
            className="ml-auto text-[11.5px] font-semibold text-ink border border-line bg-card
                       rounded-lg px-2.5 py-1 hover:bg-page">
            Lock it again
          </button>
        </div>
        {children}
      </div>
    )
  }

  const mayUnlock = canUnlock(role)

  async function unlock() {
    if (!reasonIsEnough(reason)) { setMsg('Say why in a few words - it goes on the file.'); return }
    setBusy(true); setMsg('')
    const { data, error } = await addSystemNote(dealId, unlockNote(reason), me)
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
        <span className="text-[12px] text-muted">
          Read only &mdash; this deal is lodged. Reading it changes nothing.
        </span>
        {mayUnlock ? (
          <button onClick={() => { setOpen(true); setMsg('') }}
            className="ml-auto text-[11.5px] text-muted border border-line bg-card rounded-lg px-2.5 py-1 hover:bg-page">
            Unlock the deal
          </button>
        ) : (
          <span className="ml-auto text-[11.5px] text-faint">
            Ask a broker or an admin, or leave a file note.
          </span>
        )}
      </div>

      {/* AND THE ONE THING A LODGED FACT FIND STILL HAS TO DO.
        *
        * 17 Aug 2026, Ellie: a client moved house during the application. The
        * fact find above is read only and stays that way - it is what the
        * lender was told. The new address goes BESIDE it rather than over it.
        *
        * Out here rather than on the field because the lock is one <fieldset
        * disabled> around everything above, which is why it has never leaked.
        * An exception to that would not stay an exception. */}
      {tab === 'FactFind' && deal && onDealPatched && (
        <SomethingChanged deal={deal} me={me} onDealPatched={onDealPatched} />
      )}

      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 p-6 overflow-y-auto"
             {...backdrop}>
          <div className="bg-card border border-line rounded-2xl px-6 py-5 max-w-[460px] w-full mt-24 shadow-xl"
               onClick={e => e.stopPropagation()}>
            <p className="text-[14px] font-[640] text-ink m-0 mb-1">Unlock this deal</p>
            <p className="text-[12px] text-muted m-0 leading-[1.5]">
              This deal is already with the lender. Say why it needs changing &mdash; it goes on the
              file with your name against it.
            </p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} autoFocus
              className="w-full border border-line rounded-lg px-3 py-2 text-[12.5px] my-3 focus:outline-none focus:border-brand resize-y"
              placeholder="e.g. employer was recorded as the wrong entity" />
            <div className="flex gap-2 items-center">
              <button onClick={unlock} disabled={busy}
                className="text-[12.5px] font-semibold bg-ink text-page rounded-lg px-4 py-2 disabled:opacity-40">
                {busy ? 'Unlocking…' : 'Unlock'}
              </button>
              <button onClick={() => setOpen(false)} className="text-[12.5px] text-faint">Cancel</button>
            </div>
            {msg && <p className="text-[12px] text-[#C4553B] m-0 mt-2.5">{msg}</p>}
            <p className="text-[11px] text-faint m-0 mt-3 leading-[1.45]">
              Unlocks every tab on this deal, and re-locks when you leave it.
            </p>
            <p className="text-[11px] text-faint m-0 mt-1 leading-[1.45]">
              While it is open there is a Lock it again button at the top of the deal.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
