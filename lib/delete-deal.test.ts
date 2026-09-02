import { describe, it, expect } from 'vitest'
import { canDelete, whatIsLost, deleteConfirmed } from './delete-deal'

describe('when a deal may be deleted at all', () => {
  it('allows a deal that has gone nowhere', () => {
    expect(canDelete({}).allowed).toBe(true)
  })

  it('refuses once compliance has left the building', () => {
    const check = canDelete({ compliance_sent_at: '2026-09-02T00:00:00Z' })
    expect(check.allowed).toBe(false)
    if (check.allowed) return
    // The reason has to say why, not just no - otherwise somebody goes looking
    // for another way to do it.
    expect(check.because).toMatch(/credit team/)
    expect(check.because).toMatch(/marked lost/)
  })

  it('refuses a settled loan, which the trail book is built on', () => {
    expect(canDelete({ settled_at: '2026-08-01' }).allowed).toBe(false)
    expect(canDelete({ status: 'settled' }).allowed).toBe(false)
  })

  it('still allows one that is merely lost — a lost deal can be a mistake too', () => {
    expect(canDelete({ status: 'lost' }).allowed).toBe(true)
  })
})

describe('what the warning says would be lost', () => {
  const deal = {
    fact_find_data: { applicants: [{ id: 'a1' }, { id: 'a2' }] },
    bc_data: { purchasePrice: '5,250,000' },
    lo_data: { recommendedLender: 'ING' },
    compliance_data: { analysisComment: 'x' },
  }

  it('names the fact find and counts the applicants', () => {
    expect(whatIsLost(deal, 2)[0]).toBe('The fact find — 2 applicants, income, assets, liabilities')
  })

  it('says one applicant, not 1 applicants', () => {
    expect(whatIsLost({ fact_find_data: { applicants: [{}] } })[0]).toMatch(/1 applicant,/)
  })

  it('counts the attached documents', () => {
    expect(whatIsLost(deal, 2)).toContain('2 attached documents')
    expect(whatIsLost(deal, 1)).toContain('1 attached document')
  })

  it('leaves out what a deal does not have', () => {
    const bare = whatIsLost({}, 0)
    expect(bare.some(l => l.includes('fact find'))).toBe(false)
    expect(bare.some(l => l.includes('document'))).toBe(false)
  })

  it('always ends with the one people forget', () => {
    for (const d of [deal, {}]) {
      const lines = whatIsLost(d, 0)
      expect(lines[lines.length - 1]).toBe('Any record that this client ever came to you')
    }
  })
})

describe('typing DELETE', () => {
  it('accepts the word, however it is cased or spaced', () => {
    expect(deleteConfirmed('DELETE')).toBe(true)
    expect(deleteConfirmed(' delete ')).toBe(true)
  })
  it('refuses anything else', () => {
    expect(deleteConfirmed('')).toBe(false)
    expect(deleteConfirmed('delet')).toBe(false)
    expect(deleteConfirmed('yes')).toBe(false)
  })
})
