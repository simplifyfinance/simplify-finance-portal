import { describe, it, expect } from 'vitest'
import { foldIn, isMine, type LiveUpdate } from './live-deal'

// A deal tab as it actually is: money as comma-formatted strings, rows in lists
// with ids.
const BASE = {
  existingLoanBal: '424,000',
  propertyValue: '540,000',
  loanTerm: '30',
  splits: [{ id: 's1', label: 'Refinanced loan', amount: '448,700', rate: '6.95' }],
}

describe('what goes on screen when somebody else saves', () => {
  it('takes their whole version when nothing has been typed here', () => {
    // Kylie is reading; Melissa saves. This is the ordinary case and the one
    // that makes a second screen feel live.
    const theirs = { ...BASE, propertyValue: '560,000' }
    const out = foldIn(BASE, theirs, BASE)
    expect(out.kind).toBe('take')
    expect((out as any).value.propertyValue).toBe('560,000')
  })

  // THE RULE THAT MAKES IT SAFE.
  it('never touches a field this person has typed in', () => {
    const mine = { ...BASE, loanTerm: '25' }              // I am mid-edit here
    const theirs = { ...BASE, propertyValue: '560,000' }  // they changed something else
    const out = foldIn(BASE, theirs, mine)
    expect(out.kind).toBe('take')
    expect((out as any).value.loanTerm).toBe('25')          // mine, untouched
    expect((out as any).value.propertyValue).toBe('560,000') // theirs, folded in
  })

  it('names the fields it brought in', () => {
    const theirs = { ...BASE, propertyValue: '560,000', existingLoanBal: '430,000' }
    const out = foldIn(BASE, theirs, { ...BASE, loanTerm: '25' })
    expect((out as any).fields.sort()).toEqual(['existingLoanBal', 'propertyValue'])
  })

  it('folds in a row of a list without disturbing the rest', () => {
    const theirs = { ...BASE, splits: [{ ...BASE.splits[0], rate: '6.49' }] }
    const mine = { ...BASE, loanTerm: '25' }
    const out = foldIn(BASE, theirs, mine)
    expect((out as any).value.splits[0].rate).toBe('6.49')
    expect((out as any).value.loanTerm).toBe('25')
  })

  it('does nothing when their save holds nothing new', () => {
    expect(foldIn(BASE, BASE, BASE).kind).toBe('nothing')
    expect(foldIn(BASE, { ...BASE }, { ...BASE }).kind).toBe('nothing')
  })

  it('does nothing when this screen already has what they saved', () => {
    const both = { ...BASE, propertyValue: '560,000' }
    expect(foldIn(BASE, both, both).kind).toBe('nothing')
  })

  // The one case there is no honest answer to.
  it('reports a clash when both changed the same field to different things', () => {
    const theirs = { ...BASE, propertyValue: '560,000' }
    const mine = { ...BASE, propertyValue: '575,000' }
    const out = foldIn(BASE, theirs, mine)
    expect(out.kind).toBe('clash')
    expect((out as any).fields).toContain('propertyValue')
  })

  it('leaves the screen alone on a clash rather than overwriting what is typed', () => {
    const out = foldIn(BASE, { ...BASE, loanTerm: '25' }, { ...BASE, loanTerm: '20' })
    expect(out).not.toHaveProperty('value')
  })

  it('survives an empty or missing record on either side', () => {
    expect(() => foldIn(null, BASE, BASE)).not.toThrow()
    expect(() => foldIn(BASE, null, BASE)).not.toThrow()
    expect(() => foldIn({}, {}, {})).not.toThrow()
  })
})

describe('whose save was it', () => {
  const u = (byId: string): LiveUpdate => ({ incoming: {}, byId, byName: 'X', version: 1 })

  it('knows my own write coming back', () => {
    expect(isMine(u('me-123'), 'me-123')).toBe(true)
  })

  it('knows somebody else', () => {
    expect(isMine(u('kylie-9'), 'me-123')).toBe(false)
  })

  // An unsigned save is not proof it was mine, and treating it as mine would
  // silently drop somebody's work off this screen.
  it('treats an unsigned save as somebody else', () => {
    expect(isMine(u(''), 'me-123')).toBe(false)
    expect(isMine(u('kylie-9'), null)).toBe(false)
    expect(isMine(u(''), '')).toBe(false)
  })
})
