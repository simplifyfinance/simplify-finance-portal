'use client'
import { useState } from 'react'

// THE THREE DOCUMENTS, REACHABLE FROM ANYWHERE ON THE DEAL.
//
// 29 Sep 2026, Fabio: "its msrled as lodged but i cant open pdf".
//
// He could not. The three download buttons lived inside the Compliance tab, and
// a lodged deal wraps that whole tab in a disabled fieldset - which disables
// every button inside it, these included. So the moment a deal was lodged the
// PDFs became unreachable without unlocking the tab and putting a note on the
// file saying you had.
//
// LODGEMENT IS EXACTLY WHEN THEY ARE WANTED. That is when the documents get
// filed into the client's folder. The lock exists to stop somebody TYPING into
// a submitted file - lib/deal-lock.ts says so in its first paragraph, "reading
// them changes nothing and always did". Downloading a PDF is reading. It was
// caught in the net by accident.
//
// So they sit here instead: on the deal, above the tabs, at every stage, locked
// or not. Nothing is unlocked to use them and nothing is recorded, because
// nothing has been changed.
//
// NOTHING HERE TOUCHES STORAGE. Each button asks the route to build the PDF
// from the deal as it stands and hands it to the browser. The copies filed
// against the deal are only ever rewritten by a push to SalesTrekker, which
// overwrites them in place - see app/api/notify-salestrekker/route.ts.

// EVERY LABEL SAYS PDF, AND THAT IS NOT DECORATION.
//
// The first version called them "Fact Find", "Handover" and "Broker Notes". The
// tab row directly underneath has a tab called "Fact Find", so the page then
// had two buttons with the same name - and the browser check caught it within
// the hour: six specs failed with "resolved to 2 elements" because clicking
// "Fact Find" no longer meant one thing.
//
// A person has the same problem the robot did. Two identical buttons a
// centimetre apart, one opening a tab and one downloading a file, is a trap
// whoever built it would fall into themselves. lib/documents-survive-the-lock.ts
// keeps them apart from the tab names from now on.
const KINDS = {
  summary:      { route: '/api/generate-summary-pdf',      label: 'Fact Find PDF' },
  compliance:   { route: '/api/generate-compliance-pdf',   label: 'Handover PDF' },
  broker_notes: { route: '/api/generate-broker-notes-pdf', label: 'Broker Notes PDF' },
} as const

type Kind = keyof typeof KINDS

export default function DealDocuments({ deal }: { deal: any }) {
  const [busy, setBusy] = useState<Kind | ''>('')
  const [err, setErr] = useState('')

  async function download(kind: Kind) {
    setBusy(kind); setErr('')
    try {
      const res = await fetch(KINDS[kind].route, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      })
      if (!res.ok) {
        // Said out loud, with the reason where there is one. An alert that says
        // "could not generate" and nothing else leaves somebody guessing.
        const why = await res.text().catch(() => '')
        setErr(`The ${KINDS[kind].label} PDF could not be built${why ? ` — ${why.slice(0, 160)}` : ''}. Nothing was downloaded.`)
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // The route names the file after the clients - "Fact Find - Lucy Ilbery &
      // Andrew Leigh.pdf" - so its name is used rather than the deal record's.
      const named = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1]
      a.download = named || `${KINDS[kind].label}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setErr(`The ${KINDS[kind].label} PDF could not be built — ${e?.message || 'network error'}. Nothing was downloaded.`)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-bold tracking-[.07em] uppercase text-[#A29889] mr-1">Documents</span>
        {(Object.keys(KINDS) as Kind[]).map(kind => (
          <button key={kind} onClick={() => download(kind)} disabled={!!busy}
            className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-lg px-3 py-1.5 text-[12px] font-medium hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition inline-flex items-center gap-1.5 disabled:opacity-40">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v8M4.5 7l3.5 3.5L11.5 7M3 13h10" />
            </svg>
            {busy === kind ? 'Preparing…' : KINDS[kind].label}
          </button>
        ))}
        <span className="text-[11px] text-[#C3BDB2]">built fresh from the deal &mdash; nothing on file is changed</span>
      </div>
      {err && (
        <p className="mt-2 border border-[#E9D2CF] bg-[#FDF3F2] rounded-lg px-3 py-2 text-[12.5px] text-[#8E3A34]">{err}</p>
      )}
    </div>
  )
}
