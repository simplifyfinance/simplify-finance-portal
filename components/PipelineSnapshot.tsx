'use client'
import { useMemo } from 'react'
import { fyEndYear, todayYmd } from '@/lib/periods'

type Metric = 'lodged' | 'settled'
type Mon = Record<string, { amount: number; deals: number; source: 'spreadsheet' | 'portal' }>

type Props = {
  hist: any[]
  dealRows: any[]
  targets: any[]
  brokers: { key: string; name: string }[]
  onPickBroker?: (key: string) => void
}

function n(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const x = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return isNaN(x) ? null : x
}
function compact(v: number | null): string {
  if (v === null) return '—'
  const a = Math.abs(v)
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'm'
  if (a >= 1e3) return '$' + Math.round(v / 1e3) + 'k'
  return '$' + Math.round(v)
}
function signed(p: number): string {
  return (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(1) + '%'
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

export default function PipelineSnapshot({ hist, dealRows, targets, brokers, onPickBroker }: Props) {
  const fy = fyEndYear(todayYmd())
  const fyStart = `${fy - 1}-07-01`
  const fyEnd = `${fy}-06-01`
  const today = todayYmd()
  const thisMonth = today.slice(0, 7)

  // The business month by month, the spreadsheet winning wherever it holds a month.
  const business = useMemo(() => {
    const build = (metric: Metric): Mon => {
      const m: Mon = {}
      for (const h of hist) {
        const k = String(h.month).slice(0, 7)
        const amount = n(metric === 'lodged' ? h.lodged_amount : h.settled_amount)
        const deals = n(metric === 'lodged' ? h.deals_lodged : h.deals_settled)
        if (amount !== null) m[k] = { amount, deals: deals || 0, source: 'spreadsheet' }
      }
      for (const r of dealRows) {
        const d = metric === 'lodged' ? r.lodgedDate : r.settledDate
        if (!d) continue
        const k = d.slice(0, 7)
        if (m[k]?.source === 'spreadsheet') continue
        if (!m[k]) m[k] = { amount: 0, deals: 0, source: 'portal' }
        m[k].amount += (metric === 'lodged' ? r.lodgedAmount : r.settledAmount) || 0
        m[k].deals += 1
      }
      return m
    }
    return { lodged: build('lodged'), settled: build('settled') }
  }, [hist, dealRows])

  const targetOf = useMemo(() => (metric: Metric, brokerKey: string | null) => {
    const m: Record<string, number> = {}
    for (const t of targets) {
      if (t.metric !== metric) continue
      if ((t.broker_key || null) !== brokerKey) continue
      const a = n(t.amount)
      if (a !== null) m[String(t.month).slice(0, 7)] = a
    }
    return m
  }, [targets])

  // Everything is measured over the months actually recorded - never the whole
  // year, and never counting a month nobody has entered as a zero.
  function head(metric: Metric) {
    const mon = business[metric]
    const tgt = targetOf(metric, null)
    const keys = Object.keys(mon).filter(k => k + '-01' >= fyStart && k + '-01' <= today).sort()
    let now = 0, target = 0, then = 0, comparable = 0, sheet = false
    for (const k of keys) {
      now += mon[k].amount
      if (mon[k].source === 'spreadsheet') sheet = true
      const t = tgt[k]
      if (t) {
        if (k === thisMonth) {
          const y = Number(k.slice(0, 4)), mo = Number(k.slice(5, 7))
          const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate()
          target += t * Number(today.slice(8, 10)) / dim
        } else target += t
      }
      const prior = `${Number(k.slice(0, 4)) - 1}-${k.slice(5)}`
      if (mon[prior]) { then += mon[prior].amount; comparable += 1 }
    }
    let fullYear = 0
    for (const [k, v] of Object.entries(tgt)) if (k + '-01' >= fyStart && k + '-01' <= fyEnd) fullYear += v
    return { now, target, then, keys, comparable, fullYear, sheet,
             month: mon[thisMonth] || null, monthTarget: tgt[thisMonth] ?? null }
  }

  const L = head('lodged')
  const S = head('settled')

  const cards = useMemo(() => brokers.map(b => {
    let lodged = 0, lodgedDeals = 0, settled = 0, settledDeals = 0, monthLodged = 0, monthSettled = 0
    for (const r of dealRows) {
      if ((r.broker || '').toLowerCase() !== b.key) continue
      const ld = r.lodgedDate, sd = r.settledDate
      if (ld && L.keys.includes(ld.slice(0, 7))) { lodged += r.lodgedAmount || 0; lodgedDeals += 1 }
      if (sd && S.keys.includes(sd.slice(0, 7))) { settled += r.settledAmount || 0; settledDeals += 1 }
      if (ld && ld.slice(0, 7) === thisMonth) monthLodged += r.lodgedAmount || 0
      if (sd && sd.slice(0, 7) === thisMonth) monthSettled += r.settledAmount || 0
    }
    const lt = targetOf('lodged', b.key), st = targetOf('settled', b.key)
    let lodgedTarget = 0, settledTarget = 0
    for (const k of L.keys) if (lt[k]) lodgedTarget += lt[k]
    for (const k of S.keys) if (st[k]) settledTarget += st[k]
    return { ...b, lodged, lodgedDeals, lodgedTarget, settled, settledDeals, settledTarget,
             monthLodged, monthSettled }
  }), [brokers, dealRows, targetOf, L.keys, S.keys, thisMonth])

  const card = 'bg-white border border-[#EDE7DD] rounded-2xl'
  const kk = 'text-[10px] font-bold tracking-[.09em] uppercase text-[#A29889]'

  function Head({ label, h }: { label: string; h: ReturnType<typeof head> }) {
    const hit = h.target > 0 ? h.now / h.target * 100 : null
    const diff = h.target > 0 ? h.now - h.target : null
    const good = diff !== null && diff >= 0
    return (
      <div className={card + ' p-5'}>
        <div className={kk}>{label}</div>
        <div className="text-[33px] font-semibold tracking-[-.025em] text-[#2E2A26] leading-[1.1] mt-1">{compact(h.now || null)}</div>
        <div className="text-[12.5px] text-[#A29889]">
          {h.target > 0
            ? <>of {compact(h.target)} targeted for the months recorded · <b className="text-[#2E2A26]">{Math.round(hit as number)}%</b></>
            : 'no target set for the months recorded'}
        </div>
        <div className="h-[8px] bg-[#F4EEE4] rounded-full my-3 overflow-hidden">
          <div className={`h-full rounded-full ${good ? 'bg-[#2E9E63]' : 'bg-[#C4553B]'}`}
               style={{ width: Math.min(100, hit ?? 0) + '%' }} />
        </div>
        <div className="flex justify-between gap-2 flex-wrap text-[12px]">
          <span className={diff === null ? 'text-[#A29889]' : good ? 'text-[#2E9E63] font-semibold' : 'text-[#C4553B] font-semibold'}>
            {diff === null ? '—' : `${compact(Math.abs(diff))} ${good ? 'ahead' : 'behind'}`}
          </span>
          <span className="text-[#A29889]">
            {h.fullYear > 0 ? `${compact(h.fullYear)} for the full year · ${Math.round(h.now / h.fullYear * 100)}% of it done` : ''}
          </span>
        </div>
        <div className="flex justify-between gap-2 flex-wrap text-[12px] mt-1">
          <span className={h.comparable === 0 ? 'text-[#A29889]'
            : h.now >= h.then ? 'text-[#2E9E63] font-semibold' : 'text-[#C4553B] font-semibold'}>
            {h.comparable === 0 ? 'no comparable months held' : `${signed((h.now - h.then) / h.then * 100)} on the same point last year`}
          </span>
          <span className="text-[#A29889]">{h.keys.length} of 12 months recorded</span>
        </div>
      </div>
    )
  }

  function MonthCell({ label, value, target }: { label: string; value: number | null; target: number | null }) {
    const hit = value !== null && target ? value / target * 100 : null
    return (
      <div className={card + ' px-4 py-3.5'}>
        <div className={kk + ' mb-1'}>{label}</div>
        <div className="text-[21px] font-semibold tracking-[-.02em] text-[#2E2A26]">{compact(value)}</div>
        <div className="text-[11.5px] mt-0.5">
          {value === null
            ? <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-[#FDF6E7] border border-[#EFE0BC] text-[#9A7B2E] rounded-full px-2 py-[2px]">Not recorded</span>
            : hit === null
              ? <span className="text-[#A29889]">no target</span>
              : <span className={hit >= 100 ? 'text-[#2E9E63] font-semibold' : 'text-[#C4553B] font-semibold'}>
                  {Math.round(hit)}% <span className="text-[#C9C1B4] font-normal">of {compact(target)}</span>
                </span>}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2.5">
        <span className="text-[13px] font-semibold text-[#2E2A26]">
          The business · FY{String(fy).slice(2)} so far
        </span>
        <span className="text-[11.5px] text-[#A29889]">
          measured against the target for the months recorded, never the whole year
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        <Head label="Lodged" h={L} />
        <Head label="Settled" h={S} />
      </div>

      {!L.month && (
        <div className="flex items-start gap-3 bg-[#FDF6E7] border border-[#EFE0BC] rounded-xl px-4 py-3 mt-3">
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="#B4761F" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 mt-[2px]"><circle cx="8" cy="8" r="6.2"/><path d="M8 5v3.4M8 10.8v.2"/></svg>
          <span className="text-[12.5px] text-[#7A5F17]">
            <strong className="text-[#5E4A11]">Nothing is recorded for this month yet.</strong>{' '}
            It is left out of every figure above rather than counted as a zero. Enter it in Monthly actuals and
            the page moves.
          </span>
        </div>
      )}

      <div className="text-[13px] font-semibold text-[#2E2A26] mt-5 mb-2.5">This month</div>
      <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
        <MonthCell label="Lodged" value={L.month ? L.month.amount : null} target={L.monthTarget} />
        <MonthCell label="Settled" value={S.month ? S.month.amount : null} target={S.monthTarget} />
        <div className={card + ' px-4 py-3.5'}>
          <div className={kk + ' mb-1'}>Lodged target</div>
          <div className="text-[21px] font-semibold tracking-[-.02em] text-[#2E2A26]">{compact(L.monthTarget)}</div>
          <div className="text-[11.5px] text-[#A29889] mt-0.5">for the whole month</div>
        </div>
        <div className={card + ' px-4 py-3.5'}>
          <div className={kk + ' mb-1'}>Settled target</div>
          <div className="text-[21px] font-semibold tracking-[-.02em] text-[#2E2A26]">{compact(S.monthTarget)}</div>
          <div className="text-[11.5px] text-[#A29889] mt-0.5">for the whole month</div>
        </div>
      </div>

      {cards.length > 0 && (
        <>
          <div className="flex items-baseline justify-between gap-3 flex-wrap mt-5 mb-2.5">
            <span className="text-[13px] font-semibold text-[#2E2A26]">Brokers · against their own target</span>
            <span className="text-[11.5px] text-[#A29889]">click a broker to filter everything below</span>
          </div>

          {L.sheet && (
            <div className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-xl px-4 py-2.5 text-[12.5px] mb-3">
              The business figure for these months came from the spreadsheet, which has no broker split. Broker
              figures below count only deals marked through the portal, so they will read low until the team is
              marking deals here. Share of the business is left out for that reason.
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
            {cards.map(b => {
              const half = (value: number, target: number, label: string, month: number, deals: number) => {
                const hit = target > 0 ? value / target * 100 : null
                const good = hit !== null && hit >= 100
                return (
                  <div>
                    <div className={kk + ' mb-1'}>{label}</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[19px] font-semibold tracking-[-.02em] text-[#2E2A26]">{compact(value || null)}</span>
                      <span className={`text-[12px] font-semibold ${hit === null ? 'text-[#A29889]' : good ? 'text-[#2E9E63]' : 'text-[#C4553B]'}`}>
                        {hit === null ? 'no target' : Math.round(hit) + '%'}
                      </span>
                    </div>
                    <div className="h-[5px] bg-[#F4EEE4] rounded-full my-2 overflow-hidden">
                      <div className={`h-full rounded-full ${good ? 'bg-[#2E9E63]' : 'bg-[#C4553B]'}`}
                           style={{ width: Math.min(100, hit ?? 0) + '%' }} />
                    </div>
                    <div className="text-[11.5px] text-[#A29889]">
                      {target > 0 ? `of ${compact(target)} to date` : 'no target set'}
                    </div>
                    <div className="text-[11.5px] text-[#A29889]">
                      {deals} deal{deals === 1 ? '' : 's'} · {month ? compact(month) : 'nothing'} this month
                    </div>
                  </div>
                )
              }
              return (
                <button key={b.key} type="button" onClick={() => onPickBroker && onPickBroker(b.key)}
                  className={card + ' p-4 text-left hover:border-[#C9C0B1] transition'}>
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <span className="w-[30px] h-[30px] rounded-[9px] bg-[#343333] text-white text-[12px] font-bold flex items-center justify-center shrink-0">
                      {initials(b.name)}
                    </span>
                    <span>
                      <span className="block text-[13.5px] font-semibold text-[#2E2A26] leading-tight">{b.name}</span>
                      <span className="block text-[11px] text-[#A29889]">FY{String(fy).slice(2)} so far</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {half(b.lodged, b.lodgedTarget, 'Lodged', b.monthLodged, b.lodgedDeals)}
                    {half(b.settled, b.settledTarget, 'Settled', b.monthSettled, b.settledDeals)}
                  </div>
                  {!L.sheet && L.now > 0 && (
                    <div className="flex justify-between text-[12px] pt-2.5 mt-2.5 border-t border-[#F6F2EA]">
                      <span className="text-[#A29889]">Share of the business</span>
                      <span className="font-semibold tabular-nums">{Math.round(b.lodged / L.now * 100)}%</span>
                    </div>
                  )}
                  <div className="text-[11.5px] text-[#0E8FCB] pt-2.5 mt-2.5 border-t border-[#F6F2EA]">
                    Open {b.name.split(' ')[0]}&rsquo;s month-by-month &rsaquo;
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
