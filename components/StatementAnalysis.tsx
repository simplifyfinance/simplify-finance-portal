'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import DropZone from '@/components/DropZone'
import { rulesChanged } from '@/lib/statement-rules'

// The Statements tab. Everything on screen comes from one stored analysis and
// one stored ledger, so a card and the transactions behind it can never drift.

type Txn = {
  id: string; external_id: string; txn_date: string; description: string; merchant: string
  account_number: string; account_name: string; institution: string
  category: string; summary_category: string; category_type: string; amount: number
}
type Upload = {
  id: string; file_name: string; uploaded_at: string; uploaded_by_email: string | null
  client_name: string | null; period_from: string; period_to: string; days: number
  txn_count: number; institutions: string[]; score: number; analysis: any
  rules: any; parsed_meta: any; reanalysed_at: string | null
}

const INK = '#221F1B', BODY = '#575046', LABEL = '#7A7266', LINE = '#E5DED2'
const POS = '#1E7A4A', WARN = '#B4761F', NEG = '#AD4227', ACCENT = '#0E8FCB'

const flagInk = (f: string) => f === 'action' ? NEG : f === 'query' ? WARN : (f === 'ok' || f === 'favourable') ? POS : LABEL
const flagChip = (f: string) =>
  f === 'action' ? 'text-[#AD4227] bg-[#FCF4F1] border-[#E8CFC6]'
  : f === 'query' ? 'text-[#B4761F] bg-[#FDF6EC] border-[#EBD9BE]'
  : 'text-[#1E7A4A] bg-[#F1F7F3] border-[#CFE6D5]'

const money = (n: number, dp = 2) =>
  (n < 0 ? '−' : '') + '$' + Math.abs(Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })
const dateAu = (s: string) =>
  s ? new Date(s + 'T00:00:00Z').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''

const SECTIONS: { title: string; keys: string[] }[] = [
  { title: 'Income — salary', keys: ['salary', 'gross', 'declaredSalary', 'salaryVariance'] },
  { title: 'Income — rental and stability', keys: ['rent', 'declaredRent', 'rentVariance', 'stability'] },
  { title: 'Income — other sources', keys: ['other', 'govt', 'declaredOther', 'incomeNotDeclared'] },
  { title: 'Commitments against the fact find', keys: ['commitments', 'declaredCommitments', 'undisclosed', 'bnpl'] },
  { title: 'Conduct', keys: ['overdrawn', 'dishonours', 'gambling', 'cash'] },
  { title: 'Savings and housing', keys: ['genuineSavings', 'savingsTrend', 'rentPaid', 'lowestBalance'] },
]

const DRILL_LABEL: Record<string, string> = {
  transactions: 'Transactions', working: 'Working', compare: 'Compare', balances: 'Balances', source: 'Source', none: '',
}

