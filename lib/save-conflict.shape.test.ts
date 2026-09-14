import { describe, it, expect, vi } from 'vitest'
import { saveGuarded, newGuard, snapshot } from './save-conflict'

// TWO PEOPLE ON ONE FACT FIND, AND THE COMPARISON THAT WAS COMPARING THE WRONG
// TWO THINGS.
//
// 14 Sep 2026. Kylie, with Melissa in the same deal: "If I tick the box after a
// few seconds - it unticks it. If I remove a data - it goes back."
//
// Every tab puts records through shape() before they reach the screen, and the
// screen is what gets saved. But the guard was seeded with the RAW stored record
// and compared the stored record RAW. On any record missing a key shape() fills
// in - which is most older records - those two are different, so:
//
//   * "has anybody typed?" always answered yes, even on a deal just opened, and
//   * the three-way merge was handed a base this screen had never held, which
//     decides the wrong owner for a contested field.
//
// These tests pin the comparison to the shaped copy on both sides.

// The stored record on an older deal: no `assets` key at all.
const STORED = { applicants: [{ id: 'a1', firstName: 'Richard' }] }
// What the screen holds after shape() fills the missing lists in.
const shape = (v: any) => ({ applicants: [], assets: [], properties: [], liabilities: [], ...(v || {}) })

function db(row: any, onUpdate?: (fields: any) => void) {
  return {
    from() {
      const read: any = {
        select: () => read,
        eq: () => read,
        single: async () => ({ data: row, error: null }),
        insert: async () => ({ error: null }),
        update: (fields: any) => {
          onUpdate?.(fields)
          // The write chain is its own thing: .eq().eq().select() must end in
          // the rows, not back in the read chain.
          const wrote: any = {
            eq: () => wrote,
            select: async () => ({ data: [{ id: 'd1' }], error: null }),
          }
          return wrote
        },
      }
      return read
    },
  }
}

describe('opening a deal is not editing it', () => {
  it('writes NOTHING when the screen has only been shaped, not typed in', async () => {
    // The exact case that made two people merely LOOKING at a deal collide.
    const writes: any[] = []
    const out = await saveGuarded({
      supabase: db({ fact_find_data: STORED, row_version: 4, last_saved_name: 'Melissa Sedin' },
                   f => writes.push(f)),
      dealId: 'd1', column: 'fact_find_data',
      guard: newGuard(shape(STORED)),
      value: shape(STORED),
      shape,
    })
    expect(out.kind, 'opening the deal counted as an edit').toBe('settled')
    expect(writes, 'it wrote to the database without anybody typing').toHaveLength(0)
  })

  it('used to write, which is what this is guarding against', async () => {
    // The same call with the OLD seeding - raw in, shaped out - to show the
    // difference is real and not the test agreeing with itself.
    const writes: any[] = []
    const out = await saveGuarded({
      supabase: db({ fact_find_data: STORED, row_version: 4, last_saved_name: 'Melissa Sedin' },
                   f => writes.push(f)),
      dealId: 'd1', column: 'fact_find_data',
      guard: newGuard(STORED),          // raw, as it was
      value: shape(STORED),             // shaped, as it always was
      // and no shape passed, as it was
    })
    expect(out.kind).not.toBe('settled')
  })
})

describe('a tick somebody else has not touched', () => {
  it('survives when the other person saved a different field', async () => {
    // Melissa changed a name. Kylie ticked an ownership box. Nothing is
    // contested, so both must end up in the record.
    const base = shape(STORED)
    const theirs = { ...base, applicants: [{ id: 'a1', firstName: 'Richard', middleName: 'John' }] }
    const mine = { ...base, assets: [{ id: 'as1', ownership: { a1: true } }] }

    let written: any = null
    const merged: any[] = []
    const out = await saveGuarded({
      supabase: db({ fact_find_data: theirs, row_version: 9, last_saved_name: 'Melissa Sedin' },
                   f => { written = f.fact_find_data }),
      dealId: 'd1', column: 'fact_find_data',
      guard: newGuard(base),
      value: mine,
      shape,
      onMerge: v => merged.push(v),
    })

    expect(out.kind, 'the tick and the name could not be put together').toBe('merged')
    expect(written.assets[0].ownership.a1, 'the tick was lost').toBe(true)
    expect(written.applicants[0].middleName, 'their change was lost').toBe('John')
  })

  it('does not treat a key shape() invented as something the other person deleted', async () => {
    // `assets` exists on screen because shape() put it there, and does not exist
    // in the stored record at all. Compared raw, that read as this person having
    // added it and the other person having removed it.
    const base = shape(STORED)
    const mine = { ...base, dependants: '2' }
    let written: any = null
    const out = await saveGuarded({
      supabase: db({ fact_find_data: STORED, row_version: 2 }, f => { written = f.fact_find_data }),
      dealId: 'd1', column: 'fact_find_data',
      guard: newGuard(base), value: mine, shape,
      onMerge: () => {},
    })
    expect(out.kind).toBe('saved')
    expect(written.dependants).toBe('2')
    expect(Array.isArray(written.assets)).toBe(true)
  })
})

describe('the snapshot itself', () => {
  it('treats a missing record and null as the same thing', () => {
    expect(snapshot(undefined)).toBe(snapshot(null))
  })
})
