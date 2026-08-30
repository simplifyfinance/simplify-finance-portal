'use client'
import DropZone from '@/components/DropZone'
import CommissionRevenue from '@/components/CommissionRevenue'
import TrailBook from '@/components/TrailBook'
import MissingStatements from '@/components/MissingStatements'
import MissedTrail from '@/components/MissedTrail'
import ClawbackWatch from '@/components/ClawbackWatch'
import SettlementReconcile from '@/components/SettlementReconcile'
import CommissionByMonth from '@/components/CommissionByMonth'
import { COMMISSION_START } from '@/lib/commission-schedule'
import { money } from '@/lib/tone'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { todayYmd } from '@/lib/periods'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const label = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`

// Every month from July 2025 to the month we are in.
function monthsSince(start = COMMISSION_START): string[] {
  const out: string[] = []
  let [y, m] = [Number(start.slice(0, 4)), Number(start.slice(5, 7))]
  const now = todayYmd().slice(0, 7)
  for (let guard = 0; guard < 120; guard++) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push(key)
    if (key >= now) break
    m += 1; if (m > 12) { m = 1; y += 1 }
  }
  return out
}

export default function CommissionsPage() {
  const supabase = createSupabaseBrowser()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [statements, setStatements] = useState<any[]>([])
  const [brokers, setBrokers] = useState<{ key: string; name: string; from: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [err, setErr] = useState('')

  async function load() {
    const { data: u } = await supabase.auth.getUser()
    if (!u?.user) { setAllowed(false); return }
    const { data: p } = await supabase.from('user_profiles')
      .select('is_admin, sees_finance').eq('id', u.user.id).single()
    if (!p?.is_admin && !p?.sees_finance) { setAllowed(false); return }
    setAllowed(true)
    const [s, b] = await Promise.all([
      supabase.from('commission_statements').select('*').order('period_month'),
      supabase.from('brokers').select('broker_key, name, commission_from').order('name'),
    ])
    setStatements(s.data || [])
    setBrokers((b.data || []).map((r: any) => ({
      key: r.broker_key, name: r.name,
      // Before this month the broker was not earning here, so an empty cell
      // is the truth rather than a missing upload.
      from: String(r.commission_from || '').slice(0, 7),
    })))
  }
  useEffect(() => { load() }, [])

  async function upload(files: File[]) {
    if (!files || files.length === 0) return
    setBusy(true); setErr(''); setResults([])
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    try {
      const res = await fetch('/api/commission-import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setErr(json.error || 'The upload was refused.'); setBusy(false); return }
      setResults(json.results || [])
      await load()
    } catch (e: any) {
      setErr(e?.message || 'The upload failed.')
    } finally { setBusy(false) }
  }

  const months = useMemo(() => monthsSince(), [])
  const have = useMemo(() => {
    const s = new Set<string>()
    for (const st of statements) s.add(`${st.broker_key}|${st.kind}|${String(st.period_month).slice(0, 7)}`)
    return s
  }, [statements])

  // brokers that actually have statements, so an empty broker does not fill the grid
  const gridBrokers = useMemo(() => {
    const keys = new Set(statements.map(s => s.broker_key))
    const known = brokers.filter(b => keys.has(b.key))
    return known.length ? known : brokers.slice(0, 2)
  }, [brokers, statements])

  const byMonth = useMemo(() => {
    const m: Record<string, { gross: number; third: number; claw: number; banked: number }> = {}
    for (const s of statements) {
      const k = String(s.period_month).slice(0, 7)
      if (!m[k]) m[k] = { gross: 0, third: 0, claw: 0, banked: 0 }
      m[k].gross += Number(s.gross_ex_gst || 0)
      m[k].third += Number(s.third_party_ex_gst || 0)
      m[k].claw += Number(s.clawback_ex_gst || 0)
      m[k].banked += Number(s.banked_ex_gst || 0)
    }
    return m
  }, [statements])

  if (allowed === null) return <div className="max-w-6xl mx-auto p-6 text-sm text-[#7A7266]">Loading…</div>
  if (allowed === false) return (
    <div className="max-w-6xl mx-auto p-6">
      <p className="text-lg font-medium text-[#2E2A26] mb-2">Commissions</p>
      <p className="text-sm text-[#6E665C]">Commissions are finance only.</p>
    </div>
  )

  const card = 'bg-white border border-[#EDE7DD] rounded-xl'
  const k = 'text-[10px] font-bold tracking-[.09em] uppercase text-[#7A7266] mb-1'

  return (
    <div className="max-w-6xl mx-auto p-6">
      <p className="text-lg font-medium text-[#343333] mb-1">Commissions</p>
      <p className="text-[12.5px] text-[#7A7266] mb-5 max-w-[86ch]">
        Drop every SFG statement — trail and upfront, both brokers, any month. Each file says which broker and
        which period it belongs to, so the order does not matter and the same file cannot be loaded twice.
      </p>

      {statements.length > 0 && <MissingStatements statements={statements} brokers={brokers} />}

      {statements.length > 0 && (
        <>
          <div className="text-[11px] font-bold uppercase tracking-[.08em] text-[#7A7266] mb-2">
            What has been loaded
          </div>
          <div className={card + ' overflow-x-auto mb-5'}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-[.085em] text-[#7A7266] border-b border-[#F6F2EA]">Broker</th>
                  {months.map(m => (
                    <th key={m} className="px-1.5 py-2 text-[10px] font-semibold uppercase tracking-[.05em] text-[#7A7266] border-b border-[#F6F2EA] whitespace-nowrap">{label(m)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridBrokers.map(b => (['trail', 'upfront'] as const).map(kind => (
                  <tr key={b.key + kind} className="border-b border-[#F6F2EA] last:border-0">
                    <td className="px-4 py-1.5 text-[12.5px] text-[#6E665C] whitespace-nowrap">
                      {b.name.split(' ')[0]} <span className="text-[#B3ABA0]">{kind}</span>
                    </td>
                    {months.map(m => {
                      const yes = have.has(`${b.key}|${kind}|${m}`)
                      const before = !!b.from && m < b.from
                      return (
                        <td key={m} className="px-1.5 py-1.5 text-center">
                          {before ? (
                            <span className="inline-block w-[18px] h-[18px] leading-[18px] text-[#D8D1C5] text-[13px]"
                                  title={`${b.name.split(' ')[0]} was not earning in ${m}`}>·</span>
                          ) : (
                            <span className={`inline-block w-[18px] h-[18px] rounded-[5px] ${yes ? 'bg-[#2E9E63]' : 'bg-[#F4EEE4] border border-[#E8E1D6]'}`}
                                  title={yes ? `${m} loaded` : `${m} missing`} />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )))}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-[#F6F2EA] text-[11.5px] text-[#7A7266]">
              Filled means loaded. Empty means that month has never been uploaded. A dot means the broker was
              not earning yet, so there is nothing to load.
            </div>
          </div>
        </>
      )}



      <div className={card + ' p-5 mb-5'}>
        <DropZone accept=".xlsx" busy={busy}
          title="Drop SFG statements here, or click to choose"
          hint=".xlsx only · as many as you like, any month, either broker"
          onFiles={files => upload(files)} />
        {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-[12.5px] mt-3">{err}</div>}
      </div>

      {results.length > 0 && (
        <div className={card + ' overflow-hidden mb-5'}>
          <div className="px-4 py-2.5 border-b border-[#F6F2EA] text-[13px] font-semibold text-[#2E2A26]">
            {results.filter(r => r.status === 'imported').length} imported ·{' '}
            {results.filter(r => r.status === 'duplicate').length} already loaded ·{' '}
            {results.filter(r => r.status === 'rejected').length} refused
          </div>
          {results.map((r, i) => (
            <div key={i} className="px-4 py-3 border-b border-[#F6F2EA] last:border-0">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-[.05em] rounded-full px-2 py-[2px] border ${
                  r.status === 'imported' ? 'bg-[#F1F7F3] border-[#CFE6D5] text-[#25794C]'
                  : r.status === 'duplicate' ? 'bg-[#FAF7F2] border-[#E8E1D6] text-[#6E665C]'
                  : 'bg-[#FBEDE9] border-[#EFCFC5] text-[#C4553B]'}`}>
                  {r.status === 'imported' ? 'Imported' : r.status === 'duplicate' ? 'Already loaded' : 'Refused'}
                </span>
                <span className="text-[13px] font-medium text-[#2E2A26]">{r.name}</span>
                {r.period && <span className="text-[12px] text-[#7A7266]">{r.kind} · {r.period} · {r.broker}</span>}
              </div>
              {r.status === 'imported' && (
                <div className="text-[12px] text-[#6E665C] mt-1">
                  {r.rows} lines · gross {money(r.gross)}
                  {r.clawback ? ` · clawbacks ${money(r.clawback)}` : ''}
                  {r.referrals ? ` · referrals ${money(r.referrals)}` : ''}
                  {r.thirdParty ? ` · to third parties ${money(-Math.abs(r.thirdParty))}` : ''}
                  {' · banked '}<b>{money(r.banked)}</b>
                  {r.unknownLenders?.length > 0 && (
                    <span className="text-[#B4761F]"> · lenders not in the register: {r.unknownLenders.join(', ')}</span>
                  )}
                </div>
              )}
              {r.detail && <div className="text-[12px] text-[#6E665C] mt-1">{r.detail}</div>}
            </div>
          ))}
        </div>
      )}

      {statements.length > 0 && (
        <>
          <div className="text-[11px] font-bold uppercase tracking-[.08em] text-[#7A7266] mb-2">
            Revenue
          </div>
          <CommissionRevenue statements={statements} brokers={brokers} />

          <div className="text-[11px] font-bold uppercase tracking-[.08em] text-[#7A7266] mb-2">By month</div>
          <CommissionByMonth statements={statements} />

          <div className="text-[11px] font-bold uppercase tracking-[.08em] text-[#7A7266] mb-2">
            The trail book
          </div>
          <TrailBook brokers={brokers} />

          <div className="text-[11px] font-bold uppercase tracking-[.08em] text-[#7A7266] mb-2">
            Trail that went missing
          </div>
          <MissedTrail brokers={brokers} />

          <ClawbackWatch brokers={brokers} />

          <div className="text-[11px] font-bold uppercase tracking-[.08em] text-[#7A7266] mb-2">
            Settlements against what SFG paid
          </div>
          <SettlementReconcile brokers={brokers} />

        </>
      )}
    </div>
  )
}
