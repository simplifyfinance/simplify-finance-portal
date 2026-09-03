'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { checkedWrite } from '@/lib/checked-write'
import { documentsFor, documentsDue, groupedDocuments, type DocRound } from '@/lib/document-rules'
import { rowsFor, tickedCount, toRequest, withTick, withAdded, withoutAdded, withDeferred,
         progressOf, requestRounds, COMMON_EXTRAS, type DocProgress, type DocRow } from '@/lib/document-progress'
import { formallyApproved } from '@/lib/document-rules'
import { banksSeen, accountsPerBank, coveredRows, shortOfPeriod, salaryAccounts,
         expensesAccount, undeclaredBanks, type BanksSeen, type NamedAccount } from '@/lib/statement-cover'

// THE DOCUMENT BOX.
//
// One box, one list, in the same place on every stage - it sits with the deal
// information above the tabs rather than inside one, because documents are not
// a stage of the deal, they run alongside all of them. Fabio, 3 Sep 2026: "let's
// make sure it all sits on the same button with the same box where we're
// crossing documents along the way and adding. It's always the same button."
//
// Pressing request emails whoever does the requesting - set in Settings, the
// same person the "documents received" email goes to - with the list in it, and
// records on the deal what was asked for. That record is what stops the second
// press asking a client again for what they already sent.

const TICK = (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor"
       strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8.4 6.2 11.4 13 4.6" />
  </svg>
)

