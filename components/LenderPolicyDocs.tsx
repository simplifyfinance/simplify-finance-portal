'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { isGettingOld, daysSince, citation, cleanProposed } from '@/lib/policy-rules'
import { kindOf, tierFor } from '@/lib/dropped-files'

// THE LENDERS' OWN WRITTEN POLICY.
//
// 13 Oct 2026, phase two. Two screens in one place, because they answer two
// different questions.
//
//   the list of lenders  - which banks Paco can say nothing for
//   one lender          - its documents, and what was read out of them
//
// UPLOADING HAPPENS ON THE LENDER, NEVER ON THE LIST. A document belongs to one
// bank. Uploading from a list means choosing the bank from a dropdown, and that
// is the one step that goes wrong silently - Macquarie's manual filed under
// Bankwest has Paco quoting the wrong bank with a real page number beside it,
// which reads as more trustworthy than a guess.

type Lender = { id: string; name: string; active?: boolean }
type Doc = {
  id: string; lender_id: string; title: string; file_path: string; file_name: string
  pages: number | null; uploaded_by_name: string; created_at: string
  supersedes: string | null; last_checked_at: string
}
type Rule = {
  id: string; document_id: string; lender_id: string; says: string; quote: string
  section: string; heading: string; status: string; created_at: string
  row_headers: string[]; row_cells: string[]; depends_on: string[]; excludes: string[]
  max_lvr: number | null; min_value: number | null; max_value: number | null
}

