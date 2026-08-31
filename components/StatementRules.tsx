'use client'
import { type StatementRules, type NamedTerms, type BenefitRule, DEFAULT_RULES, normaliseRules } from '@/lib/statement-rules'

// Settings → Statement analysis. Everything the statement analysis uses to decide
// what to flag, so it can be changed without a deployment.
//
// This is a controlled component: it owns no state. The Settings page holds the
// value and its one Save button writes it, the same way Brands works.

const CARD = 'border border-[#EDE7DD] rounded-xl p-5 bg-white'
const NOTE = 'text-[11.5px] text-[#A29889] mb-4 leading-[1.6] max-w-[92ch]'
const IN = 'text-[12.5px] border border-[#E8E1D6] rounded-lg px-2 py-1.5 text-[#2E2A26] w-full focus:outline-none focus:border-[#2DBEFF]'
const MONO = `${IN} font-mono text-[11.5px] text-[#6E665C]`
const TH = 'text-left text-[9.5px] font-bold tracking-[0.07em] uppercase text-[#A29889] pb-1.5 pr-2 whitespace-nowrap border-b border-[#E8E1D6]'
const ADD = 'text-[12.5px] font-semibold text-[#0E8FCB] bg-white border border-[#BFE6F9] rounded-lg px-4 py-2 hover:bg-[#EAF7FE] transition mt-3'

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold text-[#A29889] uppercase tracking-[0.09em] mb-4 flex items-center gap-2">
      <span className="w-[5px] h-[5px] rounded-full bg-[#0E8FCB] inline-block shrink-0" />{children}
    </h2>
  )
}