// What each card means, and what it does not mean. This is the part that makes
// the number usable by someone who did not write the calculation.
const COPY: Record<string, { intro: string; why: string }> = {
  salary: {
    intro: 'Every credit matched to an employer, grouped by payer. Only money arriving on a regular cycle is counted — an irregular pattern is not safe to annualise.',
    why: 'The monthly figure is the total over the period scaled to a month, not the size of one pay. If the period does not hold a whole number of cycles the two differ slightly, and the total is the honest one.',
  },
  gross: {
    intro: 'What gross salary would leave these credits in the bank after tax. The calculation steps up through the resident rate scale until the net matches.',
    why: 'It assumes a resident with no HELP debt, no salary sacrifice and no other deduction taken before the money lands. Any of those means the real gross is HIGHER than this — the gross-up can only understate, never overstate. It is never written to the fact find.',
  },
  declaredSalary: { intro: 'This is a figure the client gave us, not something found in the statements, so there are no transactions behind it.', why: 'Verifying it against a payslip is the next step. Anything attached lives on the Documents tab.' },
  declaredRent: { intro: 'This is a figure the client gave us, not something found in the statements, so there are no transactions behind it.', why: 'A rental statement or lease would confirm it.' },
  declaredOther: { intro: 'This is a figure the client gave us, not something found in the statements, so there are no transactions behind it.', why: 'Where the analysis found recurring income and this reads nil, this is the field to go back and complete.' },
  declaredCommitments: { intro: 'These are the liabilities on the fact find, not what the accounts show.', why: 'A commitment counts as declared when the fact find names the same lender. A loan declared at one amount and debiting another still counts as declared — it is a value difference, not a hidden liability.' },
  salaryVariance: {
    intro: 'A gap here is usually ordinary. These are the explanations in roughly the order they turn out to be the answer.',
    why: 'Nothing is changed automatically. The fact find still says what it said. This card exists so the file carries the question and your answer to it before an assessor asks the same thing.',
  },
  rent: { intro: 'Rental credits, grouped by who paid them.', why: 'Agent-managed rent arrives net: management fees, letting fees, water and repairs come out before the disbursement, so this sits below the lease rent by design.' },
  rentVariance: {
    intro: 'The declared figure is gross rent. The credits are what survives the agent, so a gap is expected.',
    why: 'Up to about a quarter is fees. Past that, or a month with no disbursement at all, or an amount that changes every month, points at vacancy or arrears instead.',
  },
  stability: {
    intro: 'Stability is what carries a casual or contract client and what sinks one. The test is whether pay arrives on a predictable cycle, from the same payer, in a steady amount.',
    why: 'A missed cycle, a payer name that changes mid-period, or an amount swinging more than about a fifth means the annualised figure stops being safe — and the gross-up above carries the same warning.',
  },
  other: {
    intro: 'Everything credited that is not salary or rent, grouped by payer. Only money that repeats is counted as income.',
    why: 'One credit in the period says nothing about a year, so single credits are listed separately and never multiplied up. Money between the client’s own accounts, credits carrying their own name, and refunds or rebates are all set aside rather than counted — each is shown here so you can disagree.',
  },
  govt: {
    intro: 'Government payments, grouped by benefit rather than lumped together.',
    why: 'Read the benefit type, not just the amount. Family Tax Benefit is widely accepted and often shaded; child support usually needs the assessment or court order; JobSeeker and most allowances are not accepted at all.',
  },
  incomeNotDeclared: {
    intro: 'Recurring income being credited that is not on the fact find. Unlike an undisclosed liability, this one is usually in the client’s favour.',
    why: 'It is not a figure to type into a servicing calculator. Family payments generally need a current Centrelink income statement and are often only counted while the children are under a set age; child support needs its own evidence. Treat this as a prompt to go and get it.',
  },
  commitments: { intro: 'Every repeating debit that looks like credit. Living expenses are excluded — this is credit only.', why: 'Matching to the fact find is by lender name, not by amount, so a loan debiting more than declared still counts as declared. A single debit to a lender is a one-off payment until it happens twice, and is listed rather than counted.' },
  undisclosed: {
    intro: 'Recurring credit obligations debiting the accounts that do not appear on the fact find.',
    why: 'Re-run servicing before the conversation rather than after — and net it against any income found above, which may more than cover it. Buy now pay later is the most common miss, because clients very often do not think of it as credit at all.',
  },
  bnpl: { intro: 'Detected by provider name, then grouped so you can see which services are in use rather than one lump sum.', why: 'The provider list is a setting, not something buried in code. New names get added as they turn up.' },
  dishonours: {
    intro: 'Returned items with the fee that came with them. A fee and its item on the same day are one event.',
    why: 'A dishonour represented and paid within a fortnight is a timing accident. One that never clears is a missed obligation, and that is the part an assessor reads.',
  },
  gambling: { intro: 'Wagering debits, with the share of total credits they represent.', why: 'Most lenders read the trend and the share of income rather than the total. Rising month on month, or above roughly five per cent of credits, is where it starts costing the deal.' },
  cash: {
    intro: 'Cash in and cash out above the threshold, because both raise a question — one about where money is going, the other about where it came from.',
    why: 'A cash deposit with no matching withdrawal behind it needs an answer: family help toward a deposit needs a gift letter, undeclared income changes the application. The threshold is a setting.',
  },
  overdrawn: { intro: 'Every day of the period walked, with the closing balance on each account.', why: 'Conduct is read before income. One overdrawn day is usually forgivable; a pattern of dipping under before payday says the household is running on empty whatever the income figure says.' },
  genuineSavings: { intro: 'Genuine savings is not the balance — it is the part that has stayed put. The test takes the lowest the combined balance reached.', why: 'Read it as an indication, not a decision. Lenders define genuine savings differently: some accept rent paid instead, some count shares or term deposits, some want a percentage of purchase price.' },
  savingsTrend: { intro: 'Closing balance across the accounts, month by month.', why: 'The direction matters more than the amount. Accumulation per month is the client’s demonstrated surplus — if the proposed repayment sits well above it, raise that before an assessor does.' },
  rentPaid: { intro: 'Rent going out, matched to an agent and checked against the day of the month.', why: 'A clean rental ledger is rental history in its own right, and substitutes for genuine savings with some lenders. Where the client is buying to live in, this amount disappears at settlement.' },
  lowestBalance: { intro: 'Every transaction on the day the balance bottomed out.', why: 'A dip caused by money moving into savings is not money lost. Reading the accounts together rather than one at a time is what tells those apart.' },
}

function Num({ card }: { card: any }) {
  return (
    <p className="text-[26px] leading-[1.12] font-[650] tracking-[-0.025em] mb-1.5" style={{ color: flagInk(card.flag) === LABEL ? INK : flagInk(card.flag) }}>
      {card.value}
    </p>
  )
}

function Bar({ pct, ink }: { pct: number; ink: string }) {
  return (
    <div className="h-[6px] rounded bg-[#EFEAE0] overflow-hidden">
      <div className="h-[6px] rounded" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: ink }} />
    </div>
  )
}

