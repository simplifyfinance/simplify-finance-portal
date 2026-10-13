'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { citation, cleanProposed } from '@/lib/policy-rules'
import { kindOf, tierFor } from '@/lib/dropped-files'
import { whereIsPaco, rungTone, type Standing } from '@/lib/the-ladder'
import { whereFor, sourceLine, REGISTER_CHECKED_ON } from '@/lib/where-the-policy-lives'
import { tidyLink, whyNotALink, nameFromLink, siteOf } from '@/lib/dropped-links'

// THE LENDERS' OWN WRITTEN POLICY.
//
// 13 Oct 2026, phase two. Two screens in one place, because they answer two
// different questions.
//
//   the library  - which banks Paco can say nothing for
//   one lender   - its documents, and what was read out of them
//
// UPLOADING HAPPENS ON THE LENDER, NEVER ON THE LIST. A document belongs to one
// bank. Uploading from a list means choosing the bank from a dropdown, and that
// is the one step that goes wrong silently - Macquarie's manual filed under
// Bankwest has Paco quoting the wrong bank with a real page number beside it,
// which reads as more trustworthy than a guess.
//
// That rule is why the sweep's Police Bank row matters: searching for their
// broker underwriting guidelines returns a real, correctly titled document
// belonging to BankVic. Nothing here reads a bank's name out of a document.
//
// 13 Oct 2026, the afternoon. Fabio watched a twelve chapter zip sit on
// "Filing and reading it…" for four minutes with nothing else on screen, and
// then looked at the 370 lines it produced: "I dont want to confirm
// everythign". Three things changed out of that.
//
//   THE READING SAYS WHERE IT IS UP TO. Chapter seven of twelve, and the
//   documents list fills in as each one lands rather than all at the end.
//
//   A LINK IS A DROP. Macquarie's credit guidelines are a PDF on their
//   website and AMP's whole policy library is web pages. Seven banks can be in
//   the library in an afternoon if the drop zone takes an address.
//
//   THE BADGE SAYS HOW CHECKED HE IS. Per bank, four rungs, and it goes
//   backwards when a new document lands. See lib/the-ladder.ts.

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

