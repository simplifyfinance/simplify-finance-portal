// The one place a commission figure is worked out. Every screen calls this, so a
// deal, a report and the Pipeline can never disagree about what a loan pays.
//
// It refuses rather than guesses. An unconfirmed rate, a missing percentage or an
// LVR-banded lender with no known LVR all return a reason instead of a number -
// a wrong commission figure is worse than a visible gap, because nobody checks a
// number that looks plausible.

export type CommissionRate = {
  lender?: string | null
  upfront_pct?: number | null
  upfront_bands?: any
  upfront_gst_inclusive?: boolean | null
  upfront_cap?: number | null
  min_loan?: number | null
  trail_pct?: number | null
  clawback_months?: number | null
  confirmed?: boolean | null
}

export type Commission = {
  ok: boolean
  reason: string | null
  upfront: number | null
  upfrontPct: number | null
  band: string | null
  trailYear: number | null
  trailMonth: number | null
  trailPct: number | null
  gstInclusive: boolean
  cappedAt: number | null
  clawbackMonths: number | null
  clawbackEndsOn: string | null
}

const NONE = (reason: string): Commission => ({
  ok: false, reason, upfront: null, upfrontPct: null, band: null,
  trailYear: null, trailMonth: null, trailPct: null,
  gstInclusive: false, cappedAt: null, clawbackMonths: null, clawbackEndsOn: null,
})

function n(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const x = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return isNaN(x) ? null : x
}

export function addMonthsToDate(iso: string, months: number): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z')
  if (isNaN(d.getTime())) return ''
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d.toISOString().slice(0, 10)
}

// Which band an LVR falls in. Bands carry a max_lvr; the one without a max is
// whatever sits above the rest.
function pickBand(bands: any[], lvr: number): { pct: number | null; label: string } | null {
  const withMax = bands.filter(b => n(b?.max_lvr) !== null)
    .sort((a, b) => (n(a.max_lvr) as number) - (n(b.max_lvr) as number))
  for (const b of withMax) {
    if (lvr <= (n(b.max_lvr) as number)) return { pct: n(b.pct), label: `≤${n(b.max_lvr)}% LVR` }
  }
  const above = bands.find(b => n(b?.max_lvr) === null)
  return above ? { pct: n(above.pct), label: 'above the top band' } : null
}

export function calcCommission(input: {
  amount: number | null | undefined      // the loan the commission is paid on
  rate: CommissionRate | null | undefined
  lvr?: number | null                    // percent, e.g. 78.5
  settledOn?: string | null              // YYYY-MM-DD, for the clawback window
}): Commission {
  const { rate } = input
  const amount = n(input.amount)

  if (!rate) return NONE('no rate on file for this lender')
  if (!rate.confirmed) return NONE('rate not confirmed')
  if (amount === null || amount <= 0) return NONE('no loan amount recorded')

  const minLoan = n(rate.min_loan)
  if (minLoan !== null && amount < minLoan) {
    return NONE(`below this lender's minimum of $${Math.round(minLoan).toLocaleString('en-AU')}`)
  }

  const bands = Array.isArray(rate.upfront_bands) ? rate.upfront_bands : []
  let pct: number | null = null
  let band: string | null = null

  if (bands.length > 0) {
    const lvr = n(input.lvr)
    if (lvr === null) return NONE('this lender pays by LVR band and the LVR is not known')
    const hit = pickBand(bands, lvr)
    if (!hit || hit.pct === null) return NONE(`no band covers an LVR of ${lvr}%`)
    pct = hit.pct
    band = hit.label
  } else {
    pct = n(rate.upfront_pct)
    if (pct === null) return NONE('no upfront rate recorded')
  }

  let upfront = amount * (pct / 100)
  let cappedAt: number | null = null
  const cap = n(rate.upfront_cap)
  if (cap !== null && upfront > cap) { upfront = cap; cappedAt = cap }

  const trailPct = n(rate.trail_pct)
  const trailYear = trailPct === null ? null : amount * (trailPct / 100)

  const clawbackMonths = rate.clawback_months === null || rate.clawback_months === undefined
    ? null : Number(rate.clawback_months)
  const clawbackEndsOn = (clawbackMonths && input.settledOn)
    ? addMonthsToDate(input.settledOn, clawbackMonths) : null

  return {
    ok: true,
    reason: null,
    upfront: Math.round(upfront * 100) / 100,
    upfrontPct: pct,
    band,
    trailYear: trailYear === null ? null : Math.round(trailYear * 100) / 100,
    trailMonth: trailYear === null ? null : Math.round((trailYear / 12) * 100) / 100,
    trailPct,
    gstInclusive: !!rate.upfront_gst_inclusive,
    cappedAt,
    clawbackMonths,
    clawbackEndsOn,
  }
}

// The LVR of a deal, if it can be known. Uses the recorded property value where
// there is one, otherwise the stated band from the borrowing capacity form.
export function lvrOf(deal: any): number | null {
  const bc = deal?.bc_data || {}
  const loan = n(deal?.settled_total) ?? n(deal?.lodged_total) ?? n(deal?.loan_amount) ?? n(bc.loanAmount)
  const value = n(bc.propertyValue) ?? n(bc.purchasePrice)
  if (loan && value && value > 0) return Math.round((loan / value) * 1000) / 10
  const stated = n(bc.lvrCustom) ?? n(bc.lvr)
  return stated ?? null
}

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return '$' + Math.round(v).toLocaleString('en-AU')
}
