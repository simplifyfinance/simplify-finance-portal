'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

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
// GENERATING ALSO FILES IT. Fabio, 29 Sep 2026: "because the push to
// salestrekker is not working cna you ensure that when we geenrate ff handover
// and broker notes they overwritte the ones in fact fin".
//
// Until now the filed copies were only ever rewritten by a push to SalesTrekker.
// With the push not working, a deal could have a correct PDF on screen and a
// months-old one on file, and the one on file is what anybody else opens.
//
// So each button does both: hands you the PDF and replaces the filed copy.
// SAME PATH PER KIND, upserted, exactly as the push does - one current copy per
// deal, not one per press. Fabio, 16 Sep 2026: "I dont need a new one saving
// every time", after Natasha Chapman ended up with the same handover filed nine
// times over.
//
// FILING IS NEVER ALLOWED TO COST YOU THE DOWNLOAD. The file lands in your
// browser first; if the upload then fails you are told, and you still have the
// document. The reverse - a silent upload failure after a clean download - is
// how somebody believes a stale copy has been replaced.

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
  const supabase = createSupabaseBrowser()
  const [busy, setBusy] = useState<Kind | ''>('')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [filed, setFiled] = useState<{ id: string; file_name: string; file_path: string }[]>([])

  // WHAT IS ON FILE, READABLE FROM ANY TAB AND ON A LOCKED DEAL.
  //
  // The deal's document list lives on the Fact Find tab, which a lodged deal
  // disables wholesale - the same trap the three buttons were in. Rather than
  // walk into it a third time, the filed copies are listed here too, where
  // nothing is disabled. The Fact Find list is unchanged and still the place to
  // upload and tidy.
  async function loadFiled() {
    const { data } = await supabase.from('deal_documents')
      .select('id, file_name, file_path').eq('deal_id', deal.id)
      .order('created_at', { ascending: false })
    setFiled((data || []) as any)
  }
  useEffect(() => { loadFiled() }, [deal.id])

  // One current copy per kind, replaced in place. The path decides that, not
  // the name - the name follows the clients and can change.
  async function fileIt(kind: Kind, blob: Blob, name: string) {
    const filePath = `${deal.id}/${kind}.pdf`
    const { error: upErr } = await supabase.storage.from('deal-documents')
      .upload(filePath, blob, { contentType: 'application/pdf', upsert: true })
    if (upErr) { setErr(`Downloaded, but the filed copy was NOT replaced — ${upErr.message}`); return }

    // The row only has to exist once; on every press after the first the file
    // behind it has just been replaced. A second row pointing at the same path
    // is the pile this avoids.
    const { data: already } = await supabase.from('deal_documents')
      .select('id').eq('deal_id', deal.id).eq('file_path', filePath).limit(1)
    if (!already?.length) {
      const { error: recErr } = await supabase.from('deal_documents').insert({
        deal_id: deal.id, file_name: name, file_path: filePath, file_type: 'application/pdf',
      })
      // Uploaded but not listed is a file nobody can find. Said out loud.
      if (recErr) { setErr(`Filed, but it was not added to the list — ${recErr.message}`); return }
    }
    setNote(`${KINDS[kind].label} replaced on file.`)
    loadFiled()
  }

  async function openFiled(path: string) {
    const { data, error } = await supabase.storage.from('deal-documents').createSignedUrl(path, 60)
    if (error) { setErr(`That document could not be opened — ${error.message}`); return }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function download(kind: Kind) {
    setBusy(kind); setErr(''); setNote('')
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
      // You have the document. Now replace the one on file.
      await fileIt(kind, blob, named || `${KINDS[kind].label}.pdf`)
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
        <span className="text-[11px] text-[#C3BDB2]">built from the deal, and the filed copy is replaced</span>
      </div>

      {note && (
        <p className="mt-2 text-[12px] text-[#15803D]">{note}</p>
      )}
      {err && (
        <p className="mt-2 border border-[#E9D2CF] bg-[#FDF3F2] rounded-lg px-3 py-2 text-[12.5px] text-[#8E3A34]">{err}</p>
      )}

      {filed.length > 0 && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-bold tracking-[.07em] uppercase text-[#C3BDB2] mr-1">On file</span>
          {filed.map(f => (
            <button key={f.id} onClick={() => openFiled(f.file_path)}
              className="text-[11.5px] text-[#2DBEFF] hover:underline max-w-[240px] truncate"
              title={f.file_name}>
              {f.file_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
