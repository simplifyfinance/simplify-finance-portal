import { describe, it, expect } from 'vitest'
import { snapshot, newGuard, emptyGuard, adopt, saveGuarded, conflictMessage } from './save-conflict'

// A deals table with one row, standing in for Postgres. Records every write so
// a test can assert that nothing was written, which is half the point of the
// guard - the failures it exists to stop are writes that should not have
// happened, not errors.
function fakeDb(initial: any, opts: { readError?: any; rlsBlocks?: boolean } = {}) {
  const state = { value: initial, writes: [] as any[], reads: 0 }
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            state.reads++
            return opts.readError
              ? { data: null, error: opts.readError }
              : { data: { fact_find_data: state.value }, error: null }
          },
        }),
      }),
      update: (patch: any) => ({
        eq: () => ({
          select: async () => {
            if (opts.rlsBlocks) return { data: [], error: null }
            state.writes.push(patch)
            state.value = patch.fact_find_data
            return { data: [{ id: 'd1' }], error: null }
          },
        }),
      }),
    }),
  }
  return { supabase, state }
}

const save = (supabase: any, guard: any, value: any, onAdopt?: any) =>
  saveGuarded({ supabase, dealId: 'd1', column: 'fact_find_data', guard, value, onAdopt })

describe('opening a deal is not editing it', () => {
  it('writes nothing when the form has only just appeared on screen', async () => {
    const loaded = { applicants: [{ firstName: 'Ricardo' }] }
    const { supabase, state } = fakeDb(loaded)
    const guard = newGuard(loaded)
    expect(await save(supabase, guard, loaded)).toEqual({ kind: 'settled' })
    expect(state.writes).toHaveLength(0)
  })

  // Two people with the deal merely open. Neither has typed. Neither should be
  // told anything at all. This is the Katie and Kylie case, 5 Sep 2026.
  it('leaves two people looking at the same deal completely alone', async () => {
    const loaded = { applicants: [{ firstName: 'Ricardo' }] }
    const { supabase, state } = fakeDb(loaded)
    const kylie = newGuard(loaded)
    const katie = newGuard(loaded)
    expect(await save(supabase, kylie, loaded)).toEqual({ kind: 'settled' })
    expect(await save(supabase, katie, loaded)).toEqual({ kind: 'settled' })
    expect(state.writes).toHaveLength(0)
  })
})

describe('an ordinary edit', () => {
  it('saves', async () => {
    const loaded = { dependants: '0' }
    const { supabase, state } = fakeDb(loaded)
    const guard = newGuard(loaded)
    expect(await save(supabase, guard, { dependants: '2' })).toEqual({ kind: 'saved' })
    expect(state.writes).toEqual([{ fact_find_data: { dependants: '2' } }])
  })

  it('carries the extra columns the LO and compliance put on the deal', async () => {
    const { supabase, state } = fakeDb({ a: 1 })
    const guard = newGuard({ a: 1 })
    await saveGuarded({ supabase, dealId: 'd1', column: 'fact_find_data', guard,
      value: { a: 2 }, patch: { loan_amount: 1700000, lender_id: 'x' } })
    expect(state.writes[0]).toEqual({ fact_find_data: { a: 2 }, loan_amount: 1700000, lender_id: 'x' })
  })
})

describe('a form cannot conflict with itself', () => {
  // The lockup Kylie hit with nobody else on the deal: two saves in flight,
  // landing out of order, and the form then reading its OWN last save as
  // somebody else's.
  it('does not lock when saves are fired faster than they land', async () => {
    const { supabase } = fakeDb({ n: 0 })
    const guard = newGuard({ n: 0 })
    const results = await Promise.all([
      save(supabase, guard, { n: 1 }),
      save(supabase, guard, { n: 2 }),
      save(supabase, guard, { n: 3 }),
    ])
    // Older payloads are dropped rather than landing on top of newer ones.
    expect(results.filter(r => r.kind === 'conflict')).toHaveLength(0)
    expect(results[2]).toEqual({ kind: 'saved' })
    // And the form is still usable afterwards.
    expect(await save(supabase, guard, { n: 4 })).toEqual({ kind: 'saved' })
  })

  it('recognises its own earlier write coming back at it', async () => {
    const { supabase, state } = fakeDb({ n: 0 })
    const guard = newGuard({ n: 0 })
    await save(supabase, guard, { n: 1 })
    // Something else moved our belief backwards - an out of order landing.
    guard.db = snapshot({ n: 0 })
    expect(await save(supabase, guard, { n: 2 })).toEqual({ kind: 'saved' })
    expect(state.writes).toHaveLength(2)
  })
})

