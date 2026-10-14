'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { citation, cleanProposed } from '@/lib/policy-rules'
import { splitIntoSections, contextLineFor } from '@/lib/split-into-sections'
import { kindOf, tierFor } from '@/lib/dropped-files'
import { whereIsPaco, rungTone, type Standing } from '@/lib/the-ladder'
import { whereFor, sourceLine, alsoCoveredBy, REGISTER_CHECKED_ON } from '@/lib/where-the-policy-lives'
import { tidyLink, whyNotALink, nameFromLink, siteOf } from '@/lib/dropped-links'
import { flat } from '@/lib/plain-words'

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
type Note = { id: string; lender: string; retired_at: string | null }
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
  waiting: 'bg-waiting-bg text-waiting border-waiting-edge',
  info: 'bg-info-bg text-info border-info-edge',
  done: 'bg-done-bg text-done border-done-edge',
}
// The tile itself picks the colour up quietly, so a wall of them reads at a
// glance without forty saturated cards shouting at once.
const TILE: Record<string, string> = {
  quiet: 'border-dashed border-card-line bg-transparent',
  waiting: 'border-card-waiting-edge bg-card-waiting',
  info: 'border-info-edge bg-info-bg',
  done: 'border-card-done-edge bg-card-done',
}

export default function LenderPolicyDocs() {
  const supabase = createSupabaseBrowser()
  const [lenders, setLenders] = useState<Lender[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [open, setOpen] = useState('')          // which lender is open
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  // WHERE THE READING IS UP TO. Null when nothing is being read.
  const [step, setStep] = useState<{ i: number; of: number; name: string } | null>(null)
  const [link, setLink] = useState('')
  // Whether a file is being dragged over the box right now.
  const [overIt, setOverIt] = useState(false)
  // Whether to file this under the other brands the same policy covers.
  const [alsoAlso, setAlsoAlso] = useState(true)

  async function load() {
    const [a, b, c, d] = await Promise.all([
      supabase.from('lenders').select('id, name, active').order('name'),
      supabase.from('lender_documents').select('*').order('created_at', { ascending: false }),
      supabase.from('lender_policy_rules').select('id, document_id, lender_id, says, quote, section, heading, status, created_at, row_headers, row_cells, depends_on, excludes, max_lvr, min_value, max_value'),
      // WHAT THE TEAM HAS TOLD HIM. The other half of what Paco can answer
      // from, and the half that grows every week without anybody uploading
      // anything. A bank with notes and no manual is not a bank with nothing.
      supabase.from('paco_knowledge').select('id, lender, retired_at'),
    ])
    setLenders(((a.data || []) as Lender[]).filter(l => l.active !== false))
    // The table not existing yet is not an error worth shouting about - the SQL
    // is run by hand, staging then live, and the page should say so quietly.
    if (b.error) { setErr('The policy documents table is not set up yet. Run docs/lender-documents-schema.sql in Supabase.'); return }
    setDocs((b.data || []) as Doc[])
    setRules((c.data || []) as Rule[])
    // His notebook not existing yet is not a fault worth shouting about.
    setNotes(((d.data || []) as Note[]))
  }
  useEffect(() => { load() }, [])

  const docsFor = (id: string) => docs.filter(d => d.lender_id === id)
  const currentDoc = (id: string) => docsFor(id).find(d => !docs.some(x => x.supersedes === d.id))
  const rulesFor = (docId: string, status: string) =>
    rules.filter(r => r.document_id === docId && r.status === status)
  const rulesOf = (lenderId: string) => rules.filter(r => r.lender_id === lenderId)
  // WHAT THE TEAM HAS TOLD HIM ABOUT THIS BANK. Matched on the name, because
  // a note is typed against a lender by name rather than picked from a list.
  const notesOf = (name: string) => {
    const want = flat(name)
    return want ? notes.filter(n => flat(n.lender) === want) : []
  }
  // The other banks on our list that a document filed here also covers.
  const lendersCoveredWith = (l: Lender): Lender[] => {
    const names = alsoCoveredBy(l.name).map(flat)
    return names.length === 0 ? []
      : lenders.filter(x => x.id !== l.id && names.includes(flat(x.name)))
  }
  const standingOf = (l: Lender): Standing =>
    whereIsPaco(docsFor(l.id), rulesOf(l.id), notesOf(l.name))

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
    // The other banks this same document covers, as lenders we actually hold.
    const alsoFile = alsoAlso ? lendersCoveredWith(lender) : []
    let kept = 0, left = 0, failed = 0, ranOutOn = 0
    let wordsOn = 0, sectionsOn = 0
    const whyFailed: string[] = []

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
      if (got.words) wordsOn += 1
      sectionsOn += got.sections || 0
      // THE WORDS AND THE SECTIONS FAIL SEPARATELY FROM THE RULES, and are
      // said separately, because "0 lines" meaning six different things is the
      // thing that cost a day.
      if (got.whyWords) whyFailed.push(`${part?.name || 'it'} — the words: ${got.whyWords}`)
      else if (got.whySections) whyFailed.push(`${part?.name || 'it'} — the sections: ${got.whySections}`)
      if (got.read === 0) { failed += 1; if (got.why) whyFailed.push(`${part?.name || 'it'} — the rules: ${got.why}`) }
      if (got.ranOut) ranOutOn += 1

      // ONE DOCUMENT, FOUR BANKS.
      //
      // 13 Oct 2026. Westpac Group's credit policy is one document covering
      // Westpac, St George, Bank of Melbourne and BankSA. MyState's covers
      // Auswide and says so on its face. Dropping it once per brand means
      // reading the same 25 sections four times and then holding four copies
      // of the same rules to correct separately.
      //
      // So it is read ONCE and the lines are copied across, each against its
      // own bank with its own document row. The copies carry the same quote
      // and the same section, because they came out of the same sentence.
      for (const other of alsoFile) {
        const { data: twin } = await supabase.from('lender_documents').insert({
          lender_id: other.id,
          title: String(part?.name || from.fileName).replace(/\.[^.]+$/, ''),
          file_path: from.path, file_name: from.fileName, sha256: from.sha,
          uploaded_by: from.uid, uploaded_by_name: from.byName, supersedes: null,
        }).select().single()
        if (!twin || got.rows.length === 0) continue
        // CHECKED, because a silent failure here is the worst kind: the screen
        // says St George is filed, the tile says St George is filed, and Paco
        // has nothing for St George.
        const { data: copied } = await supabase.from('lender_policy_rules').insert(
          got.rows.map(r => ({ ...r, lender_id: other.id, document_id: (twin as any).id }))).select('id')
        if (!copied || copied.length === 0) {
          failed += 1
          whyFailed.push(`${other.name} — the copy was refused, nothing was filed under it`)
        }

        // AND THE SECTIONS, because one document covering four brands should
        // be quotable under all four. Same run id, its own document row, and
        // the pointer moves last here too.
        if (got.secRows.length > 0) {
          const twinId = (twin as any).id
          const mine = got.secRows.map((r: any) => ({ ...r, lender_id: other.id, document_id: twinId }))
          let put = 0
          for (let k = 0; k < mine.length; k += 100) {
            const { data: w } = await supabase.from('lender_policy_sections')
              .insert(mine.slice(k, k + 100)).select('id')
            if (!w) break
            put += w.length
          }
          if (put === mine.length) {
            const { data: f } = await supabase.from('lender_documents')
              .update({ current_read: mine[0].read_run, sectioned_at: new Date().toISOString() })
              .eq('id', twinId).select('id')
            if (!f || f.length === 0) whyFailed.push(`${other.name} — its sections saved but it would not point at them`)
            else sectionsOn += put
          } else {
            whyFailed.push(`${other.name} — only ${put} of ${mine.length} sections copied`)
          }
        }
      }

      // AND LET THE LIST FILL IN AS IT GOES. One refresh per chapter costs
      // nothing beside a full read of one, and it is the difference between
      // watching it work and wondering whether it died.
      await load()
    }

    // WHAT ACTUALLY HAPPENED, IN THE ORDER IT HAPPENED.
    //
    // 13 Oct 2026. This used to lead with a line count, which was the one
    // number that could be zero for six unrelated reasons. It now says the
    // three steps separately, because "the words are stored but it would not
    // come apart into sections" and "nothing happened at all" are completely
    // different situations and used to look identical.
    const steps = [
      wordsOn
        ? `the words are stored for ${wordsOn} of ${parts.length}`
        : 'no words could be stored',
      sectionsOn
        ? `${sectionsOn} section${sectionsOn === 1 ? '' : 's'} to quote from`
        : 'nothing came apart into sections, so Paco can only search the words',
      `${kept} rule${kept === 1 ? '' : 's'} read out`,
    ]

    const say = (
      `${parts.length} ${parts.length === 1 ? 'part' : 'parts'} opened. ${steps.join(', ')}` +
      (left ? `, ${left} left out because they could not quote the document` : '') +
      (failed || whyFailed.length ? `. What went wrong: ${whyFailed.slice(0, 3).join('; ')}` : '') +
      (skipped.length ? `. ${skipped.length} file${skipped.length === 1 ? '' : 's'} were not opened: ${skipped.map((x: any) => `${x?.name} (${x?.why})`).join('; ')}` : '') +
      // THE ANSWER TO "HOW DO I KNOW THIS BANK IS DONE". A document bigger
      // than the reader can answer in one go is not finished, and nothing on
      // screen said so.
      (ranOutOn ? `. There is more in ${ranOutOn === 1 ? 'it' : `${ranOutOn} of them`} than came back — what is here is real, it is just not all of it` : '') +
      '. Check them below.')
    if (kept === 0 && sectionsOn === 0 && wordsOn === 0) setErr(say); else setNote(say)
    setOpen(lender.id)
    await load()
  }

  // THE THREE STEPS, IN THIS ORDER, AND THE ORDER IS THE POINT.
  //
  // 13 Oct 2026. Macquarie's guidelines were uploaded, hashed and sitting in
  // the bucket, complete, and Paco could not read one line of them - because
  // one model call tried to carve the whole document into hundreds of rules,
  // ran out of room, and everything downstream depended on it having worked.
  //
  //   1. the words are stored, and THAT is what "filed" means
  //   2. the document is split into the sections the lender already wrote
  //   3. rules are read out of it
  //
  // Each step reports its own failure and none of them can undo the one
  // before. A document that reaches step 1 is searchable by its words. One
  // that reaches step 2 is quotable by section. Neither can be taken away by
  // step 3 going wrong, which is the whole difference from yesterday.
  async function readPart(doc: Doc, part: any, lender: Lender, tier: string) {
    const name = String(part?.name || doc.title || 'Document')

    // ---- STEP ONE: THE WORDS -------------------------------------------
    let words = 0, sections = 0
    let whyWords = '', whySections = ''
    let text = ''
    // Kept so the brands this one policy also covers get the same sections,
    // rather than one document being read four times.
    let secRows: any[] = []
    let secRun = ''
    try {
      const tr = await fetch('/api/document-text', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          base64: part?.base64 || '', text: part?.text || '', fileUrl: part?.fileUrl || '',
        }),
      })
      const tj = await tr.json()
      if (!tr.ok) whyWords = String(tj?.error || `the reader answered ${tr.status}`)
      else {
        text = String(tj?.text || '')
        if (!text.trim()) whyWords = 'there were no words in it'
      }
    } catch (e: any) { whyWords = String(e?.message || e) }

    if (text) {
      // CHECKED. A silent failure here means the tile says filed and Paco has
      // nothing behind it, which is exactly the lie we are removing.
      const { data: stored, error: sErr } = await supabase.from('lender_documents')
        .update({
          body_text: text, body_chars: text.length,
          body_stored_at: new Date().toISOString(), last_read_error: '',
        })
        .eq('id', doc.id).select('id')
      if (sErr || !stored || stored.length === 0) {
        whyWords = sErr?.message || 'the words were read but would not save'
      } else {
        words = text.length

        // ---- STEP TWO: THE SECTIONS --------------------------------------
        //
        // Split in the browser, because lib/split-into-sections is a function
        // of the text and nothing else - no key, no network, nothing to fail
        // halfway. A read is a RUN: every section carries the run it came from
        // and the document only points at it once all of them are written, so
        // a re-read that dies halfway leaves the previous read still answering.
        try {
          const run = crypto.randomUUID()
          secRun = run
          const secs = splitIntoSections(text, name)
          const rows = secs.map(x => ({
            document_id: doc.id, lender_id: lender.id, read_run: run,
            ordinal: x.ordinal, number: x.number, title: x.title, path: x.path,
            part: x.part, body: x.body, chars: x.chars,
            context: contextLineFor(x, lender.name, name),
            tier,
          }))
          let put = 0
          for (let i = 0; i < rows.length; i += 100) {
            const { data: w, error: wErr } = await supabase
              .from('lender_policy_sections').insert(rows.slice(i, i + 100)).select('id')
            if (wErr || !w) { whySections = wErr?.message || 'the sections would not save'; break }
            put += w.length
          }
          // THE POINTER MOVES LAST, or not at all.
          if (!whySections && put > 0 && put === rows.length) {
            const { data: flipped, error: fErr } = await supabase.from('lender_documents')
              .update({ current_read: run, sectioned_at: new Date().toISOString() })
              .eq('id', doc.id).select('id')
            if (fErr || !flipped || flipped.length === 0) {
              whySections = fErr?.message || 'the sections saved but the document would not point at them'
            } else { sections = put; secRows = rows }
          } else if (!whySections) {
            whySections = `only ${put} of ${rows.length} sections saved, so the document still points at the last good read`
          }
        } catch (e: any) { whySections = String(e?.message || e) }
      }
    }

    if (whyWords || whySections) {
      // fire-and-forget: a note ABOUT a failure, kept on the row so a document
      // that went wrong last Tuesday can still say why today. The failure
      // itself is already on screen and already in the return value - if this
      // write is refused, the person has still been told. Failing the whole
      // read because we could not write down why it went wrong would be the
      // tail wagging the dog.
      await supabase.from('lender_documents')
        .update({ last_read_error: (whyWords || whySections).slice(0, 500) })
        .eq('id', doc.id)
    }

    // ---- STEP THREE: THE RULES -----------------------------------------
    const res = await fetch('/api/extract-policy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        documentId: doc.id, lenderId: lender.id,
        base64: part?.base64 || '', text: part?.text || '',
        // A PDF comes back as an address rather than a file - see
        // app/api/read-link/route.ts for why.
        fileUrl: part?.fileUrl || '',
      }),
    })
    const j = await res.json()
    // WHY IT FAILED, ON SCREEN.
    //
    // 13 Oct 2026. This line used to be `return { read: 0 }` and nothing else.
    // Every failure - a document too big to post, a website refusing us, a key
    // missing - arrived on screen as "0 lines" with no reason, and Fabio spent
    // an afternoon re-pressing buttons that were never going to work.
    if (!res.ok) return { read: 0, kept: 0, left: 0, rows: [], ranOut: false, words, sections, whyWords, whySections, secRows, why: String(j?.error || `the reader answered ${res.status}`) }

    // SECOND PASS THROUGH THE SAME GATE. The route already dropped anything
    // that could not quote; doing it again costs nothing and means a future
    // caller cannot get round it by posting rows straight in.
    const { rules: clean, dropped } = cleanProposed(j?.rules, doc.id, lender.id)
    if (clean.length === 0) {
      return { read: 0, kept: 0, left: dropped.length, rows: [], ranOut: !!j?.ranOut,
               words, sections, whyWords, whySections, secRows,
               why: dropped.length ? 'nothing in it could quote the document' : 'nothing was read out of it' }
    }

    const rows = clean.map(r => ({
      document_id: r.documentId, lender_id: r.lenderId, says: r.says, quote: r.quote,
      section: r.section, heading: r.heading, tags: r.tags,
      // THE TIER COMES FROM WHERE IT ARRIVED, never from what it says. An email
      // is an update, a manual is policy, a spreadsheet is indicative.
      tier,
      row_headers: r.rowHeaders, row_cells: r.rowCells, depends_on: r.dependsOn,
      excludes: r.excludes, max_lvr: r.maxLvr, min_value: r.minValue, max_value: r.maxValue,
            // A LINE IS IN THE MOMENT IT IS READ.
      //
      // 13 Oct 2026. These used to land as 'proposed' and wait for somebody to
      // tick them. NAB's policy produced 455 and Fabio, rightly: "a lot of
      // these are statements. Just it really is reading. Like, why do I need to
      // confirm? So that needs to go."
      //
      // The thing that stops a machine's reading being mistaken for the bank's
      // policy was never the tick - it is the quote, which sits under every
      // answer Paco gives. 'rejected' is still here, set the one time it is
      // needed: somebody reads an answer, sees it is wrong, and says so.
      effective_from: r.effectiveFrom, status: 'live',
    }))
    const { error } = await supabase.from('lender_policy_rules').insert(rows)
    if (error) return { read: 0, kept: 0, left: dropped.length, why: error.message, rows: [], ranOut: false, words, sections, whyWords, whySections, secRows }
    return { read: 1, kept: clean.length, left: dropped.length, why: '', rows, ranOut: !!j?.ranOut, words, sections, whyWords, whySections, secRows }
  }


  // READ A DOCUMENT WE ALREADY HOLD, AGAIN.
  //
  // 13 Oct 2026. Five banks sat with a document on file and nothing read out of
  // it: they were filed while PDFs were still being shipped through the browser,
  // the read died on Vercel's request cap, and nothing could have another go.
  // Dropping the file again would have left two copies of the same document.
  //
  // It does not re-file anything. The row, the hash and the original stay
  // exactly as they are - this only runs the reading over again.
  async function readItAgain(doc: Doc, lender: Lender) {
    setErr(''); setNote(''); setBusy(lender.id)
    try {
      const fromTheWeb = /^https?:\/\//i.test(doc.file_path)
      let part: any = null

      if (fromTheWeb) {
        setNote(`Opening ${siteOf(doc.file_path)}…`)
        const res = await fetch('/api/read-link', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: doc.file_path }),
        })
        const opened = await res.json()
        if (!res.ok) { setErr(opened?.error || 'That address could not be opened.'); return }
        part = (opened?.parts || [])?.[0]
      } else {
        // A FILE OF OURS IS READ FROM OUR OWN STORAGE, not asked for again.
        const { data, error } = await supabase.storage.from('lender-documents')
          .createSignedUrl(doc.file_path, 120)
        if (error || !data?.signedUrl) { setErr('That document could not be opened.'); return }
        part = { name: doc.title, kind: 'pdf', fileUrl: data.signedUrl }
      }

      if (!part) { setErr('There was nothing in it to read.'); return }
      setStep({ i: 1, of: 1, name: doc.title })
      const got = await readPart(doc, part, lender, tierFor(kindOf(doc.file_name), false))
      await load()
      if (got.read === 0) setErr(`Still nothing — ${got.why || 'the reader gave no reason'}`)
      else setNote(`${got.kept} lines read out of ${doc.title}.`)
    } finally { setBusy(''); setStep(null) }
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
              {lenders.filter(l => standingOf(l).rung !== 'hangar').length} of {lenders.length} he can say something about
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
              const s = standingOf(l)
              const where = whereFor(l.name)
              const line = sourceLine(where)
              return (
                <button key={l.id} onClick={() => setOpen(l.id)}
                  className={`text-left rounded-xl p-3 border transition hover:brightness-[.98] ${TILE[rungTone(s.rung)]}`}>
                  <span className="block text-[12.5px] font-bold text-ink leading-tight mb-1.5">{l.name}</span>
                  <span className={`${PILL} inline-block border ${TONE[rungTone(s.rung)]} mb-1.5`}>{s.label}</span>
                  {/* WHAT HE CAN ANSWER FROM, not what is waiting on anybody.
                      Nothing on this page asks for a decision any more. */}
                  <span className="block text-[11px] text-muted leading-snug">
                    {s.fromTheBank > 0 && `${s.fromTheBank} ${s.fromTheBank === 1 ? 'line' : 'lines'} from their policy`}
                    {s.fromTheBank > 0 && s.fromUs > 0 && ' · '}
                    {s.fromUs > 0 && `${s.fromUs} from us`}
                    {s.fromTheBank === 0 && s.fromUs === 0 && (line || 'Nothing on file')}
                  </span>
                </button>
              )
            })}
          </div>

          {/* AND FILL THE ONES WE ALREADY HOLD AN ADDRESS FOR, IN ONE GO.
              The register was checked by hand; these seven publish their
              credit policy and nobody has filed it. One click, one person's
              name on all of it. */}
          {(() => {
            const ready = lenders.filter(l => {
              const w = whereFor(l.name)
              return !!w?.url && w.firmness === 'policy' && docsFor(l.id).length === 0
            })
            if (ready.length === 0 || busy) return null
            return (
              <div className="mx-4 mb-4 border border-card-waiting-edge bg-card-waiting rounded-xl px-4 py-3
                              flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <b className="block text-[12.5px] text-ink mb-0.5">
                    {ready.length} {ready.length === 1 ? 'bank publishes' : 'banks publish'} their
                    credit policy and nobody has filed it
                  </b>
                  <span className="block text-[11.5px] text-muted leading-relaxed">
                    {ready.map(l => l.name).join(', ')}. I already hold the address for each one.
                  </span>
                </div>
                <button type="button"
                  onClick={async () => {
                    for (const [i, l] of ready.entries()) {
                      setNote(`Bank ${i + 1} of ${ready.length} — ${l.name}`)
                      const w = whereFor(l.name)
                      if (w?.url) await addLink(l, w.url)
                    }
                    setNote(`Read ${ready.length} ${ready.length === 1 ? 'bank' : 'banks'}. Check them below.`)
                  }}
                  className="text-[12px] bg-ink text-page rounded-lg px-3.5 py-2 font-medium whitespace-nowrap">
                  Read all {ready.length}
                </button>
              </div>
            )
          })()}

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
            <span className={`${PILL} border ${TONE[rungTone(standingOf(lender).rung)]}`}>
              {standingOf(lender).label}
            </span>
          </div>
          <p className="text-[12.5px] text-muted mb-4">{standingOf(lender).why}</p>

          {/* WHAT THE SWEEP FOUND FOR THIS BANK. Shown hardest where it is
              needed most: a bank with nothing on file, where without it the
              page is a dead end. */}
          {/* WHERE TO GET IT, WHILE THERE IS STILL NOTHING HERE.
              13 Oct 2026. Fabio: "all of that is obsolete as the library holds
              ther data". Right - the moment a document lands, how it was
              fetched stops mattering, so this drops to one line underneath
              rather than sitting at the top of the page. */}
          {(() => {
            const w = whereFor(lender.name)
            if (!w) return null
            if (docsFor(lender.id).length > 0) {
              return (
                <p className="mb-3 text-[11px] text-faint leading-relaxed">
                  {w.url
                    ? <>Their own copy: <a href={w.url} target="_blank" rel="noreferrer" className="text-muted underline break-all">{w.url}</a></>
                    : w.portal ? <>Their copy sits behind {w.portal}.</> : <>Nothing published by this bank.</>}
                  {' '}Our own check on {when(REGISTER_CHECKED_ON)}.
                </p>
              )
            }
            return (
              <div className="mb-3 border-l-[3px] border-info bg-info-bg rounded-r-xl px-4 py-3">
                <b className="block text-[12.5px] text-ink mb-1">Where this bank keeps its policy</b>
                <p className="m-0 text-[12.5px] text-body leading-relaxed">{w.what}</p>
                {w.dated && <p className="m-0 mt-1 text-[11.5px] text-muted">The document says: {w.dated}</p>}
                {w.note && <p className="m-0 mt-1 text-[11.5px] text-muted">{w.note}</p>}
                {w.url && (
                  <>
                    {/* ONE CLICK. The address is already in the register, so
                        asking anybody to copy it across is work we invented.
                        It says the bank and the full address first, because a
                        wrong row in my register plus a one-click fetch is a
                        policy filed under the wrong bank with nobody reading
                        the URL - see the Police Bank row for how easily that
                        happens. */}
                    <p className="m-0 mt-2 flex gap-2 items-center flex-wrap">
                      <button type="button"
                        onClick={() => addLink(lender, w.url || '')}
                        disabled={busy === lender.id}
                        className="text-[12px] bg-ink text-page rounded-lg px-3 py-1.5 font-medium disabled:opacity-40">
                        {busy === lender.id ? 'Reading it\u2026' : `Read it from ${siteOf(w.url)}`}
                      </button>
                      <span className="text-[11px] text-muted">
                        Files it under {lender.name}. Nothing goes looking on its own.
                      </span>
                    </p>
                    <p className="m-0 mt-1.5 text-[11px]">
                      <a href={w.url} target="_blank" rel="noreferrer" className="text-muted underline break-all">{w.url}</a>
                    </p>
                  </>
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
                      {rulesFor(d.id, 'live').length === 0 && waiting === 0 && (
                        /* NOTHING CAME OUT OF IT. Offer another go rather than
                           leaving somebody to re-drop the same file. */
                        <button onClick={() => readItAgain(d, lender)} disabled={busy === lender.id}
                          className="text-[12px] bg-ink text-page rounded-lg px-2.5 py-[5px] font-medium disabled:opacity-40">
                          Read it again
                        </button>
                      )}
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

            {/* IT SAID DROP AND IT ONLY TOOK A CLICK.
                13 Oct 2026. Fabio, holding a file, looking straight at this
                box: "see??? where the fuck do i drop it???????????????????????"
                Every word on this screen said drop. It was a label over a
                hidden file input and a drag did nothing at all. It takes a
                drag now, and it says both. */}
            <label
              onDragOver={e => { e.preventDefault(); if (busy !== lender.id) setOverIt(true) }}
              onDragLeave={() => setOverIt(false)}
              onDrop={e => {
                e.preventDefault(); setOverIt(false)
                if (busy === lender.id) return
                const f = e.dataTransfer?.files?.[0]
                if (f) addDocument(lender, f)
              }}
              className={`block mx-4 mt-4 border-[1.5px] border-dashed rounded-xl p-5 text-center transition
                ${overIt ? 'border-info bg-info-bg scale-[1.01]' : 'border-info-edge bg-info-bg'}
                ${busy === lender.id ? 'opacity-60' : 'cursor-pointer hover:bg-info-bg/70'}`}>
              <input type="file" accept=".pdf,.zip,.xlsx,.xlsm,.csv,.eml,.md,.txt,.doc,.docx" className="hidden"
                disabled={busy === lender.id}
                onChange={e => { const f = e.target.files?.[0]; if (f) addDocument(lender, f); e.currentTarget.value = '' }} />
              <b className="block text-[13px] text-info mb-1">
                {busy === lender.id ? 'Working on it…'
                  : overIt ? 'Let go and I will read it'
                  : 'Drag a file here, or click to choose one'}
              </b>
              <span className="text-[12px] text-muted">
                A credit manual, a zip of chapters, a spreadsheet, a Word document, or an email
                you have forwarded. The original is kept exactly as it arrived and never changed.
                Paco quotes it, so you can open the thing he took a line from.
              </span>
            </label>

            {/* ONE DOCUMENT, FOUR BANKS - SAID ON SCREEN BEFORE IT HAPPENS.
                Filing something under a bank nobody asked for would be worse
                than the extra work it saves, so it names them and can be
                turned off. */}
            {(() => {
              const also = lendersCoveredWith(lender)
              if (also.length === 0) return null
              return (
                <label className="mx-4 mb-1 flex gap-2.5 items-start cursor-pointer">
                  <input type="checkbox" checked={alsoAlso} onChange={e => setAlsoAlso(e.target.checked)}
                    className="mt-[3px] accent-ink" />
                  <span className="text-[12px] text-body leading-relaxed">
                    <b className="text-ink">Also file it under {also.map(x => x.name).join(', ')}.</b>{' '}
                    This is one policy covering {also.length + 1} brands, so it is read once and the
                    lines are copied across rather than read {also.length + 1} times.
                  </span>
                </label>
              )
            })()}

            {/* OR PASTE THE ADDRESS. Macquarie's guidelines are a PDF on their
                website and AMP's policy library is web pages. Neither is a file
                anybody should have to go and find first. */}
            <div className="m-4 mt-3">
              <b className="block text-[12.5px] text-ink mb-1">Or paste a different link</b>
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

        </>
      )}
    </div>
  )
}
