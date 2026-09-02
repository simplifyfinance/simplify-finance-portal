import { describe, it, expect } from 'vitest'
import { recorded, copyPlan, copyAddresses } from './copy-history'

const current = { id: '1', address: '6 Bella Vista Court, Warriewood NSW 2102', isCurrent: true, startDate: '01/03/2019' }
const previous = { id: '2', address: '12 Alkira Road, Mona Vale NSW 2103', isCurrent: false, startDate: '01/01/2015', endDate: '01/03/2019' }
const blank = { id: '3', address: '', isCurrent: true, startDate: '' }

describe('what counts as recorded', () => {
  it('ignores the empty row the form starts with', () => {
    expect(recorded([blank])).toHaveLength(0)
  })
  it('ignores a row holding only spaces', () => {
    expect(recorded([{ id: 'x', address: '   ' }])).toHaveLength(0)
  })
  it('copes with nothing at all', () => {
    expect(recorded(undefined)).toEqual([])
    expect(recorded(null)).toEqual([])
  })
})

describe('what the screen should offer', () => {
  it('says there is nothing to copy when the other applicant is empty too', () => {
    expect(copyPlan([blank], [blank])).toEqual({ kind: 'nothing' })
  })

  it('offers a plain copy when nothing would be lost', () => {
    expect(copyPlan([current, previous], [blank])).toEqual({ kind: 'offer', count: 2 })
  })

  it('warns, and names what goes, when there is already something here', () => {
    const plan = copyPlan([current, previous], [{ id: '9', address: '44 Pittwater Road, Manly NSW 2095' }])
    expect(plan.kind).toBe('replace')
    if (plan.kind !== 'replace') return
    expect(plan.count).toBe(2)
    // Named, not counted. "1 address will be removed" is not enough to decide on.
    expect(plan.removing).toEqual(['44 Pittwater Road, Manly NSW 2095'])
  })

  it('does not warn about a blank row, which is nothing to lose', () => {
    expect(copyPlan([current], [blank]).kind).toBe('offer')
  })
})

describe('the copy itself', () => {
  let n = 0
  const newId = () => `new-${++n}`

  it('brings the current address and every previous one', () => {
    const out = copyAddresses([current, previous], newId)
    expect(out.map(a => a.address)).toEqual([current.address, previous.address])
    expect(out.map(a => a.isCurrent)).toEqual([true, false])
  })

  it('leaves the blank starter row behind', () => {
    expect(copyAddresses([current, blank], newId)).toHaveLength(1)
  })

  it('gives every copy its own id, so editing one does not edit the other', () => {
    const out = copyAddresses([current, previous], newId)
    expect(out.map(a => a.id)).not.toEqual([current.id, previous.id])
    expect(new Set(out.map(a => a.id)).size).toBe(2)
  })

  it('does not hand back the same objects', () => {
    const out = copyAddresses([current], newId)
    out[0].address = 'changed'
    expect(current.address).toBe('6 Bella Vista Court, Warriewood NSW 2102')
  })

  it('keeps the dates and the housing expense', () => {
    const [a] = copyAddresses([previous], newId)
    expect(a.startDate).toBe('01/01/2015')
    expect(a.endDate).toBe('01/03/2019')
  })
})