const TONE: Record<string, string> = {
  quiet: 'bg-page text-muted border-card-line',
  info: 'bg-info-bg text-info border-info-edge',
  done: 'bg-done-bg text-done border-done-edge',
}

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
  // WHERE THE READING IS UP TO. Null when nothing is being read.
  const [step, setStep] = useState<{ i: number; of: number; name: string } | null>(null)
  const [link, setLink] = useState('')

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
  const rulesOf = (lenderId: string) => rules.filter(r => r.lender_id === lenderId)
  const standingOf = (lenderId: string): Standing =>
    whereIsPaco(docsFor(lenderId), rulesOf(lenderId), today())

  const sha256 = async (data: ArrayBuffer | string): Promise<string> => {
    const buf = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // --- putting one in ------------------------------------------------------
  //
  // The original is stored first and hashed, THEN read. If the reading fails
  // the document is still on file and can be read again; if it were the other
  // way round a failed reading would lose the upload.
  async function addDocument(lender: Lender, file: File) {
    setErr(''); setNote(''); setBusy(lender.id); setStep(null)
    try {
      const { data: me } = await supabase.auth.getUser()
      const uid = me?.user?.id
      if (!uid) { setErr('You are not signed in.'); return }

      const buf = await file.arrayBuffer()
      const sha = await sha256(buf)

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

      await readTheParts(lender, opened, {
        uid,
        byName: (me?.user?.user_metadata as any)?.full_name || me?.user?.email || '',
        path, fileName: file.name, sha, kind: kindOf(file.name),
      })
    } finally { setBusy(''); setStep(null) }
  }

  // A LINK IS A DROP THAT ARRIVED OVER HTTPS.
  //
  // Nothing is uploaded to our storage, because there is nothing of ours to
  // store - the lender is holding the original and the address is how anybody
  // goes back to it. The hash is of what we actually read, which is the thing
  // that has to stay answerable.
  async function addLink(lender: Lender, raw: string) {
    const url = tidyLink(raw)
    const why = whyNotALink(url)
    if (why) { setErr(why); return }

    setErr(''); setNote(''); setBusy(lender.id); setStep(null)
    try {
      const { data: me } = await supabase.auth.getUser()
      const uid = me?.user?.id
      if (!uid) { setErr('You are not signed in.'); return }

      setNote(`Opening ${siteOf(url)}…`)
      const res = await fetch('/api/read-link', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const opened = await res.json()
      if (!res.ok) { setErr(opened?.error || 'That address could not be opened.'); return }

      const first = (opened?.parts || [])?.[0]
      const sha = await sha256(String(first?.base64 || first?.text || url))
      const landed = String(opened?.url || url)

      await readTheParts(lender, opened, {
        uid,
        byName: (me?.user?.user_metadata as any)?.full_name || me?.user?.email || '',
        // THE ADDRESS IS THE PATH. There is no file of ours, and a link that
        // opens the lender's own copy is worth more than a copy of ours that
        // quietly goes out of date.
        path: landed, fileName: landed, sha,
        kind: String(opened?.kind) === 'pdf' ? 'pdf' : 'text',
      })
      setLink('')
    } finally { setBusy(''); setStep(null) }
  }

  // THE PART BOTH WAYS IN SHARE. A file and a link hand back the same shape,
  // so from here on the library does not care how a document arrived.
  async function readTheParts(
    lender: Lender, opened: any,
    from: { uid: string; byName: string; path: string; fileName: string; sha: string; kind: any },
  ) {
    const parts: any[] = Array.isArray(opened?.parts) ? opened.parts : []
    const skipped: any[] = Array.isArray(opened?.skipped) ? opened.skipped : []
    if (parts.length === 0) {
      setErr('Nothing in that could be read.' +
        (skipped.length ? ` ${skipped.length} left out.` : '')); await load(); return
    }

    const prev = currentDoc(lender.id)
    let kept = 0, left = 0, failed = 0

    for (const [i, part] of parts.entries()) {
      // SAY WHERE IT IS UP TO, BEFORE DOING IT. Twelve chapters is twenty
      // minutes, and a spinner with no number on it looks identical to a dead
      // page. This is the fix for the afternoon Fabio spent watching one.
      setStep({ i: i + 1, of: parts.length, name: String(part?.name || '') })

      const { data: row, error } = await supabase.from('lender_documents').insert({
        lender_id: lender.id,
        title: String(part?.name || from.fileName).replace(/\.[^.]+$/, ''),
        file_path: from.path, file_name: from.fileName, sha256: from.sha,
        uploaded_by: from.uid,
        uploaded_by_name: from.byName,
        // Only the first part supersedes what was there - the rest are its
        // brothers and sisters, not twelve replacements of each other.
        supersedes: i === 0 ? (prev?.id || null) : null,
      }).select().single()
      if (error) { setErr(`Filed, but not recorded — ${error.message}`); await load(); return }

      const got = await readPart(row as Doc, part, lender,
                                tierFor(part?.insideAnEmail ? 'email' : from.kind, !!part?.insideAnEmail))
      kept += got.kept; left += got.left
      if (got.read === 0) failed += 1

      // AND LET THE LIST FILL IN AS IT GOES. One refresh per chapter costs
      // nothing beside a full read of one, and it is the difference between
      // watching it work and wondering whether it died.
      await load()
    }

    setNote(
      `${parts.length} ${parts.length === 1 ? 'part' : 'parts'} opened, ${kept} lines read out` +
      (left ? `, ${left} left out because they could not quote the document` : '') +
      (failed ? `. ${failed} could not be read at all and ${failed === 1 ? 'is' : 'are'} on file unread` : '') +
      (skipped.length ? `. ${skipped.length} file${skipped.length === 1 ? '' : 's'} were not opened: ${skipped.map((x: any) => `${x?.name} (${x?.why})`).join('; ')}` : '') +
      '. Check them below.')
    setOpen(lender.id)
    await load()
  }

  async function readPart(doc: Doc, part: any, lender: Lender, tier: string) {
    const res = await fetch('/api/extract-policy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        documentId: doc.id, lenderId: lender.id,
        base64: part?.base64 || '', text: part?.text || '',
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

  // A DOCUMENT WE HOLD OPENS FROM OUR STORAGE. One we read off a lender's own
  // website opens on their website, because theirs is the copy that stays right.
  async function openDocument(path: string) {
    if (/^https?:\/\//i.test(path)) { window.open(path, '_blank'); return }
    const { data, error } = await supabase.storage.from('lender-documents').createSignedUrl(path, 60)
    if (error) { setErr(`That document could not be opened — ${error.message}`); return }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // ------------------------------------------------------------------ views
  const lender = lenders.find(l => l.id === open)
  const shown = lenders.filter(l => !missingOnly || docsFor(l.id).length === 0)

  return (
    <div>
      {err && <p className="mb-3 border border-chase-edge bg-chase-bg rounded-lg px-3 py-2 text-[12.5px] text-chase">{err}</p>}
      {note && <p className="mb-3 border border-info-edge bg-info-bg rounded-lg px-3 py-2 text-[12.5px] text-info">{note}</p>}

      {!lender ? (
        <div className={CARD}>
          <div className={HEAD}>
            <b className="text-[13.5px]">Every lender</b>
            <span className="text-[12px] text-muted">
              {lenders.filter(l => docsFor(l.id).length > 0).length} of {lenders.length} have something on file
            </span>
            <button onClick={() => setMissingOnly(v => !v)} className={`ml-auto ${BTN}`}>
              {missingOnly ? 'Show all' : 'Only ones with nothing on file'}
            </button>
          </div>

          {/* ONE TILE A BANK, AND THE EMPTY ONES SHOW TOO. A library that only
              lists what it has been fed hides the gap, and the gap is the
              thing worth knowing: these are the banks Paco can say nothing
              for. */}
          <div className="p-3 grid gap-2 grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
            {shown.map(l => {
              const s = standingOf(l.id)
              const where = whereFor(l.name)
              const line = sourceLine(where)
              return (
                <button key={l.id} onClick={() => setOpen(l.id)}
                  className={`text-left rounded-xl p-3 border transition hover:bg-page
                    ${s.rung === 'hangar' ? 'border-dashed border-card-line bg-transparent' : 'border-card-line bg-card'}`}>
                  <span className="block text-[12.5px] font-bold text-ink leading-tight mb-1.5">{l.name}</span>
                  <span className={`${PILL} inline-block border ${TONE[rungTone(s.rung)]} mb-1.5`}>{s.label}</span>
                  <span className="block text-[11px] text-muted leading-snug">
                    {s.documents === 0
                      ? (line || 'Nothing on file')
                      : `${s.documents} ${s.documents === 1 ? 'document' : 'documents'}${s.waiting ? `, ${s.waiting} waiting` : ''}`}
                  </span>
                </button>
              )
            })}
          </div>

          {/* WHERE EACH BANK'S POLICY LIVES, AND WHEN SOMEBODY LOOKED. Our own
              note about websites, never a statement of policy, and always
              carrying its date - see lib/where-the-policy-lives.ts. */}
          <p className="px-4 pb-3 text-[11px] text-faint leading-relaxed">
            A bank with nothing on file says where its policy lives, from our own
            sweep of every lender on {when(REGISTER_CHECKED_ON)}. That is a note about
            a website, not something the bank has told us, and websites move.
          </p>
        </div>
      ) : (
        <>
          <button onClick={() => setOpen('')} className={`${BTN} mb-3`}>&larr; The library</button>
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h2 className="text-[19px] font-bold text-ink m-0">{lender.name}</h2>
            <span className={`${PILL} border ${TONE[rungTone(standingOf(lender.id).rung)]}`}>
              {standingOf(lender.id).label}
            </span>
          </div>
          <p className="text-[12.5px] text-muted mb-4">{standingOf(lender.id).why}</p>

          {/* WHAT THE SWEEP FOUND FOR THIS BANK. Shown hardest where it is
              needed most: a bank with nothing on file, where without it the
              page is a dead end. */}
          {(() => {
            const w = whereFor(lender.name)
            if (!w) return null
            return (
              <div className="mb-3 border-l-[3px] border-info bg-info-bg rounded-r-xl px-4 py-3">
                <b className="block text-[12.5px] text-ink mb-1">Where this bank keeps its policy</b>
                <p className="m-0 text-[12.5px] text-body leading-relaxed">{w.what}</p>
                {w.dated && <p className="m-0 mt-1 text-[11.5px] text-muted">The document says: {w.dated}</p>}
                {w.note && <p className="m-0 mt-1 text-[11.5px] text-muted">{w.note}</p>}
                {w.url && (
                  <p className="m-0 mt-1.5 text-[11.5px]">
                    <a href={w.url} target="_blank" rel="noreferrer" className="text-info underline break-all">{w.url}</a>
                  </p>
                )}
                {w.portal && !w.url && <p className="m-0 mt-1 text-[11.5px] text-muted">Log in at {w.portal}.</p>}
                <p className="m-0 mt-1.5 text-[11px] text-faint">
                  Our own check on {when(REGISTER_CHECKED_ON)}, not something the bank has told us.
                </p>
              </div>
            )
          })()}

          <div className={CARD}>
            <div className={HEAD}>
              <b className="text-[13.5px]">Documents</b>
              <span className="text-[12px] text-muted">kept exactly as supplied, never edited</span>
            </div>
            <div className="px-4 pb-1">
              {docsFor(lender.id).length === 0 && !step && (
                <p className="py-3 text-[12.5px] text-faint">Nothing filed yet.</p>
              )}
              {docsFor(lender.id).map(d => {
                const replaced = docs.some(x => x.supersedes === d.id)
                const waiting = rulesFor(d.id, 'proposed').length
                const fromTheWeb = /^https?:\/\//i.test(d.file_path)
                return (
                  <div key={d.id} className={ROW}>
                    <span className="text-[13px] font-semibold min-w-[150px]">{d.title}</span>
                    <span className="text-[12px] text-muted">
                      filed by {d.uploaded_by_name || 'somebody'}, {when(d.created_at)}
                      {fromTheWeb && ` · from ${siteOf(d.file_path)}`}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className={`${PILL} border ${replaced
                        ? 'bg-page text-faint border-card-line'
                        : waiting
                          ? 'bg-info-bg text-info border-info-edge'
                          : 'bg-done-bg text-done border-done-edge'}`}>
                        {replaced ? 'replaced — still readable'
                          : waiting ? `${waiting} waiting`
                          : `${rulesFor(d.id, 'live').length} lines`}
                      </span>
                      <button onClick={() => openDocument(d.file_path)} className={BTN}>
                        {fromTheWeb ? 'Open on their site' : 'Open the document'}
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>

            {/* WHERE THE READING IS UP TO. Chapter seven of twelve, named. */}
            {step && (
              <div className="m-4 border border-info-edge bg-info-bg rounded-xl px-4 py-3">
                <b className="block text-[13px] text-info mb-1">
                  Reading {step.of === 1 ? 'it' : `${step.i} of ${step.of}`}
                  {step.name && ` — ${step.name}`}
                </b>
                <div className="h-1.5 bg-page rounded mb-2 overflow-hidden">
                  <div className="h-full bg-info rounded"
                    style={{ width: `${Math.round((step.i / Math.max(step.of, 1)) * 100)}%` }} />
                </div>
                <span className="block text-[11.5px] text-muted leading-relaxed">
                  Each one is read on its own and saved as it lands, so a bad one does not
                  cost you the rest. Keep this tab open until it finishes.
                </span>
              </div>
            )}

            <label className={`block mx-4 mt-4 border-[1.5px] border-dashed border-info-edge bg-info-bg
                              rounded-xl p-5 text-center transition
                              ${busy === lender.id ? 'opacity-60' : 'cursor-pointer hover:bg-info-bg/70'}`}>
              <input type="file" accept=".pdf,.zip,.xlsx,.xlsm,.csv,.eml,.md,.txt" className="hidden"
                disabled={busy === lender.id}
                onChange={e => { const f = e.target.files?.[0]; if (f) addDocument(lender, f); e.currentTarget.value = '' }} />
              <b className="block text-[13px] text-info mb-1">
                {busy === lender.id ? 'Working on it…' : 'Choose a credit manual, a zip, a spreadsheet or an email'}
              </b>
              <span className="text-[12px] text-muted">
                PDF, a zip of chapters, a spreadsheet, or an email you have forwarded.
                The original is kept exactly as it arrived and never changed. Paco quotes it,
                so you can open the thing he took a line from.
              </span>
            </label>

            {/* OR PASTE THE ADDRESS. Macquarie's guidelines are a PDF on their
                website and AMP's policy library is web pages. Neither is a file
                anybody should have to go and find first. */}
            <div className="m-4 mt-3">
              <b className="block text-[12.5px] text-ink mb-1">Or paste a link to it</b>
              <span className="block text-[11.5px] text-muted mb-2 leading-relaxed">
                A page or a PDF on the lender&rsquo;s own website. We read it once, now, and
                keep the address so anybody can open their copy. Nothing goes looking on its own.
              </span>
              <div className="flex gap-2 flex-wrap">
                <input value={link} onChange={e => setLink(e.target.value)}
                  disabled={busy === lender.id}
                  placeholder="https://"
                  className="flex-1 min-w-[220px] text-[12.5px] border border-line rounded-lg px-3 py-[7px] bg-card text-ink" />
                <button
                  onClick={() => addLink(lender, link)}
                  disabled={busy === lender.id || !link.trim()}
                  className="text-[12px] bg-ink text-page rounded-lg px-3 py-[7px] font-medium disabled:opacity-40">
                  Read it
                </button>
              </div>
              {link.trim() && whyNotALink(link) && (
                <p className="m-0 mt-1.5 text-[11.5px] text-chase">{whyNotALink(link)}</p>
              )}
              {link.trim() && !whyNotALink(link) && (
                <p className="m-0 mt-1.5 text-[11.5px] text-muted">
                  Filing &ldquo;{nameFromLink(link)}&rdquo; from {siteOf(link)} under {lender.name}.
                </p>
              )}
            </div>
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
                                  <td className="py-[2px] align-top">{r.row_cells?.[k]}</td>
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
