'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { money, readMoney } from '@/lib/money'
import { contributionCheck, canSendTheEmail, stageIndex } from '@/lib/portfolio-review'

// THE FIGURES FABIO WORKS OUT, TYPED ONTO THE REVIEW.
//
// 19 Oct 2026. Everything else on this screen comes off the book. These seven
// boxes are the ones a person decides, and until they are filled in nothing can
// reach "Numbers done" and no email can ever send.
//
// THE EMAIL IS BUILT FROM EXACTLY THESE AND NOTHING ELSE, which is why they are
// in one place with the arithmetic shown beside them rather than spread over a
// form somebody scrolls. The two figures that are NOT here are the total cost
// and the deposit: those are worked out, because they are the two a person gets
// wrong at midnight.

type Prop = { id: string; address: string; investor: boolean
  original_value: number | null; original_loan: number | null
  current_balance: number | null; estimated_current_value: number | null
  usable_equity: number | null }

const IN = 'w-full border border-card-line rounded-lg px-2.5 py-[7px] text-[13px] bg-card text-ink '
  + 'focus:outline-none focus:border-brand'
const LAB = 'block text-[11.5px] text-muted mb-1'
const K = 'text-[9.5px] font-bold uppercase tracking-[.06em] text-faint'
const BTN = 'text-[12px] border border-card-line bg-card rounded-lg px-3 py-[7px] text-ink hover:bg-page transition disabled:opacity-40'
const DARK = 'text-[12px] bg-ink text-page rounded-lg px-3.5 py-[7px] font-semibold disabled:opacity-40'

const BLANK = {
  equity_property_id: '', equity_release: '', equity_buffer: '',
  purchase_price: '', stamp_duty: '', loan_amount: '',
  loan_note: '', savings_contribution: '',
}