function TxnTable({ rows }: { rows: Txn[] }) {
  if (rows.length === 0) return <p className="text-[12px] text-[#7A7266] py-3">No transactions to show.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[#E5DED2]">
            {['Date', 'Description', 'Account', 'Category', 'Amount'].map((h, i) => (
              <th key={h} className={`text-[9.5px] font-bold tracking-[0.07em] uppercase text-[#7A7266] pb-1.5 pr-2 whitespace-nowrap ${i === 4 ? 'text-right pr-0' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.id} className="border-b border-[#EFEAE0]">
              <td className="py-1.5 pr-2 whitespace-nowrap text-[#575046]">{dateAu(t.txn_date)}</td>
              <td className="py-1.5 pr-2 text-[#221F1B]">{t.description || t.merchant}</td>
              <td className="py-1.5 pr-2 whitespace-nowrap text-[11px] text-[#7A7266]">{t.institution} {t.account_number?.slice(-4)}</td>
              <td className="py-1.5 pr-2 whitespace-nowrap text-[11px] text-[#7A7266]">{t.category}</td>
              <td className="py-1.5 text-right tabular-nums font-semibold text-[#221F1B] whitespace-nowrap">{money(t.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Rows({ head, body }: { head: string[]; body: (string | number | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[#E5DED2]">
            {head.map((h, i) => (
              <th key={i} className={`text-[9.5px] font-bold tracking-[0.07em] uppercase text-[#7A7266] pb-1.5 pr-2 whitespace-nowrap ${i === head.length - 1 && head.length > 1 ? 'text-right pr-0' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i} className="border-b border-[#EFEAE0]">
              {r.map((c, j) => (
                <td key={j} className={`py-1.5 pr-2 align-top ${j === r.length - 1 && r.length > 1 ? 'text-right pr-0 tabular-nums font-semibold text-[#221F1B] whitespace-nowrap' : 'text-[#575046]'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// The body of a drill-down, chosen by which card was clicked.
function Detail({ card, txns }: { card: any; txns: Txn[] }) {
  const d = card.detail || {}
  const rows = useMemo(() => {
    const want = new Set<string>(card.txnIds || [])
    return txns.filter(t => want.has(t.external_id)).sort((a, b) => a.txn_date < b.txn_date ? -1 : 1)
  }, [card, txns])
  const copy = COPY[card.key] || { intro: '', why: '' }
  const H = ({ children }: { children: React.ReactNode }) =>
    <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#7A7266] mt-4 mb-2">{children}</p>

  let summary: React.ReactNode = null

  if (card.key === 'gross' && d.byFy?.length) {
    const head = d.byFy.find((f: any) => f.headline) || d.byFy[0]
    summary = <>
      <Rows head={['Component', 'Rate', 'Amount']} body={[
        ['Gross salary (solved)', '', money(head.gross, 0)],
        ...head.lines.map((l: any) => [l.label, l.rate, money(l.amount)]),
        ['Income tax', '', money(head.incomeTax)],
        ['Medicare levy', '', money(head.medicare)],
        ['Low income tax offset', '', money(-head.offset)],
        ['Net in hand', '', money(head.net)],
      ]} />
      {d.byFy.length > 1 && <>
        <H>Both financial years the period touches</H>
        <Rows head={['Financial year', 'Gross salary']} body={d.byFy.map((f: any) => [f.label + (f.headline ? ' — used' : ''), money(f.gross, 0)])} />
      </>}
      {d.caveats?.length > 0 && <p className="text-[12px] text-[#B4761F] mt-3">{d.caveats.join(' ')}</p>}
    </>
  } else if (card.drill === 'source') {
    summary = <Rows head={['Line', 'Per year']} body={[
      ...(d.components || []).map((c: any) => [c.label, money(c.amount, 0)]),
      ['Total', money(d.total || 0, 0)],
    ]} />
  } else if (card.key === 'salaryVariance') {
    summary = <>
      <Rows head={['Figure', 'Amount']} body={[
        ['Grossed up from the credits', money(d.grossedUp || 0, 0)],
        ['Declared on the fact find', money(d.declared || 0, 0)],
        ['Difference', money(d.variance || 0, 0)],
      ]} />
      <H>Why the two differ, in order of likelihood</H>
      <Rows head={['Explanation', 'What it looks like']} body={[
        ['HELP / HECS repayment', 'Deducted before the credit lands, so the credits look smaller than the salary'],
        ['Salary sacrifice', 'Extra super, a novated lease or a packaged car never appears in the account'],
        ['A second account', 'Part of the pay is split somewhere we were not given'],
        ['A recent pay rise', 'The declared figure is current, the statements are historical'],
        ['Bonus or overtime', 'Declared as part of gross but not paid inside this window'],
        ['The fact find is wrong', 'The declared figure needs correcting'],
      ]} />
    </>
  } else if (card.key === 'rentVariance') {
    summary = <Rows head={['Figure', 'Amount']} body={[
      ['Received in the account, annualised', money(d.received || 0, 0)],
      ['Declared gross rent', money(d.declared || 0, 0)],
      ['Difference', money(d.variance || 0, 0)],
    ]} />
  } else if (card.key === 'stability') {
    summary = <Rows head={['Test', 'Result', '']} body={(d.tests || []).map((t: any) => [
      t.test, t.result,
      <span key={t.test} className={`inline-block text-[9.5px] font-bold tracking-wide uppercase rounded-full px-2 py-0.5 border ${flagChip(t.pass ? 'ok' : 'query')}`}>{t.pass ? 'Pass' : 'Check'}</span>,
    ])} />
  } else if (card.key === 'salary') {
    summary = <Rows head={['Employer', 'Cycle', 'Credits', 'Total']} body={(d.sources || []).map((s: any) => [
      s.payer, `${s.cadence}, about ${s.meanDays} days apart`, s.count, money(s.total),
    ])} />
  } else if (card.key === 'other') {
    summary = <>
      <Rows head={['Payer', 'Pattern', 'Per month', 'Per year']} body={(d.recurring || []).map((g: any) => [
        g.payer, `${g.cadence} · ${g.count} credits`, money(g.monthly), money(g.annual, 0),
      ])} />
      {d.oneOff?.length > 0 && <>
        <H>One-off credits — listed, never annualised</H>
        <Rows head={['Payer', 'Credits', 'Total']} body={d.oneOff.map((g: any) => [g.payer, g.count, money(g.total)])} />
      </>}
      <H>Set aside, not counted as income</H>
      <Rows head={['What', 'Count', 'Total']} body={[
        ['Between the client’s own accounts', d.internalTransfers?.count ?? 0, ''],
        ['Credits carrying the client’s own name', d.ownTransfers?.count ?? 0, money(d.ownTransfers?.total || 0)],
        ['Refunds, rebates and Medicare benefits', d.rebates?.count ?? 0, money(d.rebates?.total || 0)],
        ['Interest earned', '', money(d.interest || 0)],
      ]} />
    </>
  } else if (card.key === 'govt') {
    summary = <Rows head={['Benefit', 'Pattern', 'Usable for servicing', 'Per month']} body={(d.types || []).map((g: any) => [
      g.name, `${g.cadence} · ${g.count} credits`, g.servicingUse, money(g.monthly),
    ])} />
  } else if (card.key === 'incomeNotDeclared') {
    summary = <Rows head={['Source', 'Usable for servicing', 'Per month', 'Per year']} body={(d.sources || []).map((s: any) => [
      s.name, s.servicingUse, money(s.monthly), money(s.annual, 0),
    ])} />
  } else if (card.key === 'commitments' || card.key === 'undisclosed') {
    summary = <>
      <Rows head={['Provider', 'Type', 'Pattern', 'Declared', 'Per month']} body={(d.providers || []).map((p: any) => [
        p.provider, p.kind || '', `${p.cadence} · ${p.count}`,
        card.key === 'undisclosed' ? 'No'
          : <span key={p.provider} className={`inline-block text-[9.5px] font-bold tracking-wide uppercase rounded-full px-2 py-0.5 border ${flagChip(p.declared ? 'ok' : 'action')}`}>{p.declared ? 'Declared' : 'Not declared'}</span>,
        money(p.monthly),
      ])} />
      {d.oneOff?.length > 0 && <>
        <H>Single payments — not counted as commitments</H>
        <Rows head={['Payer', 'Date', 'Amount']} body={d.oneOff.map((g: any) => [g.payer, dateAu(g.date), money(g.total)])} />
      </>}
    </>
  } else if (card.key === 'bnpl') {
    summary = <>
      <Rows head={['Provider', 'Pattern', 'Declared', 'Returns', 'Per month']} body={(d.providers || []).map((p: any) => [
        p.provider, `${p.cadence} · ${p.count} instalments`, p.declared ? 'Yes' : 'No', p.returns || 0, money(p.monthly),
      ])} />
      <p className="text-[12px] text-[#575046] mt-3"><b className="text-[#221F1B]">On the watchlist:</b> {(d.watchlist || []).join(', ')}.</p>
    </>
  } else if (card.key === 'dishonours') {
    summary = <Rows head={['Date', 'Payer', 'Repaid within a fortnight', 'Amount']} body={(d.events || []).map((e: any) => [
      dateAu(e.date), e.payer,
      <span key={e.date} className={`inline-block text-[9.5px] font-bold tracking-wide uppercase rounded-full px-2 py-0.5 border ${flagChip(e.repaid ? 'ok' : 'action')}`}>{e.repaid ? 'Repaid' : 'Not found'}</span>,
      money(e.amount),
    ])} />
  } else if (card.key === 'gambling') {
    summary = <Rows head={['Month', 'Spend']} body={(d.byMonth || []).map((m: any) => [m.month, money(m.amount)])} />
  } else if (card.key === 'cash') {
    summary = d.unexplainedDeposits?.length
      ? <Rows head={['Date', 'Deposit with nothing behind it', 'Amount']} body={d.unexplainedDeposits.map((t: any) => [dateAu(t.date), t.description, money(t.amount)])} />
      : <p className="text-[12px] text-[#575046]">Every cash deposit has a withdrawal of similar size behind it.</p>
  } else if (card.drill === 'balances') {
    const b = d.balances || d
    summary = <>
      <p className="text-[12px] text-[#B4761F] mb-3">{b.reason || d.reason}</p>
      {(b.monthEnds || d.monthEnds || []).length > 0 &&
        <Rows head={['Month end', 'Combined balance']} body={(b.monthEnds || d.monthEnds).map((p: any) => [dateAu(p.date), money(p.balance)])} />}
      {card.key === 'genuineSavings' && d.genuine !== null && d.genuine !== undefined &&
        <Rows head={['Line', 'Amount']} body={[
          ['Held across every account today', money(d.closingTotal || 0)],
          [`Lowest the combined balance reached since ${dateAu(d.seasonFrom)}`, money(d.genuine)],
        ]} />}
    </>
  }

  return (
    <div>
      {copy.intro && <p className="text-[12.5px] leading-[1.62] text-[#575046] mb-3">{copy.intro}</p>}
      {summary}
      {rows.length > 0 && <><H>{rows.length} transaction{rows.length === 1 ? '' : 's'} behind this</H><TxnTable rows={rows} /></>}
      {card.drill === 'source' && <p className="text-[12px] text-[#7A7266] mt-3">From {d.field}.</p>}
      {copy.why && <div className="mt-4 rounded-[10px] border border-[#EBD9BE] bg-[#FDF6EC] px-3.5 py-3 text-[12px] leading-[1.62] text-[#575046]">{copy.why}</div>}
    </div>
  )
}

function Ledger({ txns }: { txns: Txn[] }) {
  const [tab, setTab] = useState<'all' | 'cat'>('all')
  const [q, setQ] = useState('')
  const [acct, setAcct] = useState('')
  const [cat, setCat] = useState('')

  const accounts = useMemo(() => [...new Set(txns.map(t => `${t.institution} ${t.account_number}`))].sort(), [txns])
  const cats = useMemo(() => [...new Set(txns.map(t => t.category).filter(Boolean))].sort(), [txns])
  const filtered = useMemo(() => txns.filter(t =>
    (!q || `${t.description} ${t.merchant}`.toLowerCase().includes(q.toLowerCase())) &&
    (!acct || `${t.institution} ${t.account_number}` === acct) &&
    (!cat || t.category === cat)
  ).sort((a, b) => a.txn_date < b.txn_date ? 1 : -1), [txns, q, acct, cat])

  const byCat = useMemo(() => {
    const g: Record<string, { n: number; i: number; o: number }> = {}
    for (const t of txns) {
      const k = t.category || 'Uncategorised'
      g[k] = g[k] || { n: 0, i: 0, o: 0 }
      g[k].n++
      if (Number(t.amount) > 0) g[k].i += Number(t.amount); else g[k].o += Math.abs(Number(t.amount))
    }
    return Object.entries(g).sort((a, b) => (b[1].i + b[1].o) - (a[1].i + a[1].o))
  }, [txns])

  const sel = 'text-[12.5px] border border-[#E5DED2] rounded-lg px-2 py-1 bg-white text-[#221F1B]'
  return (
    <div className="border border-[#E5DED2] rounded-xl bg-white overflow-hidden mt-6">
      <div className="flex gap-0.5 border-b border-[#E5DED2] px-3 bg-[#FCFAF6] flex-wrap">
        {([['all', 'All transactions'], ['cat', 'By category']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`text-[12.5px] px-3 py-2 border-b-2 ${tab === k ? 'text-[#221F1B] font-[640] border-[#0E8FCB]' : 'text-[#575046] border-transparent'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'all' ? (
        <>
          <div className="flex gap-2 items-center flex-wrap px-3.5 py-2.5 border-b border-[#EFEAE0]">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search description…"
              className={`${sel} flex-1 min-w-[170px]`} />
            <select value={acct} onChange={e => setAcct(e.target.value)} className={sel}>
              <option value="">All accounts</option>{accounts.map(a => <option key={a}>{a}</option>)}
            </select>
            <select value={cat} onChange={e => setCat(e.target.value)} className={sel}>
              <option value="">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}
            </select>
            <span className="text-[11.5px] text-[#7A7266] ml-auto whitespace-nowrap">
              Showing {filtered.length} of {txns.length} stored
            </span>
          </div>
          <div className="max-h-[430px] overflow-auto px-3.5 py-2"><TxnTable rows={filtered} /></div>
        </>
      ) : (
        <div className="max-h-[430px] overflow-auto px-3.5 py-3">
          <Rows head={['Category', 'Count', 'Money in', 'Money out', 'Net']} body={byCat.map(([k, v]) => [
            k, v.n, v.i ? money(v.i) : '—', v.o ? money(-v.o) : '—', money(v.i - v.o),
          ])} />
        </div>
      )}
    </div>
  )
}

export default function StatementAnalysis({ deal }: { deal: any }) {
  const supabase = useMemo(() => createSupabaseBrowser(), [])
  const [upload, setUpload] = useState<Upload | null>(null)
  const [txns, setTxns] = useState<Txn[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<any>(null)
  const [liveRules, setLiveRules] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    // The rules as they are now, so the tab can say when a stored analysis was
    // run under different ones rather than quietly showing stale findings.
    const { data: st } = await supabase.from('settings').select('statement_rules').eq('id', 'singleton').maybeSingle()
    setLiveRules((st as any)?.statement_rules ?? {})

    const { data: ups, error: upErr } = await supabase
      .from('deal_statement_uploads').select('*')
      .eq('deal_id', deal.id).order('uploaded_at', { ascending: false }).limit(1)
    if (upErr) { setError(`Could not load the statement analysis: ${upErr.message}`); setLoading(false); return }
    const u = (ups || [])[0] as Upload | undefined
    setUpload(u || null)
    if (!u) { setTxns([]); setLoading(false); return }

    // Read the whole ledger. Supabase caps a request, so it is paged rather than
    // silently truncated - a partial ledger would make the drill-downs wrong.
    const all: Txn[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error: txErr } = await supabase
        .from('deal_statement_transactions').select('*')
        .eq('upload_id', u.id).order('txn_date', { ascending: true }).range(from, from + 999)
      if (txErr) { setError(`Could not load the transactions: ${txErr.message}`); break }
      all.push(...((data || []) as Txn[]))
      if (!data || data.length < 1000) break
    }
    setTxns(all)
    setLoading(false)
  }, [supabase, deal.id])

  useEffect(() => { load() }, [load])

  async function upFiles(files: File[]) {
    const file = files[0]
    if (!file) return
    setBusy(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('dealId', deal.id)
      const res = await fetch('/api/statement-analysis', { method: 'POST', body: fd })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error || `Upload failed (${res.status}).`); return }
      await load()
    } catch (e: any) {
      setError(`Upload failed: ${e?.message || 'unknown error'}`)
    } finally { setBusy(false) }
  }

  async function reanalyse() {
    if (!upload) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/statement-analysis', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: upload.id, dealId: deal.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error || `Could not re-analyse (${res.status}).`); return }
      await load()
    } catch (e: any) {
      setError(`Could not re-analyse: ${e?.message || 'unknown error'}`)
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!upload) return
    if (!confirm('Remove this statement analysis and every transaction stored with it?')) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/statement-analysis?uploadId=${upload.id}&dealId=${deal.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error || `Could not remove it (${res.status}).`); return }
      await load()
    } finally { setBusy(false) }
  }

  const a = upload?.analysis
  const cardBy = (k: string) => (a?.cards || []).find((c: any) => c.key === k)
  // What has moved in Settings since this analysis ran. Empty means the findings
  // on screen are what the current rules would produce.
  const stale = upload && liveRules !== null ? rulesChanged(upload.rules, liveRules) : []

  if (loading) return <p className="text-[13px] text-[#7A7266] py-6">Loading statements…</p>

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-xl border border-[#E8CFC6] bg-[#FCF4F1] px-4 py-3 text-[13px] text-[#AD4227]">{error}</div>
      )}

      {!upload ? (
        <>
          <DropZone onFiles={upFiles} busy={busy} multiple={false} accept=".xlsm,.xlsx"
            title="Drop the CashDeck workbook here"
            hint="The income verification export (.xlsm or .xlsx). Every transaction is stored against this deal." />
          <p className="text-[12px] text-[#7A7266] mt-3 max-w-[86ch]">
            The analysis reads the statements against this deal&rsquo;s fact find and flags the differences.
            It never changes the fact find.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 border border-[#E5DED2] rounded-xl px-3.5 py-2.5 bg-white mb-3 flex-wrap">
            <span className="w-[25px] h-[31px] rounded bg-[#1E7A4A] text-white text-[7.5px] font-bold flex items-center justify-center flex-none">XLSM</span>
            <span>
              <span className="text-[13px] text-[#221F1B] font-[560]">{upload.file_name}</span><br />
              <span className="text-[11.5px] text-[#7A7266]">
                {upload.client_name ? `${upload.client_name} · ` : ''}uploaded {new Date(upload.uploaded_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                {upload.uploaded_by_email ? ` by ${upload.uploaded_by_email}` : ''}
                {upload.reanalysed_at ? ` · re-analysed ${new Date(upload.reanalysed_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
              </span>
            </span>
            <span className="ml-auto flex gap-2">
              <button onClick={reanalyse} disabled={busy}
                className="text-[11.5px] font-semibold text-[#0E8FCB] border border-[#BFE2F5] rounded-lg px-2.5 py-1 bg-[#EAF6FD] hover:bg-[#DCEDF8] disabled:opacity-40">
                {busy ? 'Working…' : 'Re-analyse'}
              </button>
              <button onClick={remove} disabled={busy}
                className="text-[11.5px] text-[#7A7266] border border-[#E5DED2] rounded-lg px-2.5 py-1 bg-white hover:text-[#221F1B] disabled:opacity-40">
                Remove
              </button>
            </span>
          </div>

          {stale.length > 0 && (
            <div className="rounded-xl border border-[#EBD9BE] bg-[#FDF6EC] px-3.5 py-2.5 text-[12.5px] text-[#575046] mb-3 flex items-center gap-2.5 flex-wrap leading-[1.55]">
              <span>
                <b className="text-[#221F1B]">The rules have changed since this was analysed.</b>{' '}
                {stale.join(', ')}{stale.length === 1 ? ' has' : ' have'} moved in Settings. These findings
                still show what you saw
                {upload.reanalysed_at
                  ? ` on ${new Date(upload.reanalysed_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}`
                  : ` on ${new Date(upload.uploaded_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}`}.
              </span>
              <button onClick={reanalyse} disabled={busy}
                className="ml-auto text-[11.5px] font-semibold text-white bg-[#0E8FCB] border border-[#0E8FCB] rounded-lg px-3 py-1.5 disabled:opacity-40">
                {busy ? 'Working…' : 'Re-analyse now'}
              </button>
            </div>
          )}

          {/* period and accounts */}
          <div className="border border-[#E5DED2] rounded-xl bg-white overflow-hidden mb-3">
            <div className="px-3.5 py-2 border-b border-[#EFEAE0] bg-[#FCFAF6] text-[10px] font-bold tracking-[0.08em] uppercase text-[#7A7266] flex gap-2.5 flex-wrap items-center">
              Period and accounts analysed
              <span className={a?.coverage?.complete ? 'text-[#1E7A4A] tracking-normal' : 'text-[#B4761F] tracking-normal'}>
                · {a?.coverage?.complete ? 'Coverage complete' : 'Coverage partial'}
              </span>
            </div>
            <div className="flex gap-6 px-3.5 py-3 border-b border-[#EFEAE0] flex-wrap">
              {[
                ['Period analysed', `${dateAu(upload.period_from)} → ${dateAu(upload.period_to)} · ${upload.days} days`],
                ['Financial years covered', (a?.period?.fys || []).map((f: string) => `FY ${f}`).join(' and ')],
                ['Institutions', `${(upload.institutions || []).length} · ${(upload.institutions || []).join(', ')}`],
                ['Accounts', String((a?.coverage?.accounts || []).length)],
                ['Transactions', String(upload.txn_count)],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div className="text-[9.5px] font-bold tracking-[0.07em] uppercase text-[#7A7266] mb-0.5">{k}</div>
                  <div className="text-[12.5px] text-[#221F1B] font-[560]">{v}</div>
                </div>
              ))}
            </div>
            {(a?.coverage?.accounts || []).map((acc: any) => (
              <div key={acc.accountNumber} className="flex items-center gap-2.5 px-3.5 py-2 border-b border-[#EFEAE0] last:border-b-0 text-[12.5px] flex-wrap">
                <span className="text-[#221F1B] font-[560]">{acc.institution}</span>
                <span className="text-[11.5px] text-[#7A7266]">· {acc.name} {acc.accountNumber}</span>
                <span className={`ml-auto text-[11.5px] whitespace-nowrap ${acc.pct >= 90 ? 'text-[#575046]' : 'text-[#B4761F]'}`}>
                  {dateAu(acc.from)} → {dateAu(acc.to)} · {acc.txnCount} transactions · {acc.pct}% of the period
                </span>
              </div>
            ))}
          </div>

          {/* score */}
          {a?.score && (
            <div className="border border-[#E5DED2] rounded-xl bg-white px-4 py-4 mb-3 flex gap-5 items-center flex-wrap">
              <div className="flex-none min-w-[150px]">
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#7A7266] mb-1">File verification score</p>
                <p className="text-[38px] leading-none font-[650] tracking-[-0.03em]"
                  style={{ color: a.score.total >= 85 ? POS : a.score.total >= 60 ? WARN : NEG }}>
                  {a.score.total}<span className="text-[15px] text-[#7A7266] font-medium tracking-normal">/100</span>
                </p>
                <p className="text-[11.5px] text-[#7A7266] mt-1.5">
                  {a.score.openItems === 0 ? 'Nothing outstanding' : `${a.score.openItems} item${a.score.openItems === 1 ? '' : 's'} need an answer`}<br />before this goes to a lender
                </p>
              </div>
              <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
                {a.score.components.map((c: any) => (
                  <div key={c.key}>
                    <div className="flex justify-between gap-2 text-[10px] font-bold tracking-[0.06em] uppercase text-[#7A7266] mb-1.5">
                      <span>{c.label}</span><span className="text-[#221F1B] tracking-normal">{c.score}</span>
                    </div>
                    <Bar pct={c.score} ink={c.score >= 85 ? POS : c.score >= 60 ? WARN : NEG} />
                    <p className="text-[11px] text-[#7A7266] mt-1.5 leading-[1.4]">{c.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* worklist */}
          {a?.worklist?.length > 0 && (
            <div className="rounded-xl border border-[#BFE2F5] bg-[#EAF6FD] overflow-hidden mb-5">
              <div className="px-4 py-3 border-b border-[#BFE2F5] text-[13.5px] leading-[1.55] text-[#221F1B]">
                {a.score.openItems === 0
                  ? 'Nothing on this file needs an answer.'
                  : `${a.worklist.length} thing${a.worklist.length === 1 ? '' : 's'} to look at before this goes to a lender.`}
              </div>
              {a.worklist.map((w: any, i: number) => (
                <button key={i} onClick={() => setOpen(cardBy(w.card))}
                  className="w-full text-left flex items-start gap-2.5 px-4 py-2.5 text-[12.5px] text-[#575046] leading-[1.5] border-b border-[#DCEDF8] last:border-b-0 hover:bg-[#E1F1FB]">
                  <span className={`text-[9.5px] font-bold tracking-wide uppercase rounded-full px-2 py-0.5 border flex-none mt-0.5 ${flagChip(w.flag)}`}>{w.label}</span>
                  <span>{w.text}</span>
                  <span className="ml-auto text-[11.5px] font-semibold text-[#0E8FCB] whitespace-nowrap">Open ›</span>
                </button>
              ))}
            </div>
          )}

          {/* cards */}
          {SECTIONS.map(sec => (
            <div key={sec.title}>
              <h3 className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#7A7266] mt-6 mb-2.5 flex items-center gap-2.5">
                <span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] flex-none" />{sec.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {sec.keys.map(k => {
                  const c = cardBy(k)
                  if (!c) return null
                  return (
                    <button key={k} onClick={() => setOpen(c)}
                      className="relative text-left bg-white border border-[#E5DED2] rounded-xl px-4 pt-3.5 pb-4 hover:border-[#D6CCBC] hover:shadow-[0_2px_9px_rgba(60,48,30,0.07)] transition">
                      <span className="absolute top-3 right-3.5 text-[9px] font-bold tracking-[0.06em] uppercase text-[#B3ABA0]">{DRILL_LABEL[c.drill]}</span>
                      <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#7A7266] mb-2 pr-9 leading-[1.35]">{c.title}</p>
                      {c.flagLabel && (
                        <span className={`inline-block text-[9.5px] font-bold tracking-wide uppercase rounded-full px-2 py-0.5 border mb-1.5 ${flagChip(c.flag)}`}>{c.flagLabel}</span>
                      )}
                      <Num card={c} />
                      <p className="text-[11.5px] text-[#7A7266] leading-[1.45]">{c.sub}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <Ledger txns={txns} />

          {a?.warnings?.length > 0 && (
            <div className="mt-3 rounded-xl border border-[#EBD9BE] bg-[#FDF6EC] px-4 py-3 text-[12.5px] text-[#575046] leading-[1.65]">
              <b className="text-[#221F1B]">Worth knowing about this file.</b> {a.warnings.join(' ')}
            </div>
          )}
          <div className="mt-3 rounded-xl border border-[#BFE2F5] bg-[#EAF6FD] px-4 py-3 text-[12.5px] text-[#575046] leading-[1.65]">
            <b className="text-[#221F1B]">The score reads the file, not the client.</b> It measures how much of what was
            declared the statements confirm and how many questions are still open. Nothing in it is an opinion about
            creditworthiness, it is never shown to the client, and it never goes to a lender. Every transaction is stored
            against this deal behind the same access as the rest of the file, and is deleted with it.
          </div>
        </>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-[rgba(34,31,27,0.45)] overflow-auto p-4 sm:p-8" onClick={e => { if (e.target === e.currentTarget) setOpen(null) }}>
          <div className="max-w-[840px] mx-auto bg-white border border-[#E5DED2] rounded-2xl overflow-hidden shadow-[0_18px_50px_rgba(34,31,27,0.24)]">
            <div className="px-5 py-3 border-b border-[#EFEAE0] bg-[#FCFAF6] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-[640] tracking-[-0.01em] m-0">{open.title}</h3>
                <p className="text-[12px] text-[#7A7266] m-0">{open.sub}</p>
              </div>
              <button onClick={() => setOpen(null)} aria-label="Close"
                className="border border-[#E5DED2] bg-white w-7 h-7 rounded-lg text-[#7A7266] hover:bg-[#FBF9F5] hover:text-[#221F1B] flex-none">×</button>
            </div>
            <div className="px-5 py-4 max-h-[66vh] overflow-auto"><Detail card={open} txns={txns} /></div>
            <div className="px-5 py-2.5 border-t border-[#EFEAE0] bg-[#FCFAF6] flex items-center gap-2">
              <span className="text-[11.5px] text-[#7A7266] mr-auto">
                {open.txnIds?.length ? `${open.txnIds.length} transaction${open.txnIds.length === 1 ? '' : 's'}` : 'No transactions behind this figure'}
              </span>
              <button onClick={() => setOpen(null)} className="text-[11.5px] border border-[#0E8FCB] bg-[#0E8FCB] text-white rounded-lg px-3 py-1.5">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
