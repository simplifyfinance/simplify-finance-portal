import { describe, it, expect } from 'vitest'
import { defaultAnswers, missingAnswers, isUrgentNow, urgentChipLabel, boardOrder, shortDate,
         emailLines, emailSubject, isRefinanceDeal, isInvestmentPurchase,
         type PushAnswers } from './push-answers'

const ooPurchase = { transaction_type: 'purchase', property_use: 'owner_occupied' }
const invPurchase = { transaction_type: 'purchase', property_use: 'investment' }
const refi = { transaction_type: 'refinance' }
const liabs = [
  { id: '1', label: 'Credit card', detail: 'Westpac · limit $25,000', closing: true },
  { id: '2', label: 'Car loan', detail: 'Toyota Finance · $18,400', closing: false },
]

describe('which questions a deal gets', () => {
  it('asks about rental income only on an investment purchase', () => {
    expect(isInvestmentPurchase(invPurchase)).toBe(true)
    // Fabio, 2 Sep 2026: "only appear on INV purchase".
    expect(isInvestmentPurchase(ooPurchase)).toBe(false)
    expect(isInvestmentPurchase(refi)).toBe(false)
  })

  it('treats an equity release as a refinance for the discharge', () => {
    expect(isRefinanceDeal({ transaction_type: 'equity_release' })).toBe(true)
    expect(isRefinanceDeal(ooPurchase)).toBe(false)
  })

  it('ticks prepare-the-discharge by default, and only on a refinance', () => {
    expect(defaultAnswers(refi, []).dischargePrepared).toBe(true)
    expect('dischargePrepared' in defaultAnswers(ooPurchase, [])).toBe(false)
  })

  it('starts on 100% Simplify, not urgent, with the fact find liabilities in hand', () => {
    const a = defaultAnswers(ooPurchase, liabs)
    expect(a.commission).toBe('simplify_100')
    expect(a.urgent).toBe(false)
    expect(a.liabilities).toHaveLength(2)
  })
})

describe('what has to be answered', () => {
  it('is happy with the defaults', () => {
    expect(missingAnswers(defaultAnswers(ooPurchase, liabs))).toEqual([])
  })

  it('will not accept urgent without a date', () => {
    expect(missingAnswers({ commission: 'simplify_100', urgent: true })).toEqual([
      'This deal is marked urgent but has no date for compliance to work to',
    ])
    expect(missingAnswers({ commission: 'simplify_100', urgent: true, complianceNeededBy: '2026-09-05' })).toEqual([])
  })

  it('will not accept virtual ID without naming the service', () => {
    expect(missingAnswers({ commission: 'simplify_100', idMethod: 'virtual' }))
      .toContain('ID was done virtually but the service has not been named')
    expect(missingAnswers({ commission: 'simplify_100', idMethod: 'virtual', idService: 'infotrack' })).toEqual([])
  })

  it('does not argue about the optional ones', () => {
    // No notes, no rental income, no reason for the rush. All legitimately blank.
    expect(missingAnswers({ commission: 'check_label', idMethod: 'face_to_face' })).toEqual([])
  })
})

