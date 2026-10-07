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
  brokerHist?: any[]
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

export default function PipelineSnapshot({ hist, dealRows, targets, brokers, brokerHist = [], onPickBroker }: Props) {
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
    // A figure typed on the broker's profile wins over deals counted here, month
    // by month - the same rule the business figures follow.
    const typed: Record<string, { lodged: number | null; settled: number | null; dl: number | null; ds: number | null }> = {}
    for (const row of brokerHist) {
      if (String(row.broker_key || '').toLowerCase() !== b.key) continue
      typed[String(row.month).slice(0, 7)] = {
        lodged: n(row.lodged_amount), settled: n(row.settled_amount),
        dl: n(row.deals_lodged), ds: n(row.deals_settled),
      }
    }
    let lodged = 0, lodgedDeals = 0, settled = 0, settledDeals = 0, monthLodged = 0, monthSettled = 0
    for (const r of dealRows) {
      if ((r.broker || '').toLowerCase() !== b.key) continue
      const ld = r.lodgedDate, sd = r.settledDate
      if (ld && L.keys.includes(ld.slice(0, 7)) && typed[ld.slice(0, 7)]?.lodged == null) { lodged += r.lodgedAmount || 0; lodgedDeals += 1 }
      if (sd && S.keys.includes(sd.slice(0, 7)) && typed[sd.slice(0, 7)]?.settled == null) { settled += r.settledAmount || 0; settledDeals += 1 }
      if (ld && ld.slice(0, 7) === thisMonth && typed[thisMonth]?.lodged == null) monthLodged += r.lodgedAmount || 0
      if (sd && sd.slice(0, 7) === thisMonth && typed[thisMonth]?.settled == null) monthSettled += r.settledAmount || 0
    }
    for (const k of L.keys) {
      const t = typed[k]
      if (t?.lodged != null) { lodged += t.lodged; lodgedDeals += t.dl || 0 }
    }
    for (const k of S.keys) {
      const t = typed[k]
      if (t?.settled != null) { settled += t.settled; settledDeals += t.ds || 0 }
    }
    if (typed[thisMonth]?.lodged != null) monthLodged += typed[thisMonth].lodged as number
    if (typed[thisMonth]?.settled != null) monthSettled += typed[thisMonth].settled as number
    const lt = targetOf('lodged', b.key), st = targetOf('settled', b.key)
    let lodgedTarget = 0, settledTarget = 0
    for (const k of L.keys) if (lt[k]) lodgedTarget += lt[k]
    for (const k of S.keys) if (st[k]) settledTarget += st[k]
    return { ...b, lodged, lodgedDeals, lodgedTarget, settled, settledDeals, settledTarget,
             monthLodged, monthSettled }
  }), [brokers, dealRows, brokerHist, targetOf, L.keys, S.keys, thisMonth])

  const card = 'bg-card border border-card-line rounded-2xl'
  const kk = 'text-[10px] font-bold tracking-[.09em] uppercase text-faint'

  // HOW FAR THROUGH THIS MONTH WE ARE.
  // A month figure at 73% of target means nothing until you know whether there
  // are three weeks left or three days.
  const dim = new Date(Date.UTC(fy, Number(thisMonth.slice(5, 7)), 0)).getUTCDate()
  const dayOfMonth = Number(today.slice(8, 10))
  const daysLeft = Math.max(0, dim - dayOfMonth)

  function Year({ label, h }: { label: string; h: ReturnType<typeof head> }) {
    const hit = h.target > 0 ? h.now / h.target * 100 : null
    const diff = h.target > 0 ? h.now - h.target : null
    const good = diff !== null && diff >= 0
    return (
      <div className={card + ' p-4'}>
        <div className="flex items-baseline justify-between gap-2">
          <span className={kk}>{label} &middot; FY{String(fy).slice(2)} to date</span>
          {hit === null
            ? <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-gray-100 text-muted border border-line rounded-full px-2 py-[2px]">No target</span>
            : <span className={`text-[10px] font-bold uppercase tracking-[.05em] rounded-full px-2 py-[2px] border ${
                good ? 'bg-done-bg border-done-edge text-done' : 'bg-chase-bg border-chase-edge text-chase'}`}>
                {Math.round(hit)}% of target
              </span>}
        </div>
        <div className="text-[31px] font-semibold tracking-[-.025em] text-ink leading-[1.1] mt-1">{compact(h.now || null)}</div>
        <div className="h-[7px] bg-line-soft rounded-full my-2.5 overflow-hidden">
          <div className={`h-full rounded-full ${good ? 'bg-done' : 'bg-chase'}`}
               style={{ width: Math.min(100, hit ?? 0) + '%' }} />
        </div>
        {/* ONE LINE, NOT FOUR. Everything worth acting on, in a sentence:
            how far off target, over how many months, and the direction of
            travel against last year. */}
        <div className="text-[12px] text-faint leading-relaxed">
          {diff === null
            ? `no target set for the ${h.keys.length} month${h.keys.length === 1 ? '' : 's'} recorded`
            : <>
                <span className={good ? 'text-done font-semibold' : 'text-chase font-semibold'}>
                  {compact(Math.abs(diff))} {good ? 'ahead' : 'behind'}
                </span>
                {' '}the {compact(h.target)} targeted for the {h.keys.length} month{h.keys.length === 1 ? '' : 's'} recorded
              </>}
          {h.comparable > 0 && <>
            {' \u00b7 '}
            <span className={h.now >= h.then ? 'text-done font-semibold' : 'text-chase font-semibold'}>
              {signed((h.now - h.then) / h.then * 100)}
            </span>
            {' on this point last year'}
          </>}
        </div>
      </div>
    )
  }

  // THE MONTH, AND HOW MUCH OF IT IS LEFT TO DO IT IN.
  function MonthHalf({ label, value, target }: { label: string; value: number | null; target: number | null }) {
    const hit = value !== null && target ? value / target * 100 : null
    const good = hit !== null && hit >= 100
    // Where the month should be if the work landed evenly. Not a forecast -
    // just the line that makes "73%" mean something on the 22nd.
    const pace = dayOfMonth / dim * 100
    const onPace = hit !== null && hit >= pace
    const short = value !== null && target !== null ? target - value : null
    return (
      <div className="px-4 py-3.5 border-r border-line-soft last:border-r-0">
        <div className={kk + ' mb-1'}>{label}</div>
        {value === null ? (
          <>
            <div className="text-[20px] font-semibold tracking-[-.02em] text-faint">&mdash;</div>
            <div className="text-[11.5px] mt-1">
              <span className="text-[10px] font-bold uppercase tracking-[.05em] bg-chase-bg border border-chase-edge text-chase rounded-full px-2 py-[2px]">Not recorded</span>
            </div>
          </>
        ) : (
          <>
            <div className="text-[20px] font-semibold tracking-[-.02em] text-ink">
              {compact(value)}
              {target !== null && <span className="text-[12px] font-normal text-faint"> of {compact(target)}</span>}
            </div>
            {hit !== null && (
              <div className="h-[6px] bg-line-soft rounded-full my-2 overflow-hidden">
                <div className={`h-full rounded-full ${good ? 'bg-done' : 'bg-chase'}`} style={{ width: Math.min(100, hit) + '%' }} />
              </div>
            )}
            <div className="text-[11.5px] text-faint">
              {hit === null ? 'no target set for this month'
                : <>
                    <span className={good ? 'text-done font-semibold' : onPace ? 'text-ink font-semibold' : 'text-chase font-semibold'}>
                      {Math.round(hit)}%
                    </span>
                    {good ? ' \u2014 target met'
                      : daysLeft === 0 ? ` \u2014 ${compact(short)} short, month over`
                      : onPace ? ` \u2014 on pace with ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                      : ` \u2014 ${compact(short)} to find in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                  </>}
            </div>
          </>
        )}
      </div>
    )
  }

  // A BROKER IS A ROW, NOT A CARD.
  // Each broker had a card carrying two meters, four figures and a share line.
  // Three of them filled a third of the page and the same figures appeared
  // again in a table near the bottom of it. One row each says the same thing,
  // lines the brokers up so you can read down a column, and still fits nine.
  function Pct({ value, target }: { value: number; target: number }) {
    if (!target) return <span className="text-[11.5px] text-faint">no target</span>
    const hit = value / target * 100
    return (
      <span className="whitespace-nowrap">
        <span className={`text-[10px] font-bold uppercase tracking-[.05em] rounded-full px-2 py-[2px] border ${
          hit >= 100 ? 'bg-done-bg border-done-edge text-done' : 'bg-chase-bg border-chase-edge text-chase'}`}>
          {Math.round(hit)}%
        </span>
        <span className="text-[11.5px] text-faint"> of {compact(target)}</span>
      </span>
    )
  }

  const th = 'text-[9.5px] font-bold tracking-[.075em] uppercase text-faint text-left px-3 py-2 border-b border-line-soft whitespace-nowrap'
  const td = 'px-3 py-2.5 border-b border-line-soft text-[12.5px] text-body whitespace-nowrap last:border-b-0'

  return (
    <div className="mb-6">
      {!L.month && (
        <div className="flex items-start gap-3 bg-chase-bg border border-chase-edge rounded-xl px-4 py-3 mb-3">
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 mt-[2px]"><circle cx="8" cy="8" r="6.2"/><path d="M8 5v3.4M8 10.8v.2"/></svg>
          <span className="text-[12.5px] text-chase">
            <strong className="text-chase">Nothing is recorded for this month yet.</strong>{' '}
            It is left out of every figure below rather than counted as a zero. Enter it in Monthly actuals and
            the page moves.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3 max-[900px]:grid-cols-1">
        <Year label="Lodged" h={L} />
        <Year label="Settled" h={S} />
      </div>

      <div className={card + ' mb-3 overflow-hidden'}>
        <div className="flex items-baseline justify-between gap-3 px-4 py-2.5 border-b border-line-soft flex-wrap">
          <span className="text-[12.5px] font-semibold text-ink">{MONTH_NAMES[Number(thisMonth.slice(5, 7)) - 1]}, so far</span>
          <span className="text-[11.5px] text-faint">{dayOfMonth} of {dim} days gone</span>
        </div>
        <div className="grid grid-cols-2 max-[700px]:grid-cols-1">
          <MonthHalf label="Lodged" value={L.month ? L.month.amount : null} target={L.monthTarget} />
          <MonthHalf label="Settled" value={S.month ? S.month.amount : null} target={S.monthTarget} />
        </div>
      </div>

      {cards.length > 0 && (
        <div className={card + ' overflow-hidden'}>
          <div className="flex items-baseline justify-between gap-3 px-4 py-2.5 border-b border-line-soft flex-wrap">
            <span className="text-[12.5px] font-semibold text-ink">Brokers &middot; FY{String(fy).slice(2)} to date</span>
            <span className="text-[11.5px] text-faint">click a name to open it in Explore</span>
          </div>

          {L.sheet && (
            <div className="bg-gray-50 border-b border-line-soft px-4 py-2.5 text-[12px] text-muted leading-relaxed">
              The business figure for these months came from the spreadsheet, which has no broker split, so share
              of the business is left out. A broker&rsquo;s own figures come from what is typed on their profile in
              Settings, or from deals marked through the portal where nothing is typed.
            </div>
          )}

          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr>
                <th className={th + ' w-[21%]'}>Broker</th>
                <th className={th + ' w-[13%] text-right'}>Lodged</th>
                <th className={th + ' w-[17%]'}>vs target</th>
                <th className={th + ' w-[13%] text-right'}>Settled</th>
                <th className={th + ' w-[17%]'}>vs target</th>
                <th className={th + ' w-[9%] text-right'}>Share</th>
                <th className={th + ' w-[10%] text-right'}>This month</th>
              </tr>
            </thead>
            <tbody>
              {cards.map(b => (
                <tr key={b.key} onClick={() => onPickBroker && onPickBroker(b.key)}
                    className="cursor-pointer hover:bg-gray-50 transition">
                  <td className={td + ' text-ink font-semibold truncate'}>{b.name}</td>
                  <td className={td + ' text-right tabular-nums text-ink'}>{compact(b.lodged || null)}</td>
                  <td className={td}><Pct value={b.lodged} target={b.lodgedTarget} /></td>
                  <td className={td + ' text-right tabular-nums text-ink'}>{compact(b.settled || null)}</td>
                  <td className={td}><Pct value={b.settled} target={b.settledTarget} /></td>
                  <td className={td + ' text-right tabular-nums'}>
                    {!L.sheet && L.now > 0 ? Math.round(b.lodged / L.now * 100) + '%' : '\u2014'}
                  </td>
                  <td className={td + ' text-right tabular-nums'}>{b.monthLodged ? compact(b.monthLodged) : '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December']