describe('somebody else has saved', () => {
  it('quietly takes their version when we have typed nothing', async () => {
    const loaded = { dependants: '0' }
    const { supabase, state } = fakeDb(loaded)
    const kylie = newGuard(loaded)
    const katie = newGuard(loaded)
    await save(supabase, katie, { dependants: '2' })

    let putOnScreen: any = null
    // Kylie has not touched anything, so her pending value is still what she loaded.
    expect(await save(supabase, kylie, loaded, (v: any) => { putOnScreen = v })).toEqual({ kind: 'settled' })
    expect(putOnScreen).toEqual({ dependants: '2' })
    // Katie's write is the only one. Kylie wrote nothing over the top of it.
    expect(state.writes).toHaveLength(1)
  })

  it('refuses to save, and says so, when we have typed too', async () => {
    const loaded = { dependants: '0', suburb: '' }
    const { supabase, state } = fakeDb(loaded)
    const kylie = newGuard(loaded)
    const katie = newGuard(loaded)
    await save(supabase, katie, { dependants: '2', suburb: '' })
    expect(await save(supabase, kylie, { dependants: '0', suburb: 'Killara' }, () => {}))
      .toEqual({ kind: 'conflict' })
    expect(state.writes).toHaveLength(1)
    expect(state.value).toEqual({ dependants: '2', suburb: '' })
  })

  // Refusing has to be recoverable, or it is not a guard, it is a lock.
  it('is over the moment the page is reloaded', async () => {
    const loaded = { dependants: '0', suburb: '' }
    const { supabase } = fakeDb(loaded)
    const kylie = newGuard(loaded)
    await save(supabase, newGuard(loaded), { dependants: '2', suburb: '' })
    expect(await save(supabase, kylie, { dependants: '0', suburb: 'Killara' }, () => {})).toEqual({ kind: 'conflict' })
    // Reload: the form comes back holding what the database now says.
    const afterReload = newGuard({ dependants: '2', suburb: '' })
    expect(await save(supabase, afterReload, { dependants: '2', suburb: 'Killara' })).toEqual({ kind: 'saved' })
  })

  // A form that cannot re-hydrate itself must not silently drop their work.
  it('shows the banner rather than adopting when the form cannot refresh itself', async () => {
    const loaded = { dependants: '0' }
    const { supabase } = fakeDb(loaded)
    const guard = newGuard(loaded)
    await save(supabase, newGuard(loaded), { dependants: '2' })
    expect(await save(supabase, guard, loaded)).toEqual({ kind: 'conflict' })
  })

  it('settles when they happened to type exactly what we were about to', async () => {
    const loaded = { dependants: '0' }
    const { supabase, state } = fakeDb(loaded)
    const guard = newGuard(loaded)
    await save(supabase, newGuard(loaded), { dependants: '2' })
    expect(await save(supabase, guard, { dependants: '2' })).toEqual({ kind: 'settled' })
    expect(state.writes).toHaveLength(1)
  })
})

describe('the database itself misbehaving', () => {
  it('still saves when the check read fails - a hiccup must not stop the form saving', async () => {
    const { supabase, state } = fakeDb({ a: 1 }, { readError: { message: 'network' } })
    expect(await save(supabase, newGuard({ a: 1 }), { a: 2 })).toEqual({ kind: 'saved' })
    expect(state.writes).toHaveLength(1)
  })

  it('reports a write that row level security refused - zero rows and no error', async () => {
    const { supabase } = fakeDb({ a: 1 }, { rlsBlocks: true })
    const out = await save(supabase, newGuard({ a: 1 }), { a: 2 })
    expect(out.kind).toBe('error')
    expect((out as any).message).toContain('did not reach the database')
  })
})

describe('a form that reads the record itself', () => {
  it('judges nothing until it has been told what the record holds', async () => {
    const { supabase, state } = fakeDb({ a: 1 })
    const guard = emptyGuard()
    // The LO loads lo_data after mount; before that it has no opinion.
    expect(await save(supabase, guard, { a: 2 })).toEqual({ kind: 'saved' })
    expect(state.writes).toHaveLength(1)
  })

  it('takes the loaded record as its starting point', async () => {
    const { supabase, state } = fakeDb({ a: 1 })
    const guard = emptyGuard()
    adopt(guard, { a: 1 })
    expect(await save(supabase, guard, { a: 1 })).toEqual({ kind: 'settled' })
    expect(state.writes).toHaveLength(0)
  })
})

describe('what the banner says', () => {
  it('names the tab', () => {
    expect(conflictMessage('Lending options').title).toContain('Lending options')
    expect(conflictMessage('Fact Find').title).toContain('Fact Find')
  })

  it('says plainly that nothing was saved', () => {
    expect(conflictMessage('BC').body).toContain('has been saved')
  })
})
