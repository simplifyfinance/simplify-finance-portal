import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  lmiTreatment, lmiAmount, totalLoan, loanFigureRows, lmiLoanSuffix, lmiClientLines,
  looksAlreadyCapitalised, LMI_CAPITALISED, LMI_SETTLEMENT,
} from './lmi'

// WILLIAM WELTON, 16 SEP 2026. Loan amount $460,364, LMI $4,659, and nothing
// anywhere saying whether one is inside the other.
//
// Fabio: "it is confusing my staff that the loan amount is 460K PLUS LMI but the
// 460K is INCLUDING."

const BASE = 460364
const PREMIUM = 4659
const bc = (extra: any = {}) => ({ lmiApplicable: 'Applicable', lmi: '4,659', ...extra })

describe('what the BC was told', () => {
  it('treats a deal nobody has answered as unanswered, not as capitalised', () => {
    expect(lmiTreatment(bc())).toBe('unanswered')
    expect(lmiTreatment(bc({ lmiTreatment: LMI_CAPITALISED }))).toBe('capitalised')
    expect(lmiTreatment(bc({ lmiTreatment: LMI_SETTLEMENT }))).toBe('settlement')
  })

  it('only counts a premium where LMI applies and an amount is recorded', () => {
    expect(lmiAmount(bc())).toBe(PREMIUM)
    expect(lmiAmount({ lmiApplicable: 'Applicable', lmi: '' })).toBeNull()
    expect(lmiAmount({ lmiApplicable: 'Waived', lmi: '4,659' })).toBeNull()
    expect(lmiAmount({})).toBeNull()
  })
})

describe('the total loan', () => {
  it('adds the premium only when it is being capitalised', () => {
    expect(totalLoan(bc({ lmiTreatment: LMI_CAPITALISED }), BASE)).toBe(465023)
    expect(totalLoan(bc({ lmiTreatment: LMI_SETTLEMENT }), BASE)).toBe(BASE)
    // NEVER on a deal nobody has answered. Guessing rewrites live figures.
    expect(totalLoan(bc(), BASE)).toBe(BASE)
  })
})

describe('the figures block', () => {
  const rows = (b: any) => loanFigureRows(b, BASE, '85.3%')
  const find = (r: [string, string][], k: string) => r.find(x => x[0] === k)?.[1]

  it('shows the sum when the premium is capitalised', () => {
    const r = rows(bc({ lmiTreatment: LMI_CAPITALISED }))
    expect(find(r, 'Lending')).toBe('$460,364')
    expect(find(r, 'LMI (capitalised)')).toBe('+ $4,659')
    expect(find(r, 'Total loan')).toBe('$465,023')
    // The premium is worked out FROM this LVR, so it is not fed back into it.
    expect(find(r, 'LVR')).toBe('85.3% on the lending')
    expect(r.map(x => x[0])).not.toContain('Loan amount')
  })

  it('says so plainly when it is paid at settlement', () => {
    const r = rows(bc({ lmiTreatment: LMI_SETTLEMENT }))
    expect(find(r, 'Loan amount')).toBe('$460,364')
    expect(find(r, 'LMI')).toMatch(/paid at settlement, not in the loan/)
    expect(r.map(x => x[0])).not.toContain('Total loan')
  })

  it('names the gap rather than filling it in', () => {
    const r = rows(bc())
    expect(find(r, 'Loan amount')).toBe('$460,364')
    expect(find(r, 'LMI')).toMatch(/not yet said whether this is added to the loan/)
    // The figures themselves have not moved.
    expect(r.map(x => x[0])).not.toContain('Total loan')
  })

  it('is untouched on a deal with no LMI at all', () => {
    expect(loanFigureRows({}, BASE, '62%')).toEqual([['Loan amount', '$460,364'], ['LVR', '62%']])
  })
})

describe('the sentence in the broker notes', () => {
  it('no longer claims a figure includes a premium that is not in it', () => {
    // This is the bug: the old code printed "(including capitalised LMI of $X)"
    // against the split total whenever any LMI figure existed.
    expect(lmiLoanSuffix(bc(), BASE)).not.toMatch(/including capitalised/i)
    expect(lmiLoanSuffix(bc(), BASE)).toMatch(/not yet said whether it is added/)
  })

  it('states the total where the premium really is capitalised', () => {
    expect(lmiLoanSuffix(bc({ lmiTreatment: LMI_CAPITALISED }), BASE))
      .toBe(' base, plus $4,659 capitalised LMI - $465,023 in total')
  })

  it('keeps the wording it already had where no LMI applies', () => {
    expect(lmiLoanSuffix({ lmiApplicable: 'Not applicable' }, BASE)).toBe(' (no LMI applicable)')
    expect(lmiLoanSuffix({ lmiApplicable: 'Waived' }, BASE)).toBe(' (LMI waived)')
  })
})

