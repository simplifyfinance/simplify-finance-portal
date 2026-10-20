'use client'
import { useRef, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { money } from '@/lib/money'
import {
  FIELDS, guessMapping, whatIsMissing, groupByClient, planTheImport, countThePlan,
  rowKeyFor, type Mapping, type Planned,
} from '@/lib/book-import'

// DROPPING TEN YEARS OF CLIENTS IN, WITH A LOOK BEFORE ANYTHING IS WRITTEN.
//
// 15 Oct 2026. 796 rows, 656 clients, and most of them have never been near
// this portal.
//
// THE RULE THIS SCREEN EXISTS FOR: nothing is saved until the person has seen
// what is about to happen. The lender library taught that the hard way - an
// import that can quietly create a second copy of everything is an import
// nobody dares run twice, and a library full of duplicates is worse than an
// empty one.
//
// Four steps, and you can stop at any of them: drop it, say which column is
// which, read what it is going to do, approve.

const CARD = 'bg-card border border-card-line rounded-xl'
const BTN = 'text-[12px] border border-card-line bg-card rounded-lg px-3 py-[6px] text-body hover:bg-page transition'
const DARK = 'text-[12px] bg-ink text-page rounded-lg px-3.5 py-[6px] font-semibold disabled:opacity-40'

type Step = 'drop' | 'map' | 'preview' | 'done'

export default function BookImport({ onFinished }: { onFinished?: () => void }) {
  const [step, setStep] = useState<Step>('drop')
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [mapping, setMapping] = useState<Mapping>({})
  const [plan, setPlan] = useState<Planned[]>([])
  const [skip, setSkip] = useState<Set<string>>(new Set())
  const [wrote, setWrote] = useState({ made: 0, updated: 0, reviews: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  async function readTheFile(file: File) {
    setBusy(true); setWhy('')
    try {
      const base64 = await new Promise<string>((ok, no) => {
        const r = new FileReader()
        r.onload = () => ok(String(r.result || ''))
        r.onerror = () => no(new Error('the file could not be read'))
        r.readAsDataURL(file)
      })
      const res = await fetch('/api/book-import', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ base64 }),
      })
      const j = await res.json()
      if (!res.ok) { setWhy(String(j?.error || `the reader answered ${res.status}`)); return }
      setFileName(file.name)
      setHeaders(j.headers || [])
      setRows(j.rows || [])
      // GUESSED, NEVER DECIDED. Every one is shown with its column beside it
      // and the person says yes.
      setMapping(guessMapping(j.headers || []))
      setStep('map')
    } catch (e: any) {
      setWhy(String(e?.message || e))
    } finally { setBusy(false) }
  }

  function buildThePlan() {
    setBusy(true); setWhy('')
    const supabase = createSupabaseBrowser()
    // WHAT THE BOOK ALREADY PUT HERE, not who the portal has as a client.
    //
    // 19 Oct 2026. This used to read `clients`, because the import used to
    // write there. It does not any more - see writeIt. A second drop of the
    // same spreadsheet matches on the book's own key and updates the review it
    // already made, which is the only kind of "already here" this screen now
    // has to think about.
    supabase.from('portfolio_reviews')
      .select('id, book_row_key, book_first_name, book_last_name')
      .not('book_row_key', 'is', null).limit(10000)
      .then(({ data, error }) => {
        setBusy(false)
        if (error) { setWhy(error.message); return }
        const book = groupByClient(rows, mapping)
        const seen = (data || []).map((r: any) => ({
          id: r.id, first_name: r.book_first_name, last_name: r.book_last_name,
          book_row_key: r.book_row_key,
        }))
        setPlan(planTheImport(book, seen as any[]))
        setSkip(new Set())
        setStep('preview')
      })
  }

  async function writeIt() {
    setBusy(true); setWhy('')
    const supabase = createSupabaseBrowser()
    const { data: me } = await supabase.auth.getUser()
    const run = crypto.randomUUID()
    const now = new Date().toISOString()
    let made = 0, updated = 0, reviews = 0, written = 0

    try {
      for (const p of plan) {
        if (skip.has(p.client.key)) continue
        const first = p.client.people[0]

        // NOTHING GOES INTO `clients`. 19 Oct 2026.
        //
        // Fabio, before a single row was imported: "This is just a reports tab.
        // All I need is the name of the client, the property address, the loan
        // amount, the LVR, the security address. I will then do everything
        // outside the portal... and if it is an opportunity I will drag that
        // client into a brand new deal card. I will upload the fact find to
        // make sure we create the assets and liabilities position."
        //
        // The import used to write all 656 into `clients` with a
        // position_properties built from the spreadsheet. Two things were wrong
        // with that. The Clients page and both client pickers would have gone
        // from hundreds of rows to over a thousand, for people who are not
        // clients. And on anyone the portal ALREADY had, it overwrote their
        // asset position with values-at-settlement out of a ten year old CRM
        // export - the exact figure the client list exists to show.
        //
        // A person becomes a client when somebody makes them a deal card, by
        // hand, with a fact find behind it. That is the only thing that
        // produces a real assets and liabilities position, and a spreadsheet is
        // not it. So the book lives here, in Reports, and client_id stays null
        // until the day one of these turns into a deal.
        const review = {
          book_name: p.client.groupName,
          // ONLY EVER FILLED IN, NEVER WIPED. 20 Oct 2026.
          //
          // The second export carries the emails the first one had no columns
          // for. A re-import must fill in what is missing without touching an
          // address somebody typed in by hand on the review in the meantime -
          // a person who went and found it beats a spreadsheet that did not
          // have it. So a blank in the file leaves what is there alone, which
          // is why these are spread in conditionally rather than set.
          ...(p.client.email ? { book_email: p.client.email } : {}),
          ...(p.client.phone ? { book_phone: p.client.phone } : {}),
          ...(p.client.email2 ? { book_email2: p.client.email2 } : {}),
          ...(p.client.phone2 ? { book_phone2: p.client.phone2 } : {}),
          book_first_name: first?.first || p.client.groupName,
          book_last_name: first?.last || '',
          book_group: p.client.groupName,
          book_broker_key: (p.client.brokerKey || '').toLowerCase().split(' ')[0] || null,
          book_row_key: rowKeyFor(p.client),
          book_imported_at: now,
          book_import_run: run,
        }

        let reviewId = p.existingId || ''
        if (reviewId) {
          // A SECOND DROP OF THE SAME SPREADSHEET UPDATES WHAT IT MADE.
          //
          // Only the book's own fields. The status, the figures, the contact
          // history and the next review date are the work somebody has done
          // since, and a re-import is not allowed to walk over any of it.
          const { data, error } = await supabase.from('portfolio_reviews')
            .update(review).eq('id', reviewId).select('id')
          if (error || !data?.length) throw new Error(error?.message || `could not update ${review.book_first_name}`)
          updated += 1
        } else {
          const { data, error } = await supabase.from('portfolio_reviews')
            .insert({ ...review, status: 'not_reviewed', created_by: me?.user?.id || null })
            .select('id').single()
          if (error || !data?.id) throw new Error(error?.message || `could not add ${review.book_first_name}`)
          reviewId = String(data.id)
          made += 1
          reviews += 1
        }

        // THE PROPERTIES, REPLACED RATHER THAN ADDED TO.
        //
        // The spreadsheet is the whole truth about what the book holds for this
        // person, so a re-import after a property was sold has to be able to
        // take it off. Deleting first is what makes a second run an update
        // instead of a pile.
        //
        // The hand-done columns - the current valuation, its source and date,
        // the usable equity worked out on screen - are carried across rather
        // than thrown away, matched on the address. Losing an afternoon of
        // valuations because somebody re-dropped the export is not acceptable.
        const { data: had } = await supabase.from('portfolio_review_properties')
          .select('address, estimated_current_value, valuation_source, valuation_date, usable_equity, notes')
          .eq('review_id', reviewId)
        const byAddress = new Map((had || []).map((h: any) => [String(h.address || '').trim().toLowerCase(), h]))

        // CHECKED, because a refused delete here is not a missing row - it is a
        // DOUBLED one. The insert below would run anyway and this person would
        // show two of every property, with twice the equity behind them, which
        // is the figure the whole list is triaged on.
        const { error: clearErr } = await supabase.from('portfolio_review_properties')
          .delete().eq('review_id', reviewId)
        if (clearErr) throw new Error(`${review.book_first_name}: the old properties would not clear — ${clearErr.message}`)

        const props = p.client.properties.map((prop: any, i: number) => {
          const kept: any = byAddress.get(String(prop.address || '').trim().toLowerCase()) || {}
          return {
            review_id: reviewId,
            ordinal: i + 1,
            address: prop.address,
            investor: !!prop.investor,
            original_value: prop.valueAtSettlement,
            original_loan: prop.loanAtSettlement,
            lender_raw: prop.lender || '',
            loan_ref: (prop.loanIds || []).join(', '),
            estimated_current_value: kept.estimated_current_value ?? null,
            valuation_source: kept.valuation_source ?? null,
            valuation_date: kept.valuation_date ?? null,
            usable_equity: kept.usable_equity ?? null,
            notes: kept.notes ?? '',
          }
        })
        if (props.length) {
          const { error } = await supabase.from('portfolio_review_properties').insert(props)
          if (error) throw new Error(error.message)
          written += props.length
        }
      }

      // fire-and-forget: the record of WHO ran this and with what mapping. The
      // clients are already written and the screen already says what happened;
      // failing the whole import because the logbook entry was refused would be
      // the tail wagging the dog.
      await supabase.from('book_imports').insert({
        file_name: fileName, mapping, rows_seen: rows.length,
        clients_made: made, clients_updated: updated,
        properties_written: written,
        imported_by: me?.user?.id || null,
      })

      setWrote({ made, updated, reviews })
      setStep('done')
      onFinished?.()
    } catch (e: any) {
      // STOPPED WHERE IT STOPPED, AND SAYS SO. Everything written before this
      // point is real and keyed, so running it again picks up where it left off
      // rather than starting a second copy.
      setWhy(`${String(e?.message || e)} — ${made + updated} were saved before it stopped. Running it again carries on from there.`)
    } finally { setBusy(false) }
  }

  const missing = whatIsMissing(mapping)
  const counts = plan.length ? countThePlan(plan.filter(p => !skip.has(p.client.key))) : null

  return (
    <div className={`${CARD} p-4 mb-3`}>
      <b className="block text-[13px] text-ink mb-1">Import the book</b>

      {why && (
        <div className="my-2 border border-chase-edge bg-chase-bg rounded-lg px-3 py-2 text-[12px] text-chase">
          {why}
        </div>
      )}

      {step === 'drop' && (
        <>
          <p className="text-[12px] text-muted mb-3">
            The CRM export of your deals. Nothing is saved until you have seen what it is going to do.
          </p>
          <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) readTheFile(f) }} />
          <button className={DARK} disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Opening it…' : 'Choose the spreadsheet'}
          </button>
        </>
      )}

      {step === 'map' && (
        <>
          <p className="text-[12px] text-muted mb-3">
            <b className="text-ink">{fileName}</b> — {rows.length} rows, {headers.length} columns.
            Check each one. This is remembered, so the next drop will not ask again.
          </p>
          <div className="grid grid-cols-[minmax(0,210px)_minmax(0,1fr)] gap-x-4 gap-y-2 mb-3">
            {FIELDS.map(f => (
              <div key={f.key} className="contents">
                <label className="text-[12px] text-body pt-[6px]">
                  {f.label}{f.required && <span className="text-chase">*</span>}
                  {f.why && <span className="block text-[10.5px] text-faint leading-snug">{f.why}</span>}
                </label>
                <select value={mapping[f.key] || ''}
                  onChange={e => setMapping({ ...mapping, [f.key]: e.target.value })}
                  className="text-[12px] bg-card border border-card-line rounded-lg px-2 py-[6px] h-[32px] self-start">
                  <option value="">— not in this file —</option>
                  {headers.filter(Boolean).map(h => (
                    <option key={h} value={h}>{h.replace(/\s+/g, ' ')}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {missing.length > 0 && (
            <p className="text-[12px] text-chase mb-2">
              Still needed: {missing.join(', ')}.
            </p>
          )}
          <div className="flex gap-2">
            <button className={BTN} onClick={() => setStep('drop')}>Start again</button>
            <button className={DARK} disabled={busy || missing.length > 0} onClick={buildThePlan}>
              {busy ? 'Working it out…' : 'See what it will do'}
            </button>
          </div>
        </>
      )}

      {step === 'preview' && counts && (
        <>
          <div className="flex gap-2 flex-wrap my-3">
            {([['on the list', counts.all], ['new', counts.fresh], ['already here', counts.matched],
               ['need a decision', counts.maybe], ['still have a loan', counts.onTheBook],
               ['worth opening first', counts.worthOpening]] as const).map(([what, n]) => (
              <div key={what} className="bg-page border border-card-line rounded-lg px-3 py-2 min-w-[104px]">
                <b className="block text-[17px] text-ink leading-tight">{n}</b>
                <span className="text-[11px] text-muted">{what}</span>
              </div>
            ))}
          </div>

          {/* SAID BEFORE ANYTHING IS WRITTEN, because it is the question Fabio
              asked on 19 Oct and the answer has to be visible, not trusted. */}
          <p className="text-[12px] text-body mb-2 bg-done-bg border border-done-edge rounded-lg px-3 py-2">
            <b className="text-done">Nothing is written to your Clients page.</b> This list lives in
            Reports. Your clients, their deals and their recorded asset positions are not touched.
            When one of these is worth doing, you make the deal card yourself and the review is marked
            as having become a deal.
          </p>

          {counts.maybe > 0 && (
            <p className="text-[12px] text-body mb-2">
              <b className="text-ink">{counts.maybe} need a decision.</b> Another row in the book has the
              same name. Untick any you do not want written.
            </p>
          )}

          <div className="border border-card-line rounded-lg overflow-hidden mb-3 max-h-[320px] overflow-y-auto">
            {plan.slice(0, 200).map(p => {
              const off = skip.has(p.client.key)
              return (
                <label key={p.client.key}
                  className={`flex items-center gap-3 px-3 py-2 border-b border-line-soft last:border-b-0 text-[12.5px] ${off ? 'opacity-45' : ''}`}>
                  <input type="checkbox" checked={!off}
                    onChange={() => setSkip(s => {
                      const n = new Set(s)
                      if (n.has(p.client.key)) n.delete(p.client.key); else n.add(p.client.key)
                      return n
                    })} />
                  <span className="font-semibold text-ink min-w-0 truncate flex-1">{p.client.groupName}</span>
                  <span className="text-[11px] text-muted w-[82px]">
                    {p.client.properties.length} {p.client.properties.length === 1 ? 'property' : 'properties'}
                  </span>
                  <span className="text-[12px] text-done w-[86px] text-right font-semibold">
                    {p.headroom === null ? '—' : money(p.headroom)}
                  </span>
                  <span className={`text-[10.5px] font-semibold rounded-full px-2 py-[2px] border w-[104px] text-center ${
                    p.decision === 'new' ? 'bg-page text-faint border-card-line'
                    : p.decision === 'matched' ? 'bg-done-bg text-done border-done-edge'
                    : 'bg-info-bg text-info border-info-edge'}`}>
                    {p.decision === 'new' ? 'new' : p.decision === 'matched' ? 'already here' : 'same name'}
                  </span>
                </label>
              )
            })}
            {plan.length > 200 && (
              <p className="px-3 py-2 text-[11.5px] text-faint">
                …and {plan.length - 200} more. All of them are written; only the first 200 are listed here.
              </p>
            )}
          </div>

          <div className="flex gap-2 items-center">
            <button className={BTN} onClick={() => setStep('map')}>Back to the columns</button>
            <span className="flex-1" />
            <button className={DARK} disabled={busy} onClick={writeIt}>
              {busy ? 'Writing…' : `Import ${counts.all} clients`}
            </button>
          </div>
        </>
      )}

      {step === 'done' && (
        <div className="border border-done-edge bg-done-bg rounded-lg px-3 py-3 mt-2">
          <b className="block text-[13px] text-done mb-1">The book is in.</b>
          <p className="text-[12px] text-body">
            {wrote.made} added to the review list, {wrote.updated} updated.
            Nothing was written to your Clients page — the book lives here, in Reports.
            Drop the same file again any time — it updates rather than making a second copy.
          </p>
        </div>
      )}
    </div>
  )
}