export default function ReviewFigures({ review, props, onSaved }: {
  review: any
  props: Prop[]
  onSaved?: () => void
}) {
  const [d, setD] = useState({ ...BLANK })
  const [busy, setBusy] = useState(false)
  const [why, setWhy] = useState('')
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // READ WHEN IT OPENS, NOT OFF THE LIST.
  //
  // The list view carries what the list draws - names, stages, chase dates -
  // and deliberately not these. A form seeded from a row that does not hold
  // them opens blank every time and quietly writes a blank back over whatever
  // was there, which is worse than not having the form.
  useEffect(() => {
    let alive = true
    const supabase = createSupabaseBrowser()
    supabase.from('portfolio_reviews')
      .select('equity_property_id, equity_release, equity_buffer, purchase_price, stamp_duty, loan_amount, loan_note, savings_contribution')
      .eq('id', review.id).single()
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data) { setWhy(error?.message || 'Could not read this review.'); setLoaded(true); return }
        setD({
          equity_property_id: data.equity_property_id || '',
          equity_release: data.equity_release ?? '',
          equity_buffer: data.equity_buffer ?? '',
          purchase_price: data.purchase_price ?? '',
          stamp_duty: data.stamp_duty ?? '',
          loan_amount: data.loan_amount ?? '',
          loan_note: data.loan_note || 'your maximum borrowing capacity with non-bank lender',
          savings_contribution: data.savings_contribution ?? '',
        })
        setLoaded(true)
      })
    return () => { alive = false }
  }, [review.id])

  const set = (k: string, v: any) => { setSaved(false); setD(prev => ({ ...prev, [k]: v })) }

  // WORKED OUT, NOT TYPED. Same two the email works out, by the same rule, so
  // the screen and the email can never disagree about them.
  const n = (v: any) => readMoney(v) ?? 0
  const total = n(d.purchase_price) + n(d.stamp_duty)
  const deposit = total - n(d.loan_amount)

  // THE BUFFER IS PART OF THE PLAN, NOT A MISTAKE.
  //
  // "We structure a little extra equity as a cash-flow buffer" means the equity
  // release is deliberately MORE than the deposit. Asking the check about
  // equity LESS the buffer is what stops it reporting a shortfall that was
  // intended all along.
  const forTheDeposit = n(d.equity_release) - n(d.equity_buffer)
  const tie = contributionCheck(d.purchase_price, d.stamp_duty, d.loan_amount,
                                forTheDeposit, d.savings_contribution)

  const chosen = props.find(p => p.id === d.equity_property_id)
  const usableOf = (p: Prop) => {
    if (!p.investor) return null
    if (p.usable_equity !== null) return p.usable_equity
    const value = p.estimated_current_value ?? p.original_value
    const owing = p.current_balance ?? p.original_loan
    if (value === null || owing === null) return null
    const out = Math.round(value * 0.8 - owing)
    return out > 0 ? out : 0
  }
  const headroom = chosen ? usableOf(chosen) : null
  // Releasing more than the property has in it is a real answer and the screen
  // says so rather than refusing. It is a conversation with a lender, not a
  // rule this portal gets to make.
  const overDrawn = headroom !== null && n(d.equity_release) > headroom

  async function save(markDone: boolean) {
    setBusy(true); setWhy('')
    const supabase = createSupabaseBrowser()
    const patch: any = {
      equity_property_id: d.equity_property_id || null,
      equity_release: readMoney(d.equity_release),
      equity_buffer: readMoney(d.equity_buffer),
      purchase_price: readMoney(d.purchase_price),
      stamp_duty: readMoney(d.stamp_duty),
      loan_amount: readMoney(d.loan_amount),
      loan_note: d.loan_note || '',
      savings_contribution: readMoney(d.savings_contribution),
      updated_at: new Date().toISOString(),
    }
    // ONLY EVER FORWARD. Somebody filling in a figure on a review that is
    // already out with the client must not drag it back to "numbers done" and
    // lose that it was sent.
    if (markDone && stageIndex(review.status) < stageIndex('numbers_done')) {
      patch.status = 'numbers_done'
      patch.reviewed_at = new Date().toISOString()
    }
    const { data, error } = await supabase.from('portfolio_reviews')
      .update(patch).eq('id', review.id).select('id')
    setBusy(false)
    // A refused write returns no rows and no error. Saying it saved when
    // nothing was stored is the quiet failure this portal keeps paying for.
    if (error || !data?.length) {
      setWhy(error?.message || 'That would not save. Nothing was recorded.')
      return
    }
    setSaved(true)
    onSaved?.()
  }

  const can = canSendTheEmail({ ...review, ...d, status: 'numbers_done' }, { email: review.email })

  // NOTHING IS EDITABLE UNTIL WHAT IS THERE HAS BEEN READ. Typing into a box
  // that is about to be overwritten by the read is how a figure gets lost.
  if (!loaded) {
    return (
      <div className="border-t border-line-soft pt-3.5 mt-3.5">
        <p className="text-[12px] text-faint">Reading the numbers&hellip;</p>
      </div>
    )
  }

  return (
    <div className="border-t border-line-soft pt-3.5 mt-3.5">
      <p className={`${K} mb-2.5`}>The numbers</p>

      <div className="mb-2.5">
        <label className={LAB}>Which property does the equity come out of?</label>
        <select className={IN} value={d.equity_property_id}
          onChange={e => set('equity_property_id', e.target.value)}>
          <option value="">Not chosen yet</option>
          {props.filter(p => p.investor).map(p => {
            const u = usableOf(p)
            return <option key={p.id} value={p.id}>
              {p.address}{u === null ? '' : ` — ${money(u)} usable`}
            </option>
          })}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div><label className={LAB}>Equity release</label>
          <input className={IN} value={d.equity_release} placeholder="130,000"
            onChange={e => set('equity_release', e.target.value)} /></div>
        <div><label className={LAB}>Of that, cash-flow buffer</label>
          <input className={IN} value={d.equity_buffer} placeholder="0"
            onChange={e => set('equity_buffer', e.target.value)} /></div>
      </div>
      {overDrawn && (
        <p className="text-[11.5px] text-chase mt-1.5">
          That is more than the {money(headroom as number)} this property has in it at 80%. Fine if the
          lender will wear it — the email will still say what you type.
        </p>
      )}

      <p className={`${K} mt-4 mb-2.5`}>The purchase</p>
      <div className="grid grid-cols-2 gap-2.5">
        <div><label className={LAB}>Purchase price</label>
          <input className={IN} value={d.purchase_price} placeholder="520,000"
            onChange={e => set('purchase_price', e.target.value)} /></div>
        <div><label className={LAB}>Stamp duty</label>
          <input className={IN} value={d.stamp_duty} placeholder="28,000"
            onChange={e => set('stamp_duty', e.target.value)} /></div>
        <div><label className={LAB}>Loan amount</label>
          <input className={IN} value={d.loan_amount} placeholder="385,000"
            onChange={e => set('loan_amount', e.target.value)} /></div>
        <div><label className={LAB}>Their own savings</label>
          <input className={IN} value={d.savings_contribution} placeholder="33,000"
            onChange={e => set('savings_contribution', e.target.value)} /></div>
      </div>
      <div className="mt-2.5">
        <label className={LAB}>What the email says in brackets after the loan amount</label>
        <input className={IN} value={d.loan_note}
          onChange={e => set('loan_note', e.target.value)} />
      </div>

      {/* THE ARITHMETIC, SHOWN RATHER THAN TRUSTED. These are the two figures
          the email works out for itself, so seeing them here is seeing what the
          client will read. */}
      <div className={`rounded-lg px-3.5 py-2.5 mt-3 border text-[12.5px] ${
        tie.kind === 'adds-up' ? 'bg-done-bg border-done-edge text-done'
        : tie.kind === 'unknown' ? 'bg-page border-g100 text-muted'
        : 'bg-chase-bg border-chase-edge text-chase'}`}>
        <div className="flex justify-between py-[2px]"><span>Total cost</span>
          <b className="tabular-nums">{total > 0 ? money(total) : '—'}</b></div>
        <div className="flex justify-between py-[2px]"><span>Less the loan</span>
          <b className="tabular-nums">{n(d.loan_amount) > 0 ? `−${money(n(d.loan_amount))}` : '—'}</b></div>
        <div className="flex justify-between py-[2px]"><span>Deposit needed</span>
          <b className="tabular-nums">{deposit !== 0 ? money(deposit) : '—'}</b></div>
        <div className="flex justify-between py-[2px] mt-1 pt-1.5 border-t border-current/20">
          <span className="font-semibold">
            {tie.kind === 'unknown' ? 'Fill in the figures and this checks itself'
              : tie.kind === 'adds-up' ? 'Equity and savings cover it exactly'
              : tie.kind === 'short' ? `Short by ${money(tie.by)}`
              : `${money(tie.by)} more than needed`}
          </span>
          <b>{tie.kind === 'adds-up' ? '✓' : ''}</b>
        </div>
        {(tie.kind === 'short' || tie.kind === 'over') && (
          <p className="mt-1.5 text-[11.5px] opacity-90">
            It warns, it does not stop you. If the gap is on purpose, put it in the buffer box above and
            the email will name it.
          </p>
        )}
      </div>

      <div className="flex gap-2 mt-3 flex-wrap items-center">
        <button className={DARK} disabled={busy} onClick={() => save(true)}>
          {busy ? 'Saving…' : saved ? '✓ Saved' : 'Save and mark Numbers done'}
        </button>
        <button className={BTN} disabled={busy} onClick={() => save(false)}>Save only</button>
        <span className="flex-1" />
        {!can.ok && <span className="text-[11.5px] text-faint">{can.why}</span>}
      </div>
      {why && <p className="text-[11.5px] text-chase mt-2">{why}</p>}
    </div>
  )
}
