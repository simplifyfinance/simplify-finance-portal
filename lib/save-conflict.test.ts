import { describe, it, expect } from 'vitest'
import { snapshot, someoneElseSaved, conflictMessage } from './save-conflict'

const db = (value: any, error: any = null) => ({
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: value, error }) }) }) }),
})

describe('has anybody else saved', () => {
  it('is quiet when the record is the one we loaded', async () => {
    const seen = snapshot({ loanAmount: '1,700,000' })
    expect(await someoneElseSaved(db({ lo_data: { loanAmount: '1,700,000' } }), 'd', 'lo_data', seen)).toBe(false)
  })

  it('catches a change made underneath us', async () => {
    const seen = snapshot({ loanAmount: '1,700,000' })
    expect(await someoneElseSaved(db({ lo_data: { loanAmount: '1,700,000', rate: '5.64' } }), 'd', 'lo_data', seen)).toBe(true)
  })

  // The Katie case exactly: she fills in something that was empty.
  it('catches a field being filled in that we still think is blank', async () => {
    const seen = snapshot({ lenders: [{ lenderName: 'ING', variablePI: { rate: '' } }] })
    expect(await someoneElseSaved(db({ lo_data: { lenders: [{ lenderName: 'ING', variablePI: { rate: '5.64' } }] } }),
      'd', 'lo_data', seen)).toBe(true)
  })

  it('has nothing to compare before the form has loaded', async () => {
    expect(await someoneElseSaved(db({ lo_data: { anything: true } }), 'd', 'lo_data', null)).toBe(false)
  })

  it('treats an empty column and a null column the same', async () => {
    expect(await someoneElseSaved(db({ lo_data: null }), 'd', 'lo_data', snapshot(null))).toBe(false)
  })

  // A form that silently stops saving because the network hiccuped is worse
  // than the problem this guard exists to solve.
  it('does not cry conflict when the read itself failed', async () => {
    expect(await someoneElseSaved(db(null, { message: 'network' }), 'd', 'lo_data', snapshot({ a: 1 }))).toBe(false)
  })
})

describe('what the banner says', () => {
  it('names the tab', () => {
    expect(conflictMessage('Lending options').title).toContain('Lending options')
    expect(conflictMessage('Fact Find').title).toContain('Fact Find')
  })

  it('says plainly that nothing was saved', () => {
    expect(conflictMessage('BC').body).toContain('nothing you have typed since has been saved')
  })
})