describe('what the client is told', () => {
  it('CHANGES NOTHING on a deal nobody has answered', () => {
    // The guarantee given before this was built: every deal already on the
    // system reads exactly as it did. If this test fails, live client emails
    // have moved under deals nobody has touched.
    expect(lmiClientLines(bc(), BASE)).toEqual([{ label: 'LMI (estimated)', value: '$4,659' }])
  })

  it('leads with the loan they are actually taking when it is capitalised', () => {
    const lines = lmiClientLines(bc({ lmiTreatment: LMI_CAPITALISED }), BASE)
    expect(lines[0]).toEqual({ label: 'Total loan', value: '$465,023', strong: true })
    expect(lines[1].value).toBe('includes LMI of $4,659, added to the loan')
  })

  it('says when it is due instead', () => {
    expect(lmiClientLines(bc({ lmiTreatment: LMI_SETTLEMENT }), BASE))
      .toEqual([{ label: 'LMI (estimated)', value: '$4,659 - payable at settlement' }])
  })

  it('keeps LMI waived exactly as it was', () => {
    expect(lmiClientLines({ lmiApplicable: 'Waived' }, BASE)).toEqual([{ label: '', value: 'LMI waived' }])
  })

  it('says nothing at all where there is nothing to say', () => {
    expect(lmiClientLines({}, BASE)).toEqual([])
  })
})

describe('the premium typed in twice', () => {
  const capitalised = (extra: any) => bc({ lmiTreatment: LMI_CAPITALISED, ...extra })

  it('catches the capitalised figure typed into the split', () => {
    // Base 460,364 is the existing balance. Somebody types 465,023 instead.
    const b = capitalised({ existingLoanBal: '460,364' })
    expect(looksAlreadyCapitalised(b, 465023)).toBe(true)
  })

  it('stays quiet when the base loan was typed correctly', () => {
    const b = capitalised({ existingLoanBal: '460,364' })
    expect(looksAlreadyCapitalised(b, 460364)).toBe(false)
  })

  it('catches it on a purchase too', () => {
    const b = capitalised({ purchasePrice: '800,000', deposit: '80,000' })
    expect(looksAlreadyCapitalised(b, 720000 + 4659)).toBe(true)
    expect(looksAlreadyCapitalised(b, 720000)).toBe(false)
  })

  it('never fires unless the premium is being capitalised', () => {
    expect(looksAlreadyCapitalised(bc({ existingLoanBal: '460,364' }), 465023)).toBe(false)
    expect(looksAlreadyCapitalised(bc({ lmiTreatment: LMI_SETTLEMENT, existingLoanBal: '460,364' }), 465023)).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('everything reads the one answer', () => {
  const read = (f: string) => readFileSync(f, 'utf8')

  it('the handover sheet and the summary PDF print the same rows', () => {
    for (const f of ['lib/handover-view.ts', 'app/api/generate-summary-pdf/route.tsx']) {
      expect(read(f), `${f} builds its own LMI rows`).toContain('loanFigureRows(bc, loanAmount')
      expect(read(f).replace(/\/\/[^\n]*/g, ''), `${f} still hand-writes an LMI row`)
        .not.toMatch(/\['LMI', money\(bc\.lmi\)\]/)
    }
  })

  it('the client email asks lib/lmi.ts for its wording, in one place', () => {
    const src = read('app/api/generate-email/route.ts')
    expect(src).toContain('function lmiLines(')
    // Four column builders used to carry their own copy of the same two lines.
    const copies = (src.match(/LMI \(estimated\): \$\{money\(/g) || []).length
    expect(copies, 'a column is still writing its own LMI line').toBe(0)
  })

  it('the BC asks the question and labels the box it changes', () => {
    const src = read('app/(app)/deals/[id]/BCForm.tsx')
    expect(src).toContain('How is the LMI paid?')
    expect(src, 'the split box must say it wants the base loan').toContain('Base loan amount')
    expect(src).toContain('looksAlreadyCapitalised')
  })

  it('the broker notes flag an unanswered premium on every deal, not just purchases', () => {
    const src = read('lib/broker-notes.ts')
    expect(src).toMatch(/lmiTreatment\(bc\) === 'unanswered'/)
  })
})
