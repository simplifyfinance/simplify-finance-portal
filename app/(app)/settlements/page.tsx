'use client'
import { brokerLabel, sameBroker } from '@/lib/broker-key'
import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { todayYmd } from '@/lib/periods'
import {
  ATTENTION, STATE_LABEL, attentionFor, settlementDate, purposeLabel, isRefinance, isPurchase,
  stepLabel, monthOf, addMonths, monthLabel, businessDaysBetween,
  type SettlementState, type SettlementStep,
} from '@/lib/settlement'

const num = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? null : n
}
const compact = (n: number | null) => {
  if (n === null) return '—'
  const a = Math.abs(n)
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'm'
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'k'
  return '$' + Math.round(n)
}
const money = (n: number | null) => n === null ? '—' : '$' + Math.round(n).toLocaleString('en-AU')
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function dayLabel(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime())) return '—'
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()}`
}
function amountOf(d: any): number | null {
  return num(d.settled_total) ?? num(d.lodged_total) ?? num(d.loan_amount) ?? null
}

type Tone = 'ok' | 'warn' | 'stop' | 'flat' | 'cy'
function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const c = {
    ok: 'bg-[#F1F7F3] border-[#CFE6D5] text-[#25794C]',
    warn: 'bg-[#FDF6E7] border-[#EFE0BC] text-[#9A7B2E]',
    stop: 'bg-[#FBEDE9] border-[#EFCFC5] text-[#C4553B]',
    flat: 'bg-[#FAF7F2] border-[#E8E1D6] text-[#6E665C]',
    cy:   'bg-[#EAF7FE] border-[#BFE6F9] text-[#0E8FCB]',
  }[tone]
  return <span className={`inline-block text-[10px] font-bold uppercase tracking-[.04em] border rounded-full px-2 py-[2px] mr-1.5 whitespace-nowrap ${c}`}>{children}</span>
}

const GRID = 'grid grid-cols-[78px_1.6fr_1fr_1.05fr_96px_1.5fr_24px] gap-2.5 items-center'

// At module level on purpose. Declared inside the page component it is a new
// component type on every render, so React unmounts and remounts whatever it
// wraps - and every one of these wraps an input in the settlement edit panel.
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[.08em] text-[#A29889] mb-1">{label}</div>
      {children}
    </div>
  )
}


export default function SettlementsPage() {
  const supabase = createSupabaseBrowser()
  const today = todayYmd()
  const [deals, setDeals] = useState<any[]>([])
  const [brokers, setBrokers] = useState<{ key: string; name: string }[]>([])
  const [targets, setTargets] = useState<any[]>([])
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [scope, setScope] = useState('')
  const [view, setView] = useState<'board' | 'attention'>('board')
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data: u } = await supabase.auth.getUser()
    if (!u?.user) { setAllowed(false); setLoading(false); return }
    const { data: prof } = await supabase.from('user_profiles')
      .select('is_admin, sees_settlements').eq('id', u.user.id).single()
    if (!prof?.is_admin && !prof?.sees_settlements) { setAllowed(false); setLoading(false); return }
    setAllowed(true)

    const [d, b, t] = await Promise.all([
      supabase.from('deals').select('*').not('lodged_at', 'is', null),
      supabase.from('brokers').select('broker_key, name, active').order('name'),
      supabase.from('pipeline_targets').select('metric, month, amount, broker_key').eq('metric', 'settled'),
    ])
    if (d.error) { setLoadError(d.error.message); setLoading(false); return }
    setDeals(d.data || [])
    setBrokers((b.data || []).filter((r: any) => r.active !== false)
      .map((r: any) => ({ key: String(r.broker_key), name: r.name })))
    setTargets(t.error ? [] : (t.data || []))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const scoped = useMemo(
    () => deals.filter(d => !scope || sameBroker(d.assigned_broker, scope)),
    [deals, scope])

  // Confirmed and forecast for the month on screen. The grouping comes from the
  // deal's own timestamps, so nobody moves a row between blocks by hand.
  const groups = useMemo(() => {
    const inMonth = (d: any) => monthOf(settlementDate(d)) === month
    const confirmed = scoped.filter(d => !d.settled_at && d.formal_approval_at && inMonth(d))
    const forecast = scoped.filter(d =>
      !d.settled_at && !d.formal_approval_at && isRefinance(d) &&
      (inMonth(d) || (!settlementDate(d) && monthOf((d.lodged_at || '').slice(0, 10)) === month)))
    const settled = scoped.filter(d => d.settled_at && monthOf(String(d.settled_at).slice(0, 10)) === month)
    return { confirmed, forecast, settled }
  }, [scoped, month])

  const attention = useMemo(
    () => scoped.map(d => ({ d, a: attentionFor(d, today) })).filter(x => x.a) as { d: any; a: any }[],
    [scoped, today])

  const target = useMemo(() => {
    const row = targets.find(t => String(t.month).slice(0, 7) === month && (t.broker_key || '') === scope)
    return row ? num(row.amount) : null
  }, [targets, month, scope])

  const confirmedVol = groups.confirmed.reduce((t, d) => t + (amountOf(d) || 0), 0)
  const settledVol = groups.settled.reduce((t, d) => t + (amountOf(d) || 0), 0)
  const forecastVol = groups.forecast.reduce((t, d) => t + (amountOf(d) || 0), 0)
  const monthVol = confirmedVol + settledVol
  const hit = target ? monthVol / target * 100 : null

  function startEdit(d: any) {
    setMsg('')
    if (open === d.id) { setOpen(null); return }
    setOpen(d.id)
    setDraft({
      expected_settlement_date: d.expected_settlement_date || '',
      confirmed_settlement_date: d.confirmed_settlement_date || '',
      settlement_state: d.settlement_state || '',
      settlement_note: d.settlement_note || '',
      discharge_ready: d.discharge_ready,
      discharge_note: d.discharge_note || '',
      outstandings: d.outstandings || '',
      next_action: d.next_action || '',
      next_action_due: d.next_action_due || '',
      funds_to_complete_checked: !!d.funds_to_complete_checked,
      compliance_finalised: !!d.compliance_finalised,
      review_sent: !!d.review_sent,
      commission_paid: !!d.commission_paid,
    })
  }

  async function save(d: any, extra: Record<string, any> = {}) {
    setBusy(true); setMsg('')
    const { data: u } = await supabase.auth.getUser()
    const patch: any = {
      ...draft, ...extra,
      expected_settlement_date: (draft.expected_settlement_date || null) || null,
      confirmed_settlement_date: (draft.confirmed_settlement_date || null) || null,
      next_action_due: (draft.next_action_due || null) || null,
      settlement_state: draft.settlement_state || null,
      settlement_updated_at: new Date().toISOString(),
      settlement_updated_by: u?.user?.id || null,
    }
    if (patch.review_sent && !d.review_sent_at) patch.review_sent_at = today
    if (patch.compliance_finalised && !d.compliance_finalised_at) patch.compliance_finalised_at = today
    if (patch.funds_to_complete_checked && !d.funds_to_complete_at) patch.funds_to_complete_at = today

    const { data, error } = await supabase.from('deals').update(patch).eq('id', d.id).select('id')
    setBusy(false)
    if (error) { setMsg('NOT SAVED - ' + error.message); return }
    if (!data || data.length === 0) { setMsg('NOT SAVED - the database refused the change.'); return }
    await load()
    setOpen(null)
    setMsg(`${d.deal_name || 'Deal'} saved.`)
  }

  async function setStep(d: any, step: SettlementStep | null) {
    // Booking a settlement means a date exists. Enforced here rather than trusted.
    if (step === 'settlement_booked' && !(draft.confirmed_settlement_date || d.confirmed_settlement_date)) {
      setMsg('A confirmed settlement date is needed before this can be marked as booked.')
      return
    }
    await save(d, { settlement_step: step })
  }

  async function pushToNextMonth(d: any) {
    const date = settlementDate(d)
    const next = addMonths(monthOf(date) || month, 1) + '-15'
    if (!confirm(`Push ${d.deal_name} into ${monthLabel(addMonths(monthOf(date) || month, 1))}? The date becomes a mid-month estimate until someone sets a real one.`)) return
    setBusy(true)
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('deals').update({
      expected_settlement_date: next,
      confirmed_settlement_date: null,
      settlement_state: 'pushed',
      settlement_updated_at: new Date().toISOString(),
      settlement_updated_by: u?.user?.id || null,
    }).eq('id', d.id).select('id')
    setBusy(false)
    if (error || !data?.length) { setMsg('NOT SAVED - the push did not reach the database.'); return }
    await load()
    setMsg(`${d.deal_name} moved to ${monthLabel(addMonths(monthOf(date) || month, 1))}.`)
  }

  if (loading) return <div className="max-w-6xl mx-auto p-6 text-sm text-[#A29889]">Loading settlements…</div>
  if (allowed === false) return (
    <div className="max-w-6xl mx-auto p-6">
      <p className="text-lg font-medium text-[#2E2A26] mb-2">Settlements</p>
      <p className="text-sm text-[#6E665C]">You don&rsquo;t have access to settlements. An admin can grant it in Settings, Team, Access.</p>
    </div>
  )

  // Called directly, never written as <Row />. Declared inside this component,
  // it is a new component type on every render, so React would unmount and
  // remount the open edit panel on each keystroke and the field would lose
  // focus after one character. Calling it inlines the elements instead.
  function Row({ d }: { d: any }) {
    const a = attentionFor(d, today)
    const date = settlementDate(d)
    const isOpen = open === d.id
    const refi = isRefinance(d)
    return (
      <div className="border-b border-[#F6F2EA] last:border-0">
        <button onClick={() => startEdit(d)} className={`w-full text-left ${GRID} px-4 py-2.5 text-[13px] hover:bg-[#FCFAF6] transition`}>
          <span className="tabular-nums text-[#6E665C]">
            {d.confirmed_settlement_date ? <b className="text-[#2E2A26]">{dayLabel(date)}</b> : dayLabel(date)}
          </span>
          <span className="min-w-0">
            <span className="font-medium text-[#2E2A26] block truncate">{d.deal_name || '(unnamed)'}</span>
            <span className="text-[11px] text-[#A29889]">{brokerLabel(d.assigned_broker)}</span>
          </span>
          <span className="min-w-0">
            <span className="text-[#6E665C] block truncate">{d.lodged_lender || d.lender || '—'}</span>
            {d.lender_ref && <span className="text-[11px] text-[#A29889] block truncate">{d.lender_ref}</span>}
          </span>
          <span className="text-[#6E665C] truncate">{purposeLabel(d)}</span>
          <span className="text-right tabular-nums font-medium">{compact(amountOf(d))}</span>
          <span className="min-w-0">
            {d.settlement_state === 'confirmed' && <Chip tone="ok">Ready to settle</Chip>}
            {d.settlement_state === 'awaiting' && <Chip tone="warn">Awaiting details</Chip>}
            {d.settlement_state === 'at_risk' && <Chip tone="stop">At risk</Chip>}
            {d.settlement_state === 'pushed' && <Chip tone="flat">Pushed</Chip>}
            {d.settlement_step && <Chip tone="cy">{stepLabel(d.settlement_step, d.transaction_type)}</Chip>}
            {refi && d.discharge_ready === false && <Chip tone="warn">Chasing discharge</Chip>}
            {refi && d.discharge_ready === true && <Chip tone="ok">Discharge ready</Chip>}
            {d.settled_at && d.review_sent && <Chip tone="ok">Review sent</Chip>}
            {d.settled_at && !d.review_sent && <Chip tone="warn">Review not sent</Chip>}
            {d.settled_at && d.compliance_finalised && <Chip tone="ok">Compliance done</Chip>}
            {d.settled_at && d.commission_paid && <Chip tone="ok">Paid</Chip>}
            {a && !d.settled_at && <Chip tone={a.level === 'stale' ? 'stop' : 'warn'}>{a.why}</Chip>}
          </span>
          <span className="text-[#C9C1B4] text-[11px] text-center">{isOpen ? '⌄' : '›'}</span>
        </button>

        {isOpen && (
          <div className="px-4 pb-4 pt-1 bg-[#FDFCFA] border-t border-[#F6F2EA]">
            <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
              <F label="Expected settlement">
                <input type="date" value={draft.expected_settlement_date || ''}
                  onChange={e => setDraft({ ...draft, expected_settlement_date: e.target.value })} className={inp} />
              </F>
              <F label="Confirmed settlement date">
                <input type="date" value={draft.confirmed_settlement_date || ''}
                  onChange={e => setDraft({ ...draft, confirmed_settlement_date: e.target.value })} className={inp} />
              </F>
              <F label="Ready to settle">
                <select value={draft.settlement_state || ''} onChange={e => setDraft({ ...draft, settlement_state: e.target.value })} className={inp}>
                  <option value="">Not set</option>
                  {(['confirmed','awaiting','at_risk','pushed'] as SettlementState[]).map(s =>
                    <option key={s} value={s}>{STATE_LABEL[s]}</option>)}
                </select>
              </F>
              <F label="Latest update"><input value={draft.settlement_note || ''}
                onChange={e => setDraft({ ...draft, settlement_note: e.target.value })} className={inp} placeholder="e.g. settling 3pm" /></F>
              <F label="Outstandings"><input value={draft.outstandings || ''}
                onChange={e => setDraft({ ...draft, outstandings: e.target.value })} className={inp} placeholder="PEXA TOL, pending OFI" /></F>

              {refi && (
                <F label="Discharge form ready">
                  <select value={draft.discharge_ready === true ? 'yes' : draft.discharge_ready === false ? 'no' : ''}
                    onChange={e => setDraft({ ...draft, discharge_ready: e.target.value === '' ? null : e.target.value === 'yes' })}
                    className={inp}>
                    <option value="">Not set</option><option value="yes">Yes</option><option value="no">No</option>
                  </select>
                </F>
              )}
              {refi && draft.discharge_ready === false && (
                <F label="What is outstanding on the discharge">
                  <input value={draft.discharge_note || ''} onChange={e => setDraft({ ...draft, discharge_note: e.target.value })}
                    className={inp} placeholder="chasing the bank, client to call…" />
                </F>
              )}
              {isPurchase(d) && (
                <F label="Funds to complete">
                  <label className="flex items-center gap-2 text-[12.5px] text-[#2E2A26] py-1.5">
                    <input type="checkbox" checked={!!draft.funds_to_complete_checked}
                      onChange={e => setDraft({ ...draft, funds_to_complete_checked: e.target.checked })} />
                    Checked with the solicitor
                  </label>
                </F>
              )}

              <F label="Next action"><input value={draft.next_action || ''}
                onChange={e => setDraft({ ...draft, next_action: e.target.value })} className={inp} /></F>
              <F label="Due"><input type="date" value={draft.next_action_due || ''}
                onChange={e => setDraft({ ...draft, next_action_due: e.target.value })} className={inp} /></F>

              {d.settled_at && <>
                <F label="After settlement">
                  <label className="flex items-center gap-2 text-[12.5px] py-1"><input type="checkbox"
                    checked={!!draft.review_sent} onChange={e => setDraft({ ...draft, review_sent: e.target.checked })} />Google review sent</label>
                  <label className="flex items-center gap-2 text-[12.5px] py-1"><input type="checkbox"
                    checked={!!draft.compliance_finalised} onChange={e => setDraft({ ...draft, compliance_finalised: e.target.checked })} />Compliance finalised</label>
                  <label className="flex items-center gap-2 text-[12.5px] py-1"><input type="checkbox"
                    checked={!!draft.commission_paid} onChange={e => setDraft({ ...draft, commission_paid: e.target.checked })} />Commission paid</label>
                </F>
              </>}
            </div>

            {!d.settled_at && (
              <div className="flex gap-2 items-center flex-wrap mt-3">
                <span className="text-[10px] font-bold uppercase tracking-[.08em] text-[#A29889] mr-1">Step</span>
                {(['contracts_returned','settlement_booked'] as SettlementStep[]).map(s => (
                  <button key={s} onClick={() => setStep(d, d.settlement_step === s ? null : s)} disabled={busy}
                    className={`text-[12px] rounded-lg px-3 py-1.5 border transition ${d.settlement_step === s
                      ? 'bg-[#343333] border-[#343333] text-white font-semibold'
                      : 'bg-white border-[#E8E1D6] text-[#6E665C] hover:bg-[#FAF7F2]'}`}>
                    {stepLabel(s, d.transaction_type)}
                  </button>
                ))}
                <span className="text-[11px] text-[#A29889]">optional · a deal can skip either</span>
              </div>
            )}

            <div className="flex gap-2 items-center flex-wrap mt-3">
              <button onClick={() => save(d)} disabled={busy}
                className="bg-[#343333] text-white rounded-lg px-4 py-2 text-[12.5px] font-semibold hover:bg-[#2a2a2a] transition disabled:opacity-40">
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setOpen(null)} className="text-[12px] text-[#A29889] hover:text-[#2E2A26]">Cancel</button>
              {!d.settled_at && (
                <button onClick={() => pushToNextMonth(d)} disabled={busy}
                  className="text-[12px] text-[#A29889] hover:text-[#C4553B]">No chance this month → push</button>
              )}
              <Link href={`/deals/${d.id}`} className="text-[12px] text-[#0E8FCB] hover:underline ml-auto">Open the deal ›</Link>
            </div>
          </div>
        )}
      </div>
    )
  }

  const inp = 'w-full text-[12.5px] border border-[#E8E1D6] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#2DBEFF]'
  function Group({ title, sub, rows }: { title: string; sub: string; rows: any[] }) {
    return (
      <>
        <div className="flex items-baseline gap-3 mt-6 mb-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-[.08em] text-[#A29889]">{title}</span>
          <span className="text-[11.5px] text-[#C9C1B4]">{sub}</span>
        </div>
        <div className="bg-white border border-[#EDE7DD] rounded-xl overflow-hidden">
          <div className={`${GRID} px-4 py-2 text-[10px] font-semibold tracking-[.085em] uppercase text-[#A29889] border-b border-[#F6F2EA]`}>
            <span>Settles</span><span>Deal</span><span>Lender</span><span>Purpose</span>
            <span className="text-right">Amount</span><span>State</span><span />
          </div>
          {rows.length === 0
            ? <div className="px-4 py-6 text-center text-[13px] text-[#A29889]">Nothing here for {monthLabel(month)}.</div>
            : rows.map(d => <Fragment key={d.id}>{Row({ d })}</Fragment>)}
        </div>
      </>
    )
  }

  const sorted = (rows: any[]) => [...rows].sort((a, b) =>
    String(settlementDate(a) || '9999').localeCompare(String(settlementDate(b) || '9999')))

  return (
    <div className="max-w-6xl mx-auto p-6">
      <p className="text-lg font-medium text-[#343333] mb-1">Settlements</p>
      <p className="text-[12.5px] text-[#A29889] mb-4 max-w-[86ch]">
        Every deal expected to settle, grouped by how far along it is. The grouping comes from the deal itself,
        so nobody moves rows between blocks.
      </p>

      <div className="bg-[#FAF7F2] border border-[#E8E1D6] rounded-xl p-3 flex items-center gap-3 flex-wrap mb-4">
        <button onClick={() => setMonth(addMonths(month, -1))} className="w-[26px] h-[26px] rounded-lg border border-[#E8E1D6] bg-white text-[#6E665C]">‹</button>
        <span className="text-[13.5px] font-semibold min-w-[126px] text-center">{monthLabel(month)}</span>
        <button onClick={() => setMonth(addMonths(month, 1))} className="w-[26px] h-[26px] rounded-lg border border-[#E8E1D6] bg-white text-[#6E665C]">›</button>
        <span className="w-px h-5 bg-[#E8E1D6]" />
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setScope('')} className={pill(scope === '')}>All brokers</button>
          {brokers.map(b => (
            <button key={b.key} onClick={() => setScope(b.key)} className={pill(scope === b.key)}>{b.name.split(' ')[0]}</button>
          ))}
        </div>
        <span className="ml-auto flex gap-2">
          <button onClick={() => setView(view === 'board' ? 'attention' : 'board')}
            className="bg-white border border-[#E8E1D6] rounded-lg px-3 py-1.5 text-[12.5px] text-[#6E665C] hover:bg-[#F4EEE4]">
            {view === 'board' ? 'Needs attention' : 'Back to the month'}
          </button>
        </span>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-2.5 mb-3 text-[12.5px] border ${msg.startsWith('NOT SAVED')
          ? 'bg-red-50 border-red-200 text-red-700 font-medium' : 'bg-white border-[#EDE7DD] text-[#6E665C]'}`}>{msg}</div>
      )}
      {loadError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-3">{loadError}</div>}

      {view === 'attention' ? (
        <>
          <div className="flex items-baseline gap-3 mb-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-[.08em] text-[#A29889]">Needs attention</span>
            <span className="text-[11.5px] text-[#C9C1B4]">
              no update in {ATTENTION.staleBusinessDays} business days, within {ATTENTION.closeBusinessDays} of settling,
              or a purchase whose funds to complete are unchecked
            </span>
          </div>
          <div className="bg-white border border-[#EDE7DD] rounded-xl overflow-hidden">
            {attention.length === 0
              ? <div className="px-4 py-8 text-center text-[13px] text-[#A29889]">Nothing needs chasing. </div>
              : attention
                  .sort((x, y) => String(settlementDate(x.d) || '9999').localeCompare(String(settlementDate(y.d) || '9999')))
                  .map(({ d }) => <Fragment key={d.id}>{Row({ d })}</Fragment>)}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
            <Tile label="Confirmed to settle" value={compact(confirmedVol || null)} sub={`${groups.confirmed.length} deals formally approved`} />
            <Tile label="Settled this month" value={compact(settledVol || null)} sub={`${groups.settled.length} deals`} />
            <Tile label="Against target" value={hit === null ? 'no target' : Math.round(hit) + '%'}
              sub={target ? `${compact(Math.abs(monthVol - target))} ${monthVol >= target ? 'ahead of' : 'short of'} ${compact(target)}` : 'no settled target for this month'}
              tone={hit === null ? undefined : hit >= 100 ? 'up' : 'down'} meter={hit} />
            <Tile label="Needs attention" value={String(attention.length)}
              sub="click to see them" onClick={() => setView('attention')} />
          </div>

          {Group({ title: 'Confirmed to settle', rows: sorted(groups.confirmed),
            sub: `${groups.confirmed.length} deals · ${compact(confirmedVol || null)} · formally approved` })}
          {Group({ title: 'Submitted, not yet formal', rows: sorted(groups.forecast),
            sub: `${groups.forecast.length} deals · ${compact(forecastVol || null)} · refinances lodged and still possible this month` })}
          {Group({ title: 'Settled this month', rows: sorted(groups.settled),
            sub: `${groups.settled.length} deals · ${compact(settledVol || null)} · reviews, compliance and commission` })}
        </>
      )}
    </div>
  )
}

function pill(on: boolean) {
  return `rounded-full px-3 py-1.5 text-[12.5px] font-medium border transition-colors ${on
    ? 'bg-[#343333] border-[#343333] text-white font-semibold'
    : 'border-[#E8E1D6] bg-white text-[#6E665C] hover:bg-[#FAF7F2] hover:text-[#2E2A26]'}`
}

function Tile({ label, value, sub, tone, meter, onClick }:
  { label: string; value: string; sub?: string; tone?: 'up' | 'down'; meter?: number | null; onClick?: () => void }) {
  const inner = (
    <>
      <div className="text-[10px] font-bold tracking-[.09em] uppercase text-[#A29889] mb-1.5">{label}</div>
      <div className="text-2xl font-semibold text-[#343333] tracking-tight">{value}</div>
      {sub && <div className={`text-[11.5px] mt-0.5 ${tone === 'up' ? 'text-[#2E9E63]' : tone === 'down' ? 'text-[#C4553B]' : 'text-[#A29889]'}`}>{sub}</div>}
      {meter !== null && meter !== undefined && (
        <div className="h-[5px] bg-[#F4EEE4] rounded-full mt-2 overflow-hidden">
          <div className={`h-full rounded-full ${meter >= 100 ? 'bg-[#2E9E63]' : 'bg-[#8C8375]'}`} style={{ width: Math.min(100, meter) + '%' }} />
        </div>
      )}
    </>
  )
  const cls = 'bg-white border border-[#EDE7DD] rounded-xl p-4 text-left'
  return onClick
    ? <button onClick={onClick} className={cls + ' hover:border-[#C9C0B1] transition'}>{inner}</button>
    : <div className={cls}>{inner}</div>
}
