import { describe, it, expect } from 'vitest'
import { merge3 } from './deal-merge'

const ok = (r: any) => { expect(r.ok).toBe(true); return r }
const no = (r: any) => { expect(r.ok).toBe(false); return r }

describe('nobody is in anybody else\'s way', () => {
  it('takes each person\'s own field', () => {
    const base = { a: '1', b: '1' }
    const r = ok(merge3(base, { a: '2', b: '1' }, { a: '1', b: '3' }))
    expect(r.merged).toEqual({ a: '2', b: '3' })
    expect(r.fromThem.map((p: any) => p.join('.'))).toEqual(['a'])
  })

  it('leaves a field neither touched alone', () => {
    const r = ok(merge3({ a: '1', c: 'x' }, { a: '2', c: 'x' }, { a: '1', c: 'x' }))
    expect(r.merged.c).toBe('x')
  })

  it('is happy when they both made the same change', () => {
    const r = ok(merge3({ a: '1' }, { a: '2' }, { a: '2' }))
    expect(r.merged).toEqual({ a: '2' })
    // Not reported as theirs - there is nothing to tell anybody.
    expect(r.fromThem).toEqual([])
  })

  it('goes as deep as it needs to', () => {
    const base = { app: { name: { first: 'Ric', last: '' }, dob: '' } }
    const r = ok(merge3(base,
      { app: { name: { first: 'Ric', last: 'Fogolin' }, dob: '' } },
      { app: { name: { first: 'Ric', last: '' }, dob: '14/03/1979' } }))
    expect(r.merged.app).toEqual({ name: { first: 'Ric', last: 'Fogolin' }, dob: '14/03/1979' })
  })
})

describe('the same field, both of us', () => {
  it('refuses and names it', () => {
    const r = no(merge3({ a: '1' }, { a: '2' }, { a: '3' }))
    expect(r.clashes).toEqual([['a']])
  })

  it('refuses the whole record, not just the contested part', () => {
    const r = no(merge3({ a: '1', b: '1' }, { a: '2', b: '9' }, { a: '3', b: '1' }))
    expect(r.clashes).toEqual([['a']])
    expect(r.merged).toBeUndefined()
  })

  it('names a field deep inside a list', () => {
    const base = { applicants: [{ id: 'a1', income: [{ id: 'i1', grossSalary: '' }] }] }
    const theirs = { applicants: [{ id: 'a1', income: [{ id: 'i1', grossSalary: '180,000' }] }] }
    const mine = { applicants: [{ id: 'a1', income: [{ id: 'i1', grossSalary: '190,000' }] }] }
    const r = no(merge3(base, theirs, mine))
    expect(r.clashes).toEqual([['applicants', 0, 'income', 0, 'grossSalary']])
  })
})

describe('lists of rows', () => {
  const row = (id: string, v: string) => ({ id, v })

  it('matches rows by id, not by position', () => {
    const base = { l: [row('a', '1'), row('b', '1')] }
    // They deleted the first row, so 'b' is now at position 0 for them.
    const theirs = { l: [{ id: 'b', v: '1' }] }
    const mine = { l: [row('a', '1'), row('b', '2')] }
    const r = ok(merge3(base, theirs, mine))
    expect(r.merged.l).toEqual([{ id: 'b', v: '2' }])
  })

  it('keeps a row each of us added', () => {
    const base = { l: [row('a', '1')] }
    const r = ok(merge3(base, { l: [row('a', '1'), row('t', 'theirs')] }, { l: [row('a', '1'), row('m', 'mine')] }))
    expect(r.merged.l.map((x: any) => x.id)).toEqual(['a', 'm', 't'])
  })

  it('refuses when they edited a row we deleted', () => {
    const base = { l: [row('a', '1')] }
    no(merge3(base, { l: [row('a', '2')] }, { l: [] }))
  })

  it('refuses when we edited a row they deleted', () => {
    const base = { l: [row('a', '1')] }
    no(merge3(base, { l: [] }, { l: [row('a', '2')] }))
  })

  it('accepts a deletion nobody else was working on', () => {
    const base = { l: [row('a', '1'), row('b', '1')], other: '' }
    const r = ok(merge3(base, { l: [row('b', '1')], other: '' }, { l: [row('a', '1'), row('b', '1')], other: 'typed' }))
    expect(r.merged.l.map((x: any) => x.id)).toEqual(['b'])
    expect(r.merged.other).toBe('typed')
  })

  // Checkbox lists, the research criteria, the document checklist. There is no
  // "same row" to match on, so both of us having changed it is a real clash.
  it('will not guess at a list of plain values', () => {
    no(merge3({ c: ['rate'] }, { c: ['rate', 'offset'] }, { c: ['rate', 'turnaround'] }))
  })

  it('is fine with a list of plain values only one of us touched', () => {
    const r = ok(merge3({ c: ['rate'] }, { c: ['rate', 'offset'] }, { c: ['rate'] }))
    expect(r.merged.c).toEqual(['rate', 'offset'])
  })
})

describe('keys appearing and disappearing', () => {
  it('keeps a key only they added', () => {
    const r = ok(merge3({ a: '1' }, { a: '1', b: 'theirs' }, { a: '2' }))
    expect(r.merged).toEqual({ a: '2', b: 'theirs' })
  })

  it('honours a key one of us removed when the other left it alone', () => {
    const r = ok(merge3({ a: '1', b: '1' }, { a: '1' }, { a: '2', b: '1' }))
    expect(r.merged).toEqual({ a: '2' })
  })

  it('refuses a key one removed and the other changed', () => {
    no(merge3({ a: '1', b: '1' }, { a: '1' }, { a: '1', b: '2' }))
  })
})

describe('an empty record', () => {
  it('treats a record that was never written as nothing rather than a clash', () => {
    const r = ok(merge3(null, { a: 'theirs' }, { a: 'theirs', b: 'mine' }))
    expect(r.merged).toEqual({ a: 'theirs', b: 'mine' })
  })
})