export default function DocumentsBox({ deal, me, onUpdated }: {
  deal: any
  // The same shape the deal page hands DealAlerts and FileNotes.
  me?: { id: string | null; name: string } | null
  onUpdated?: (patch: any) => void
}) {
  const supabase = createSupabaseBrowser()
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState<DocProgress>(() => progressOf(deal))
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [showLater, setShowLater] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentMsg, setSentMsg] = useState('')
  // Loaded only when the box is opened. A deal can carry eight hundred
  // transactions and the deal page has no business fetching them to draw a
  // collapsed strip.
  const [cover, setCover] = useState<{
    seen: BanksSeen; perBank: Record<string, number>
    salary: NamedAccount[]; expenses: NamedAccount | null; undeclared: string[]
  } | null>(null)

  const who = me?.name || 'Somebody'

  // Worked out fresh on every render of a changed deal. Never stored.
  const { items, gaps } = useMemo(() => documentsFor(deal), [deal])
  const dueNow = useMemo(() => documentsDue(deal, 'proceed').items.map(i => i.key), [deal])

  // WHAT THE STATEMENTS ALREADY COVER.
  //
  // Bank level, no account numbers - see lib/statement-cover.ts for why. Fetched
  // once, the first time somebody opens the box.
  useEffect(() => {
    if (!open || cover) return
    let alive = true
    ;(async () => {
      const [{ data: uploads }, { data: txns }, { data: lenders }] = await Promise.all([
        supabase.from('deal_statement_uploads').select('institutions, period_from, period_to, days').eq('deal_id', deal.id),
        supabase.from('deal_statement_transactions')
          .select('institution, account_number, account_name, category, summary_category, amount').eq('deal_id', deal.id),
        supabase.from('lenders').select('name, statement_codes'),
      ])
      if (!alive) return
      const ls = lenders || []
      const seen = banksSeen(uploads || [], ls)
      setCover({
        seen,
        perBank: accountsPerBank(txns || [], ls),
        salary: salaryAccounts(txns || [], ls),
        expenses: expensesAccount(txns || [], ls),
        undeclared: undeclaredBanks(seen, deal, ls),
      })
    })().catch(() => { /* the list still works without them */ })
    return () => { alive = false }
  }, [open, cover, deal.id])

  const approved = formallyApproved(deal)
  const rows = useMemo(() => rowsFor(items, progress, { formallyApproved: approved }),
    [items, progress, approved])
  const nowRows = rows.filter(r => dueNow.includes(r.key) || r.addedByHand)
  const laterRows = rows.filter(r => !dueNow.includes(r.key) && !r.addedByHand)
  const groups = useMemo(() => groupedDocuments(nowRows as any), [nowRows]) as
    { key: string; label: string; items: DocRow[] }[]

  // A covered row goes quiet, but is NEVER hidden and never untickable. A wrong
  // guess about a bank should cost a glance, not a document.
  const covered = useMemo(() => {
    if (!cover) return new Map<string, { bank: string; days: number }>()
    return new Map(coveredRows(nowRows, cover.seen).map(c => [c.key, c]))
  }, [cover, nowRows])

  const ticked = tickedCount(nowRows)
  const pending = toRequest(nowRows).filter(r => !covered.has(r.key))
  const asked = nowRows.filter(r => r.requestedAt).length
  const rounds = requestRounds(progress)

  // Rebuilt server-side before anything is sent, so this is a request, not an
  // instruction - a stale browser cannot email a client for a liability that
  // was deleted this morning.
  async function requestThem() {
    if (pending.length === 0) return
    setSending(true); setSentMsg(''); setErr('')
    try {
      const res = await fetch('/api/request-documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, keys: pending.map(r => r.key) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setErr(data?.error || `The request could not be sent (${res.status}).`)
        // Recorded but unsent: the screen must show them as asked for, or the
        // next press sends the lot again.
        if (data?.recorded) await reload()
        setSending(false)
        return
      }
      if (data.skipped) { setSentMsg('Those were already asked for.'); await reload(); setSending(false); return }
      setSentMsg(`${data.count} ${data.count === 1 ? 'document' : 'documents'} sent to ${data.to || 'the requesting team'}.`)
      await reload()
    } catch (e: any) {
      setErr(e?.message || 'The request could not be sent.')
    }
    setSending(false)
  }

  // The request is recorded server-side, so the screen has to go and read it
  // back rather than guess at what was written.
  async function reload() {
    const { data } = await supabase.from('deals').select('document_progress').eq('id', deal.id).single()
    if (data) {
      setProgress(progressOf(data))
      onUpdated?.({ document_progress: data.document_progress })
    }
  }

  // Optimistic, then verified. A write that silently affects zero rows is the
  // failure this codebase has been bitten by, so the screen goes back to what it
  // was and says so rather than showing a tick that never saved.
  async function save(next: DocProgress, what: string) {
    const before = progress
    setProgress(next)
    setBusy(what)
    const problem = await checkedWrite(
      supabase.from('deals').update({ document_progress: next }).eq('id', deal.id), 'That change')
    setBusy('')
    if (problem) { setProgress(before); setErr(problem); return }
    setErr('')
    onUpdated?.({ document_progress: next })
  }

  const toggle = (r: DocRow) => save(withTick(progress, r.key, !r.ticked, who), r.key)

  function addTyped() {
    const label = newLabel.trim()
    if (!label) return
    const known = COMMON_EXTRAS.find(e => e.label.toLowerCase() === label.toLowerCase())
    setNewLabel('')
    setAdding(false)
    save(withAdded(progress, known?.label || label, known?.forWhat || 'compliance', who, known?.detail), 'add')
  }

  return (
    <div className="bg-white border border-[#EDE7DD] rounded-xl mb-4 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FDFCFA] transition">
        <span className="text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889]">Documents</span>
        <span className="text-[13px] text-[#221F1B] font-semibold">
          {pending.length > 0 ? `${pending.length} to request` : asked > 0 ? `${asked} requested` : `${ticked} to request`}
        </span>
        <span className="text-[12px] text-[#A29889]">
          of {nowRows.length} on the list{covered.size > 0 ? ` · ${covered.size} covered by statements` : ''}
        </span>
        {gaps.length > 0 && (
          <span className="text-[9px] font-bold tracking-[.04em] uppercase rounded px-1.5 py-[2px] border
                           text-[#946017] bg-[#FDF6EC] border-[#EBD9BE]">
            {gaps.length} to check
          </span>
        )}
        <span className="ml-auto text-[11px] text-[#A29889]">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="border-t border-[#F2EEE7]">
          {err && (
            <p className="m-4 mb-0 border border-[#E9D2CF] bg-[#FDF3F2] rounded-[10px] px-4 py-2.5 text-[12.5px] text-[#8E3A34]">
              {err}
            </p>
          )}

          {sentMsg && (
            <p className="m-4 mb-0 border border-[#BBF7D0] bg-[#F6FDF8] rounded-[10px] px-4 py-2.5 text-[12.5px] text-[#15803D]">
              {sentMsg}
            </p>
          )}

          {cover && cover.seen.known.length > 0 && (
            <div className="m-4 mb-0 border border-[#CDEBF8] bg-[#F4FCFF] rounded-[10px] px-4 py-3 text-[12.5px] text-[#0B5E8A]">
              <b className="text-[#141C24]">
                Statements received — {cover.seen.known.join(' and ')}
                {cover.seen.from && cover.seen.to ? `, ${cover.seen.days} days to ${shortDate(cover.seen.to)}` : ''}.
              </b>
              {Object.keys(cover.perBank).length > 0 && (
                <span> {Object.entries(cover.perBank)
                  .map(([b, n]) => `${b} · ${n} ${n === 1 ? 'account' : 'accounts'}`).join('  ·  ')}</span>
              )}
              {(cover.salary.length > 0 || cover.expenses) && (
                <p className="m-0 mt-2">
                  {cover.salary.map((a, i) => (
                    <span key={a.bank + a.account}>
                      {i > 0 ? ', ' : ''}salary credited to <b className="text-[#141C24]">{a.bank}{a.account ? ` ${a.account}` : ''}</b>
                    </span>
                  ))}
                  {cover.expenses && (
                    <span>{cover.salary.length > 0 ? '; ' : ''}most spending runs through
                      {' '}<b className="text-[#141C24]">{cover.expenses.bank}{cover.expenses.account ? ` ${cover.expenses.account}` : ''}</b>
                      {' '}<span className="text-[#7C8894]">(a best guess — there is no “expenses” label on a statement)</span>
                    </span>
                  )}
                </p>
              )}
              {covered.size > 0 && (
                <p className="m-0 mt-2">{covered.size} {covered.size === 1 ? 'row has' : 'rows have'} crossed
                  {covered.size === 1 ? ' itself' : ' themselves'} off below. Tick any of them back on if you still want it.</p>
              )}
            </div>
          )}

          {cover && cover.undeclared.length > 0 && (
            <div className="m-4 mb-0 border border-[#E8CFC6] bg-[#FCF4F1] rounded-[10px] px-4 py-3 text-[12.5px] text-[#AD4227]">
              <b className="text-[#141C24]">
                Statements arrived from {cover.undeclared.join(' and ')}, and there
                {cover.undeclared.length === 1 ? ' is no such account' : ' are no such accounts'} on the fact find.
              </b>
              <p className="m-0 mt-1">Either it is on there under a different name, or it was not declared. Worth one question
                before this goes to a lender.</p>
            </div>
          )}

          {cover && cover.seen.unrecognised.length > 0 && (
            <div className="m-4 mb-0 border border-[#EBD9BE] bg-[#FDF6EC] rounded-[10px] px-4 py-3 text-[12.5px] text-[#8A6218]">
              <b className="text-[#141C24]">
                Statements arrived from {cover.seen.unrecognised.map(c => `"${c}"`).join(' and ')}, which
                {cover.seen.unrecognised.length === 1 ? ' is not a code' : ' are not codes'} the lender library knows.
              </b>
              <p className="m-0 mt-1">Nothing has been crossed off for
                {cover.seen.unrecognised.length === 1 ? ' it' : ' them'}. Add the code against the right bank in the
                lender library and it will be recognised from then on.</p>
            </div>
          )}

          {rounds.length > 0 && (
            <p className="m-4 mb-0 text-[12px] text-[#A29889]">
              {rounds.length === 1 ? 'Asked for' : `Asked for over ${rounds.length} rounds, most recently`}
              {' '}{whenAsked(rounds[rounds.length - 1].at)} by {rounds[rounds.length - 1].by}.
            </p>
          )}

          {gaps.map(g => (
            <p key={g.key} className="m-4 mb-0 border border-[#EBD9BE] bg-[#FDF6EC] rounded-[10px] px-4 py-2.5 text-[12.5px] text-[#8A6218]">
              {g.message}
            </p>
          ))}

          {groups.map(group => (
            <div key={group.key}>
              <div className="px-4 pt-4 pb-1.5 text-[9.5px] font-bold tracking-[.07em] uppercase text-[#A29889]">
                {group.label}
              </div>
              {group.items.map(r => (
                <div key={r.key} className="flex gap-3 items-start px-4 py-[7px] border-t border-[#F7F4EF] hover:bg-[#FDFCFA]">
                  {r.requestedAt ? (
                    // Asked for. Not a tick any more - a thing being waited on,
                    // and unticking it would only lie about what went out.
                    <span title={`Asked for ${whenAsked(r.requestedAt)}`}
                      className="w-4 h-4 rounded-[4px] border-[1.5px] mt-[3px] flex-none grid place-items-center
                                 bg-[#EFF9F2] border-[#CFE6D5] text-[#1E7A4A]">
                      {TICK}
                    </span>
                  ) : (
                    <button onClick={() => toggle(r)} disabled={busy === r.key || !!r.askFirst}
                      aria-label={r.ticked ? `Do not ask for ${r.label}` : `Ask for ${r.label}`}
                      className={`w-4 h-4 rounded-[4px] border-[1.5px] mt-[3px] flex-none grid place-items-center transition
                        disabled:opacity-40 ${r.ticked
                          ? 'bg-[#221F1B] border-[#221F1B] text-white'
                          : 'bg-white border-[#CFC7BA] text-transparent hover:border-[#A29889]'}`}>
                      {TICK}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] ${covered.has(r.key) && !r.requestedAt ? 'text-[#8B8378]'
                      : r.ticked ? 'text-[#221F1B] font-medium' : 'text-[#8B8378]'}`}>
                      {r.label}
                      {r.detail && <span className="font-normal text-[#A29889]"> — {r.detail}</span>}
                    </div>
                    {(r.why || r.decidedBy || r.requestedAt || covered.has(r.key)) && (
                      <div className="text-[11.5px] text-[#A29889] mt-[1px]">
                        {r.requestedAt ? <span className="text-[#1E7A4A]">Asked for {whenAsked(r.requestedAt)}</span>
                          : covered.has(r.key) ? (
                            <span className="text-[#1E7A4A]">
                              ✓ On file — {covered.get(r.key)!.bank} statements came through
                              {shortOfPeriod(r.detail, covered.get(r.key)!.days)
                                ? <span className="text-[#AD4227]">, but only {covered.get(r.key)!.days} days of them</span>
                                : `, ${covered.get(r.key)!.days} days`}
                            </span>
                          ) : r.why}
                        {!r.requestedAt && r.decidedBy && <span>{r.why ? ' · ' : ''}{r.ticked ? 'Added back' : 'Unticked'} by {r.decidedBy}</span>}
                      </div>
                    )}

                    {/* THE DISCHARGE. Not a tick but a question, because "not
                        yet" is a real answer that has to come back on its own.
                        Fabio, 3 Sep 2026: "make it a rule that do you wanna ask
                        for discharge now, yes or no?" */}
                    {r.askFirst && !r.requestedAt && (
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        <button onClick={() => save(withTick(progress, r.key, true, who), r.key)}
                          className="rounded-lg px-2.5 py-1 text-[12px] font-semibold bg-[#221F1B] text-white">
                          Ask for it now
                        </button>
                        <button onClick={() => save(withDeferred(progress, r.key, who), r.key)}
                          className="rounded-lg px-2.5 py-1 text-[12px] border border-[#D7DCE1] bg-white text-[#3E4C59]">
                          Not yet — bring it back at formal approval
                        </button>
                      </div>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold tracking-[.05em] uppercase rounded px-1.5 py-[2px] border mt-[2px] flex-none ${
                    r.forWhat === 'lodge'
                      ? 'text-[#0B5E8A] bg-[#F4FCFF] border-[#CDEBF8]'
                      : 'text-[#946017] bg-[#FDF6EC] border-[#EBD9BE]'}`}>
                    {r.forWhat === 'lodge' ? 'Lodge' : 'Compliance'}
                  </span>
                  {r.addedByHand && (
                    <button onClick={() => save(withoutAdded(progress, r.key), r.key)}
                      className="text-[11px] text-[#C3BDB2] hover:text-[#B23A34] flex-none mt-[3px]">Remove</button>
                  )}
                </div>
              ))}
            </div>
          ))}

          <div className="px-4 py-3 border-t border-[#F2EEE7] flex items-center gap-3 flex-wrap">
            <button onClick={requestThem} disabled={sending || pending.length === 0}
              className="rounded-lg px-4 py-2 text-[13px] font-semibold bg-[#221F1B] text-white disabled:opacity-30">
              {sending ? 'Sending…'
                : pending.length === 0 ? 'Nothing new to request'
                : `Request ${pending.length} ${pending.length === 1 ? 'document' : 'documents'}`}
            </button>
            <span className="text-[12px] text-[#A29889]">
              {pending.length > 0
                ? 'Emails the list to whoever does the requesting — set in Settings.'
                : covered.size > 0 ? 'Everything ticked is either asked for or already covered by the statements.'
                : asked > 0 ? 'Everything ticked has been asked for.' : 'Tick what you need first.'}
            </span>
          </div>

          {/* Anything the rules would never produce. A short list to pick from,
              because free text alone gives you nine spellings of "accountant's
              letter" - and free text as well, because one-offs are real. */}
          <div className="px-4 py-3 border-t border-[#F2EEE7] bg-[#FDFCFA]">
            {adding ? (
              <div className="flex gap-2 items-center flex-wrap">
                <input autoFocus list="doc-extras" value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTyped(); if (e.key === 'Escape') { setAdding(false); setNewLabel('') } }}
                  placeholder="Accountant's letter, older statements, …"
                  className="flex-1 min-w-[220px] border border-[#E8E1D6] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#2DBEFF]" />
                <datalist id="doc-extras">
                  {COMMON_EXTRAS.map(e => <option key={e.label} value={e.label} />)}
                </datalist>
                <button onClick={addTyped} disabled={!newLabel.trim()}
                  className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold bg-[#221F1B] text-white disabled:opacity-40">Add</button>
                <button onClick={() => { setAdding(false); setNewLabel('') }}
                  className="text-[12.5px] text-[#A29889]">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setAdding(true)}
                className="text-[12.5px] text-[#0E8FCB] hover:underline">+ Add a document</button>
            )}
          </div>

          {/* The rows that are real but not due. Shown because somebody should be
              able to see what is coming, folded because chasing them now is
              exactly the mistake. */}
          {laterRows.length > 0 && (
            <div className="px-4 py-3 border-t border-[#F2EEE7]">
              <button onClick={() => setShowLater(s => !s)} className="text-[12px] text-[#A29889] hover:text-[#7A7266]">
                {showLater ? 'Hide' : `${laterRows.length} more that ${laterRows.length === 1 ? 'turns' : 'turn'} up later, on their own`}
              </button>
              {showLater && (
                <div className="mt-2">
                  {laterRows.map(r => (
                    <div key={r.key} className="flex gap-3 items-baseline py-[5px] text-[12.5px] text-[#A29889]">
                      <span className="flex-1">{r.label}{r.detail && <span> — {r.detail}</span>}</span>
                      <span className="text-[11px]">{roundLabel(r.round)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function shortDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-AU',
    { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// A date, not "3 days ago" - a page left open overnight would otherwise keep
// saying today.
function whenAsked(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? `today at ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}`
    : `on ${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
}

function roundLabel(r: DocRound): string {
  return r === 'offer_accepted' ? 'once the offer is accepted'
    : r === 'formal_approval' ? 'once formally approved'
    : ''
}