function Threshold({ label, hint, value, onChange, prefix, unit }: {
  label: string; hint: string; value: number; onChange: (v: number) => void
  prefix?: string; unit?: string
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-[112px] flex-none flex items-center gap-1.5">
        {prefix && <span className="text-[13px] text-[#A29889]">{prefix}</span>}
        <input type="number" value={String(value)} onChange={e => onChange(Number(e.target.value))}
          className={`${IN} text-right`} />
        {unit && <span className="text-[11.5px] text-[#A29889] whitespace-nowrap">{unit}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <label className="text-[12.5px] font-semibold text-[#2E2A26] block mb-0.5">{label}</label>
        <p className="text-[11.5px] text-[#A29889] m-0 leading-[1.5]">{hint}</p>
      </div>
    </div>
  )
}

// Terms are edited as one comma separated line because that is how a person
// thinks of them. They are split on save, never stored as the raw line.
function TermRows({ rows, onChange, nameHead, extraHead, extraCell, addLabel }: {
  rows: NamedTerms[]
  onChange: (rows: any[]) => void
  nameHead: string
  extraHead?: string
  extraCell?: (row: any, i: number) => React.ReactNode
  addLabel: string
}) {
  const set = (i: number, patch: any) => onChange(rows.map((r, j) => j === i ? { ...r, ...patch } : r))
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead><tr>
            <th className={`${TH} w-[30%]`}>{nameHead}</th>
            <th className={TH}>Terms that identify it on a statement</th>
            {extraHead && <th className={`${TH} w-[22%]`}>{extraHead}</th>}
            <th className={`${TH} w-[70px]`}></th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[#EFEAE0] last:border-b-0">
                <td className="py-1.5 pr-2"><input className={IN} value={r.name}
                  onChange={e => set(i, { name: e.target.value })} placeholder="Shown as" /></td>
                <td className="py-1.5 pr-2"><input className={MONO} value={(r.terms || []).join(', ')}
                  onChange={e => set(i, { terms: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  placeholder="term, other term" /></td>
                {extraCell && <td className="py-1.5 pr-2">{extraCell(r, i)}</td>}
                <td className="py-1.5">
                  <button onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    className="text-[11.5px] text-[#A29889] hover:text-[#AD4227] transition">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className={ADD} onClick={() => onChange([...rows, { name: '', terms: [] }])}>+ {addLabel}</button>
    </>
  )
}

function Chips({ label, hint, items, onChange, placeholder }: {
  label: string; hint: string; items: string[]; onChange: (v: string[]) => void; placeholder: string
}) {
  return (
    <div className={CARD}>
      <p className={NOTE}><b className="text-[#2E2A26]">{label}</b> {hint}</p>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {items.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-[12px] bg-[#FAF7F2] border border-[#E8E1D6] rounded-full pl-3 pr-1.5 py-0.5 text-[#2E2A26]">
            {t}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-[#A29889] hover:text-[#AD4227] text-[13px] leading-none px-1" aria-label={`Remove ${t}`}>×</button>
          </span>
        ))}
        {items.length === 0 && <span className="text-[11.5px] text-[#A29889]">Empty — the shipped list will be used instead.</span>}
      </div>
      <input className="text-[12.5px] border border-dashed border-[#E8E1D6] rounded-full px-3 py-1.5 min-w-[220px] text-[#2E2A26] focus:outline-none focus:border-[#2DBEFF]"
        placeholder={placeholder}
        onKeyDown={e => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          const v = (e.target as HTMLInputElement).value.trim()
          if (!v) return
          if (!items.includes(v)) onChange([...items, v])
          ;(e.target as HTMLInputElement).value = ''
        }} />
    </div>
  )
}

export default function StatementRulesPane({ value, onChange }: {
  value: any
  onChange: (v: StatementRules) => void
}) {
  const r = normaliseRules(value)
  const set = (patch: Partial<StatementRules>) => onChange({ ...r, ...patch })

  return (
    <div>
      <section className="mb-9">
        <H2>When to raise a flag</H2>
        <div className={CARD}>
          <p className={NOTE}>
            Every number here is a threshold the analysis compares against. Crossing one changes a card
            from green to amber or red and puts a line on the worklist.
            <b className="text-[#2E2A26]"> None of it ever writes to a fact find.</b>
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 gap-x-7">
            <Threshold label="Large cash movement" prefix="$" value={r.cashThreshold}
              onChange={v => set({ cashThreshold: v })}
              hint="Cash in or out above this appears on the Large cash movements card. Lower it and you will see more; most brokers sit between $500 and $2,000." />
            <Threshold label="Genuine savings held for" unit="days" value={r.savingsWindowDays}
              onChange={v => set({ savingsWindowDays: v })}
              hint="How long money must have stayed put to count. Three months is the common lender test; some want six." />
            <Threshold label="Gambling — raise it here" unit="%" value={r.gamblingPct}
              onChange={v => set({ gamblingPct: v })}
              hint="Share of total credits at which gambling turns red rather than amber. Spend rising month on month always flags, whatever this is set to." />
            <Threshold label="Rental — fees allowance" unit="%" value={r.rentalTolerancePct}
              onChange={v => set({ rentalTolerancePct: v })}
              hint="How far below the declared rent the credits may sit before it stops reading as agent fees and starts reading as vacancy or arrears." />
            <Threshold label="Salary — ask a question above" unit="%" value={r.salaryQueryPct}
              onChange={v => set({ salaryQueryPct: v })}
              hint="How far the grossed-up credits may differ from the declared salary before the variance card turns amber." />
            <Threshold label="Salary — treat as serious above" unit="%" value={r.salaryActionPct}
              onChange={v => set({ salaryActionPct: v })}
              hint="Above this the variance goes red and moves to the top of the worklist. It cannot be set below the figure on its left." />
          </div>
        </div>
      </section>

      <section className="mb-9">
        <H2>Buy now pay later</H2>
        <div className={CARD}>
          <p className={NOTE}>
            Each provider has a name for the card and the terms that identify it on a statement. Terms are
            matched with punctuation and spacing ignored, so <b className="text-[#2E2A26]">zippay</b> catches
            &ldquo;ZIP PAY&rdquo; and &ldquo;Zip.Pay&rdquo;. A provider found here is named on the Buy now pay
            later card and counted as a commitment.
          </p>
          <TermRows rows={r.bnpl} onChange={rows => set({ bnpl: rows })} nameHead="Shown as" addLabel="Add a provider" />
          <div className="mt-4 rounded-[10px] border border-[#EBD9BE] bg-[#FDF6EC] px-3.5 py-3 text-[12px] leading-[1.62] text-[#6E665C]">
            <b className="text-[#2E2A26]">A term of four letters or fewer must match a whole word.</b> Left as a
            plain search, &ldquo;ppl&rdquo; would match inside &ldquo;apple&rdquo; and &ldquo;ing&rdquo; inside
            almost every description — both happened on a real file. Longer terms match anywhere in the line,
            which is what you want for &ldquo;afterpay&rdquo; catching &ldquo;AFTERPAY *ORDER 4471&rdquo;.
          </div>
        </div>
      </section>

      <section className="mb-9">
        <H2>Small amount credit and wage advance</H2>
        <div className={CARD}>
          <p className={NOTE}>
            Named so a commitment reads &ldquo;Nimble&rdquo; rather than an unrecognised bank line. These get
            no card of their own — they appear under Commitments like any other obligation.
          </p>
          <TermRows rows={r.highCost} onChange={rows => set({ highCost: rows })} nameHead="Shown as" addLabel="Add a lender" />
        </div>
      </section>

      <section className="mb-9">
        <H2>Government payments</H2>
        <div className={CARD}>
          <p className={NOTE}>
            The benefit is named on the card, not just the amount, because that is what decides whether it can
            be used at all. The last column is a reminder for whoever reads the card — it never changes a number.
          </p>
          <TermRows
            rows={r.benefits} onChange={rows => set({ benefits: rows as BenefitRule[] })}
            nameHead="Benefit" extraHead="Usable for servicing" addLabel="Add a benefit"
            extraCell={(row, i) => (
              <select className={IN} value={row.servicingUse || 'sometimes'}
                onChange={e => set({ benefits: r.benefits.map((b, j) => j === i ? { ...b, servicingUse: e.target.value as BenefitRule['servicingUse'] } : b) })}>
                <option value="usually">Usually</option>
                <option value="sometimes">Sometimes</option>
                <option value="rarely">Rarely</option>
              </select>
            )}
          />
          <p className="text-[11.5px] text-[#A29889] mt-3">
            Order matters: the first benefit whose terms match wins, so put the specific ones above the general.
          </p>
        </div>
      </section>

      <section className="mb-9">
        <H2>Simple lists</H2>
        <div className="space-y-3.5">
          <Chips label="Gambling merchants." items={r.gambling} onChange={v => set({ gambling: v })}
            placeholder="Add a merchant, then Enter"
            hint="A debit matching any of these counts toward the gambling card, on top of anything CashDeck has already categorised as gambling." />
          <Chips label="Real estate agents." items={r.agents} onChange={v => set({ agents: v })}
            placeholder="Add an agent, then Enter"
            hint="Used to tell rent from any other payment. A credit from one of these is rent received; a debit is rent paid." />
          <Chips label="Money coming back." items={r.rebates} onChange={v => set({ rebates: v })}
            placeholder="Add a term, then Enter"
            hint="Credits matching these are refunds and rebates, not income, so they are set aside and shown under their own heading rather than counted." />
        </div>
      </section>

      <section className="mb-9">
        <H2>Lender names</H2>
        <div className={CARD}>
          <p className={NOTE}>
            A statement says &ldquo;CBA&rdquo; and a fact find says &ldquo;Commonwealth Bank&rdquo;. These pairs
            are how the analysis knows they are the same lender, which is what stops a declared commitment
            being reported as hidden.
          </p>
          <TermRows rows={r.lenderAliases} onChange={rows => set({ lenderAliases: rows })}
            nameHead="Lender" addLabel="Add a lender" />
        </div>
      </section>

      <div className="rounded-xl border border-[#BFE6F9] bg-[#EAF7FE] px-4 py-3.5 text-[12.5px] text-[#6E665C] leading-[1.65]">
        <b className="text-[#2E2A26]">Changing a rule does not change an analysis that has already run.</b> A
        stored analysis keeps the rules it was run under, so a file you reviewed last month still says what you
        saw. Every deal with statements gets a <b className="text-[#2E2A26]">Re-analyse</b> button, and because
        every transaction is stored, it recomputes from the stored ledger — no re-upload, and no second copy of
        the client&rsquo;s banking data.
      </div>
      <button
        onClick={() => { if (confirm('Put every rule on this screen back to what the portal shipped with?')) onChange({ ...DEFAULT_RULES }) }}
        className="text-[11.5px] text-[#A29889] hover:text-[#AD4227] mt-4">
        Reset every rule to the shipped defaults
      </button>
    </div>
  )
}
