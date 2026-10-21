'use client'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { buildDownloadAndFile } from '@/lib/filing-a-document'
import {
  thereIsAPurchase, purchaseHandoverPath, purchaseHandoverName,
} from '@/lib/the-purchase-handover'
import { applicantNamesOf, purchaseHandover } from '@/lib/purchase-handover'

// THE PURCHASE HANDOVER, BUILT WHERE IT IS WANTED.
//
// Fabio, 21 Oct 2026, asked where the button should go: at the end of the offer
// accepted step, or on the screen that sends the client email.
//
// NEITHER, QUITE. It sits inside "Telling the lender", which already says to
// resubmit in AOL and upload the documents there. This is one of those
// documents. At the bottom of the panel it is a loose button; here it is the
// next line of a list somebody is already working through.
//
// NOT ON THE EMAIL SCREEN. That email goes to the client. This page holds the
// lender's submission notes and the client's whole purchase, and the client
// should never see it. Put the two on one screen and one day somebody attaches
// it.
//
// AND AGAIN FROM THE DOCUMENTS LIST. He asked for both - see DealDocuments,
// where the same route is pressed from above the tabs so nobody has to come
// back to this step a month later.
//
// IT WRITES NOTHING TO THE DEAL. No tick comes off, no compliance box is
// rewritten. That was my first answer and he was right to stop it.

export default function PurchaseHandover({ deal }: { deal: any }) {
  const supabase = createSupabaseBrowser()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')

  // NO PRICE PAID, NO DOCUMENT AND NO BUTTON. Every other gap on the page
  // prints as not recorded; this one is the fact that makes the page possible.
  if (!thereIsAPurchase(deal)) return null

  const gaps = purchaseHandover(deal).stillToRecord

  async function build() {
    setBusy(true); setErr(''); setNote('')
    const problem = await buildDownloadAndFile(supabase, {
      route: '/api/generate-purchase-handover-pdf',
      dealId: deal.id,
      // ITS OWN PATH. Fabio: "remenr this is a new docuemtn on document tabs do
      // not delete old handover." The handover sits at <id>/compliance.pdf and
      // nothing here goes near it.
      filePath: purchaseHandoverPath(deal.id),
      fallbackName: purchaseHandoverName(applicantNamesOf(deal), deal.deal_name),
      called: 'The purchase handover',
    })
    if (problem) setErr(problem)
    else setNote('Downloaded, and filed on the deal beside the handover.')
    setBusy(false)
  }

  return (
    <div className="mt-2.5 rounded-lg border border-info-edge bg-info-bg px-3.5 py-3">
      <div className="text-[12.5px] font-semibold text-info">Purchase handover</div>
      <p className="m-0 mt-1 mb-2.5 text-[11.5px] text-[#0B5F7D] leading-relaxed">
        The purchase as it actually is, on one page, with the submission notes the bank reads.
        A separate document — the handover stays as the position this file was assessed on.
      </p>
      <button type="button" onClick={build} disabled={busy}
        className="rounded-lg bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-page disabled:opacity-50">
        {busy ? 'Building…' : 'Build the purchase handover'}
      </button>
      {/* WHAT WILL PRINT AS NOT RECORDED, BEFORE SOMEBODY SENDS IT ON. The page
          never guesses, so a gap is survivable - but finding out from a
          settlements person is not. */}
      {gaps.length > 0 && (
        <p className="m-0 mt-2 text-[11.5px] text-[#0B5F7D] leading-relaxed">
          Will print as not recorded: {gaps.join(', ')}.
        </p>
      )}
      {note && <p className="m-0 mt-2 text-[11.5px] text-done">{note}</p>}
      {err && <p className="m-0 mt-2 text-[11.5px] text-chase">{err}</p>}
    </div>
  )
}