describe('the urgent flag ends at lodgement', () => {
  it('is on between the push and the lodgement', () => {
    expect(isUrgentNow({ is_urgent: true })).toBe(true)
  })

  it('goes off the moment the deal is lodged', () => {
    // Fabio, 2 Sep 2026: "when we move box to lodged". Compliance is finished
    // with it, so the flag has done its job.
    expect(isUrgentNow({ is_urgent: true, lodged_at: '2026-09-08' })).toBe(false)
  })

  it('goes off on a dead deal', () => {
    expect(isUrgentNow({ is_urgent: true, status: 'lost' })).toBe(false)
  })

  it('is off when nobody asked', () => {
    expect(isUrgentNow({})).toBe(false)
    expect(isUrgentNow({ is_urgent: false, compliance_needed_by: '2026-09-05' })).toBe(false)
  })

  it('says the date on the chip, because "urgent" alone tells you nothing', () => {
    expect(urgentChipLabel({ compliance_needed_by: '2026-09-05' })).toBe('Urgent · compliance by Sat 5 Sep')
    expect(urgentChipLabel({})).toBe('Urgent')
    expect(urgentChipLabel({ compliance_needed_by: 'rubbish' })).toBe('Urgent')
  })

  it('says the date the same way on every machine', () => {
    // Node's own "short month" for en-AU is "Sept" on some builds and "Sep" on
    // others, so a laptop, the server sending the email and the PDF could all
    // disagree about the same day. This one is ours.
    expect(shortDate('2026-09-05')).toBe('Sat 5 Sep')
    expect(shortDate('2026-01-01')).toBe('Thu 1 Jan')
    expect(shortDate('2026-12-25')).toBe('Fri 25 Dec')
    expect(shortDate('')).toBe('')
    expect(shortDate('rubbish')).toBe('')
    expect(shortDate(null)).toBe('')
  })
})

describe('where a card sits in its column', () => {
  const since = (d: any) => d.since
  it('puts urgent above everything, then oldest first', () => {
    const urgent2days = { is_urgent: true, since: '2026-09-01' }
    const plain9days = { since: '2026-08-25' }
    const plain4days = { since: '2026-08-30' }
    const sorted = [plain9days, plain4days, urgent2days].sort((a, b) => boardOrder(a, b, since))
    expect(sorted[0]).toBe(urgent2days)
    expect(sorted[1]).toBe(plain9days)      // then the old rule, unchanged
    expect(sorted[2]).toBe(plain4days)
  })

  it('leaves a lodged deal in its normal place even if it was urgent once', () => {
    const wasUrgent = { is_urgent: true, lodged_at: 'x', since: '2026-09-01' }
    const older = { since: '2026-08-25' }
    const sorted = [wasUrgent, older].sort((a, b) => boardOrder(a, b, since))
    expect(sorted[0]).toBe(older)
  })
})

describe('what credit reads in the email', () => {
  const answers: PushAnswers = {
    commission: 'simplify_100', urgent: true, complianceNeededBy: '2026-09-05',
    idMethod: 'virtual', idService: 'infotrack', liabilities: liabs,
    notes: 'Client travelling from Thursday.',
  }

  it('says urgent and the date in the subject', () => {
    expect(emailSubject('Chapman', answers)).toBe('Chapman — ready for compliance · URGENT, needed by Sat 5 Sep')
    expect(emailSubject('Chapman', { commission: 'simplify_100' })).toBe('Chapman — ready for compliance')
  })

  it('separates what is closing from what is staying', () => {
    const lines = emailLines(ooPurchase, answers)
    expect(lines.some(l => l.startsWith('Closing at settlement: Credit card'))).toBe(true)
    expect(lines.some(l => l.startsWith('Staying: Car loan'))).toBe(true)
  })

  it('names the ID service', () => {
    expect(emailLines(ooPurchase, answers)).toContain('ID: Virtual — InfoTrack')
    expect(emailLines(ooPurchase, { idMethod: 'face_to_face' })).toContain('ID: Face to face')
  })

  it('leaves rental income out of an owner occupied purchase entirely', () => {
    expect(emailLines(ooPurchase, answers).some(l => l.includes('rental'))).toBe(false)
  })

  it('says "not stated" on an investment purchase rather than pretending it is zero', () => {
    const lines = emailLines(invPurchase, answers)
    expect(lines).toContain('Proposed rental income: not stated')
    expect(emailLines(invPurchase, { ...answers, rentalIncome: '2,400' }))
      .toContain('Proposed rental income: $2,400')
  })

  it('tells credit to start the discharge', () => {
    expect(emailLines(refi, { ...answers, dischargePrepared: true }))
      .toContain('Discharge authority: prepare now')
  })
})