const today = () => new Date().toISOString().slice(0, 10)
const when = (s: any) => {
  const d = new Date(String(s || ''))
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const CARD = 'bg-card border border-card-line rounded-xl overflow-hidden mb-3'
const HEAD = 'flex items-center gap-2.5 px-4 py-3 border-b border-line-soft flex-wrap'
const ROW = 'flex items-center gap-3 py-2.5 border-t border-line-soft flex-wrap first:border-t-0'
const BTN = 'text-[12px] border border-card-line bg-card rounded-lg px-2.5 py-[5px] text-body hover:bg-page transition'
const PILL = 'text-[10.5px] font-semibold rounded-full px-2.5 py-[3px] whitespace-nowrap'

export default function LenderPolicyDocs() {
  const supabase = createSupabaseBrowser()
  const [lenders, setLenders] = useState<Lender[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [open, setOpen] = useState('')          // which lender is open
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)

  async function load() {
    const [a, b, c] = await Promise.all([
      supabase.from('lenders').select('id, name, active').order('name'),
      supabase.from('lender_documents').select('*').order('created_at', { ascending: false }),
      supabase.from('lender_policy_rules').select('id, document_id, lender_id, says, quote, section, heading, status, created_at, row_headers, row_cells, depends_on, excludes, max_lvr, min_value, max_value'),
    ])
    setLenders(((a.data || []) as Lender[]).filter(l => l.active !== false))
    // The table not existing yet is not an error worth shouting about - the SQL
    // is run by hand, staging then live, and the page should say so quietly.
    if (b.error) { setErr('The policy documents table is not set up yet. Run docs/lender-documents-schema.sql in Supabase.'); return }
    setDocs((b.data || []) as Doc[])
    setRules((c.data || []) as Rule[])
  }
  useEffect(() => { load() }, [])

  const docsFor = (id: string) => docs.filter(d => d.lender_id === id)
  const currentDoc = (id: string) => docsFor(id).find(d => !docs.some(x => x.supersedes === d.id))
  const rulesFor = (docId: string, status: string) =>
    rules.filter(r => r.document_id === docId && r.status === status)

  // --- putting one in ------------------------------------------------------
  //
  // The original is stored first and hashed, THEN read. If the reading fails
  // the document is still on file and can be read again; if it were the other
  // way round a failed reading would lose the upload.
  async function addDocument(lender: Lender, file: File) {
    setErr(''); setNote(''); setBusy(lender.id)
    try {
      const { data: me } = await supabase.auth.getUser()
      const uid = me?.user?.id
      if (!uid) { setErr('You are not signed in.'); return }

      const buf = await file.arrayBuffer()
      const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)))
        .map(b => b.toString(16).padStart(2, '0')).join('')

      // THE ORIGINAL GOES IN FIRST, WHOLE AND HASHED - the zip itself, not just
      // what came out of it. "What did we actually receive" has to stay
      // answerable, and it is the only copy nobody has interpreted.
      const path = `${lender.id}/${sha.slice(0, 16)}-${file.name.replace(/[^\w.\-]+/g, '_')}`
      const up = await supabase.storage.from('lender-documents')
        .upload(path, file, { upsert: false })
      if (up.error && !String(up.error.message).toLowerCase().includes('exists')) {
        setErr(`That document was not filed — ${up.error.message}`); return
      }

      // THEN IT IS OPENED. A PDF is one part; a zip is many; a spreadsheet is
      // its sheets; an email is its message and its attachments.
      setNote('Filed. Opening it…')
      const form = new FormData()
      form.append('file', file)
      const ex = await fetch('/api/expand-drop', { method: 'POST', body: form })
      const opened = await ex.json()
      if (!ex.ok) { setErr(opened?.error || 'That file could not be opened.'); await load(); return }

      const parts: any[] = Array.isArray(opened?.parts) ? opened.parts : []
      const skipped: any[] = Array.isArray(opened?.skipped) ? opened.skipped : []
      if (parts.length === 0) {
        setErr('Nothing in that file could be read.' +
          (skipped.length ? ` ${skipped.length} left out.` : '')); await load(); return
      }

      const prev = currentDoc(lender.id)
      const byName = kindOf(file.name)
      let read = 0, kept = 0, left = 0

      for (const [i, part] of parts.entries()) {
        const { data: row, error } = await supabase.from('lender_documents').insert({
          lender_id: lender.id,
          title: String(part.name || file.name).replace(/\.[^.]+$/, ''),
          file_path: path, file_name: file.name, sha256: sha,
          uploaded_by: uid,
          uploaded_by_name: (me?.user?.user_metadata as any)?.full_name || me?.user?.email || '',
          // Only the first part supersedes what was there - the rest are its
          // brothers and sisters, not twelve replacements of each other.
          supersedes: i === 0 ? (prev?.id || null) : null,
        }).select().single()
        if (error) { setErr(`Filed, but not recorded — ${error.message}`); await load(); return }

        const got = await readPart(row as Doc, part, lender,
                                  tierFor(part.insideAnEmail ? 'email' : byName, !!part.insideAnEmail))
        read += got.read; kept += got.kept; left += got.left
      }

      setNote(
        `${parts.length} ${parts.length === 1 ? 'part' : 'parts'} opened, ${kept} rules read out` +
        (left ? `, ${left} left out because they could not quote the document` : '') +
        (skipped.length ? `. ${skipped.length} file${skipped.length === 1 ? '' : 's'} in the zip were not opened: ${skipped.map((x: any) => `${x.name} (${x.why})`).join('; ')}` : '') +
        '. Check them below.')
      setOpen(lender.id)
      await load()
    } finally { setBusy('') }
  }

  async function readPart(doc: Doc, part: any, lender: Lender, tier: string) {
    const res = await fetch('/api/extract-policy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        documentId: doc.id, lenderId: lender.id,
        base64: part.base64 || '', text: part.text || '',
      }),
    })
    const j = await res.json()
    if (!res.ok) return { read: 0, kept: 0, left: 0 }

    // SECOND PASS THROUGH THE SAME GATE. The route already dropped anything
    // that could not quote; doing it again costs nothing and means a future
    // caller cannot get round it by posting rows straight in.
    const { rules: clean, dropped } = cleanProposed(j?.rules, doc.id, lender.id)
    if (clean.length === 0) return { read: 0, kept: 0, left: dropped.length }

    const { error } = await supabase.from('lender_policy_rules').insert(clean.map(r => ({
      document_id: r.documentId, lender_id: r.lenderId, says: r.says, quote: r.quote,
      section: r.section, heading: r.heading, tags: r.tags,
      // THE TIER COMES FROM WHERE IT ARRIVED, never from what it says. An email
      // is an update, a manual is policy, a spreadsheet is indicative.
      tier,
      row_headers: r.rowHeaders, row_cells: r.rowCells, depends_on: r.dependsOn,
      excludes: r.excludes, max_lvr: r.maxLvr, min_value: r.minValue, max_value: r.maxValue,
      effective_from: r.effectiveFrom, status: 'proposed',
    })))
    if (error) return { read: 0, kept: 0, left: dropped.length }
    return { read: 1, kept: clean.length, left: dropped.length }
  }

  async function decide(r: Rule, keep: boolean) {
    const { data: me } = await supabase.auth.getUser()
    const { error } = await supabase.from('lender_policy_rules').update({
      status: keep ? 'live' : 'rejected',
      decided_by: me?.user?.id || null,
      decided_by_name: (me?.user?.user_metadata as any)?.full_name || me?.user?.email || '',
      decided_at: new Date().toISOString(),
      rejected_why: keep ? '' : 'Not what the document says',
    }).eq('id', r.id)
    if (error) { setErr(error.message); return }
    await load()
  }

  async function openPdf(path: string) {
    const { data, error } = await supabase.storage.from('lender-documents').createSignedUrl(path, 60)
    if (error) { setErr(`That document could not be opened — ${error.message}`); return }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // ------------------------------------------------------------------ views
  const lender = lenders.find(l => l.id === open)

  return (
    <div>
      {err && <p className="mb-3 border border-chase-edge bg-chase-bg rounded-lg px-3 py-2 text-[12.5px] text-chase">{err}</p>}
      {note && <p className="mb-3 border border-info-edge bg-info-bg rounded-lg px-3 py-2 text-[12.5px] text-info">{note}</p>}

      {!lender ? (
        <div className={CARD}>
          <div className={HEAD}>
            <b className="text-[13.5px]">Every lender</b>
            <span className="text-[12px] text-muted">
              {lenders.filter(l => currentDoc(l.id)).length} of {lenders.length} have a document
            </span>
            <button onClick={() => setMissingOnly(v => !v)} className={`ml-auto ${BTN}`}>
              {missingOnly ? 'Show all' : 'Only ones missing a document'}
            </button>
          </div>
          <div className="px-4 pb-1">
            {lenders
              .filter(l => !missingOnly || !currentDoc(l.id))
              .map(l => {
                const d = currentDoc(l.id)
                const live = d ? rulesFor(d.id, 'live').length : 0
                const waiting = d ? rulesFor(d.id, 'proposed').length : 0
                const old = d ? isGettingOld(d.last_checked_at, today()) : false
                return (
                  <div key={l.id} className={ROW}>
                    <span className="text-[13px] font-semibold min-w-[150px]">{l.name}</span>
                    <span className="text-[12px] text-muted">{d ? `${d.title}` : 'no document yet'}</span>
                    {d && <span className="text-[12px] text-faint">filed {when(d.created_at)}</span>}
                    <span className="ml-auto flex items-center gap-2">
                      {waiting > 0 ? (
                        <span className={`${PILL} bg-info-bg text-info border border-info-edge`}>{waiting} waiting to be checked</span>
                      ) : old ? (
                        <span className={`${PILL} bg-chase-bg text-chase border border-chase-edge`}>
                          not checked in {Math.floor((daysSince(d!.last_checked_at, today()) || 0) / 30)} months
                        </span>
                      ) : d ? (
                        <span className={`${PILL} bg-done-bg text-done border border-done-edge`}>{live} rules</span>
                      ) : (
                        <span className={`${PILL} bg-page text-faint border border-card-line`}>answers from our own notes only</span>
                      )}
                      <button onClick={() => setOpen(l.id)} className={BTN}>{d ? 'Open' : 'Add one'}</button>
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      ) : (
        <>
          <button onClick={() => setOpen('')} className={`${BTN} mb-3`}>&larr; All lenders</button>
          <h2 className="text-[19px] font-bold text-ink mb-1">{lender.name}</h2>
          <p className="text-[12.5px] text-muted mb-4">
            Uploading here means the lender is never chosen from a dropdown.
          </p>

          <div className={CARD}>
            <div className={HEAD}>
              <b className="text-[13.5px]">Documents</b>
              <span className="text-[12px] text-muted">kept exactly as supplied, never edited</span>
            </div>
            <div className="px-4 pb-1">
              {docsFor(lender.id).length === 0 && (
                <p className="py-3 text-[12.5px] text-faint">Nothing filed yet.</p>
              )}
              {docsFor(lender.id).map(d => {
                const replaced = docs.some(x => x.supersedes === d.id)
                return (
                  <div key={d.id} className={ROW}>
                    <span className="text-[13px] font-semibold min-w-[150px]">{d.title}</span>
                    <span className="text-[12px] text-muted">
                      filed by {d.uploaded_by_name || 'somebody'}, {when(d.created_at)}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className={`${PILL} ${replaced
                        ? 'bg-page text-faint border border-card-line'
                        : 'bg-done-bg text-done border border-done-edge'}`}>
                        {replaced ? 'replaced — still readable' : `${rulesFor(d.id, 'live').length} rules`}
                      </span>
                      <button onClick={() => openPdf(d.file_path)} className={BTN}>Open the PDF</button>
                    </span>
                  </div>
                )
              })}
            </div>

            <label className="block m-4 border-[1.5px] border-dashed border-info-edge bg-info-bg
                              rounded-xl p-5 text-center cursor-pointer hover:bg-info-bg/70 transition">
              <input type="file" accept=".pdf,.zip,.xlsx,.xlsm,.csv,.eml,.md,.txt" className="hidden"
                disabled={busy === lender.id}
                onChange={e => { const f = e.target.files?.[0]; if (f) addDocument(lender, f); e.currentTarget.value = '' }} />
              <b className="block text-[13px] text-info mb-1">
                {busy === lender.id ? 'Filing and reading it…' : 'Choose a credit manual, a zip, a spreadsheet or an email'}
              </b>
              <span className="text-[12px] text-muted">
                PDF, a zip of chapters, a spreadsheet, or an email you have forwarded.
                The original is kept exactly as it arrived and never changed. Paco quotes it,
                so you can open the thing he took a line from.
              </span>
            </label>
          </div>

          {/* WHAT WAS READ OUT, WAITING ON A PERSON. Nothing here reaches Paco
              until it is ticked - see docs/lender-documents-schema.sql. */}
          {docsFor(lender.id).map(d => {
            const waiting = rulesFor(d.id, 'proposed')
            if (waiting.length === 0) return null
            return (
              <div key={d.id} className={CARD}>
                <div className={HEAD}>
                  <b className="text-[13.5px]">Check what was read out of {d.title}</b>
                  <span className="text-[12px] text-muted">{waiting.length} waiting. Nothing reaches Paco until you keep it.</span>
                </div>
                <div className="px-4 pb-2">
                  {waiting.map(r => (
                    <div key={r.id} className="py-3.5 border-t border-line-soft first:border-t-0">
                      <p className="m-0 mb-1.5 text-[13px] font-semibold text-ink">{r.says}</p>
                      {/* WHAT THE DOCUMENT SAYS. Shown, never obeyed - a credit
                          manual may legitimately contain any words at all.
                          A TABLE ROW IS DRAWN AS A ROW. Squashing NAB's shading
                          table into a sentence loses which number is the 20%
                          and which is the 6 months. */}
                      {(r.row_cells || []).length > 0 ? (
                        <div className="bg-page border-l-[3px] border-info rounded-r-lg px-3 py-2 mb-1.5 overflow-x-auto">
                          <table className="text-[12px] text-body">
                            <tbody>
                              {(r.row_headers || []).map((h, k) => (
                                <tr key={k}>
                                  <td className="pr-4 py-[2px] text-faint whitespace-nowrap align-top">{h}</td>
                                  <td className="py-[2px] align-top">{r.row_cells[k]}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-page border-l-[3px] border-info rounded-r-lg px-3 py-2
                                        text-[12.5px] text-body leading-relaxed mb-1.5">
                          &ldquo;{r.quote}&rdquo;
                        </div>
                      )}
                      {(r.excludes || []).length > 0 && (
                        <ul className="text-[11.5px] text-body mb-1.5 mt-0 pl-5">
                          {r.excludes.map((x, k) => <li key={k}>not {x}</li>)}
                        </ul>
                      )}
                      <div className="text-[11px] text-faint mb-2">
                        {citation(r, d.title)}
                        {(r.depends_on || []).length > 0 && ` — also read ${r.depends_on.join(', ')}`}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => decide(r, true)}
                          className="text-[12px] bg-ink text-page rounded-lg px-3 py-[5px] font-medium">Keep it</button>
                        <button onClick={() => decide(r, false)} className={BTN}>Not what it says</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
