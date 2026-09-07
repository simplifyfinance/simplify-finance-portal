import { describe, it, expect } from 'vitest'
import { snapshot, newGuard, emptyGuard, adopt, saveGuarded, overwroteMessage, behindMessage } from './save-conflict'

// A deals table with one row, standing in for Postgres. Records every write so
// a test can assert that nothing was written, which is half the point of the
// guard - the failures it exists to stop are writes that should not have
// happened, not errors.
function fakeDb(initial: any, opts: { readError?: any; rlsBlocks?: boolean; landsUnderneath?: number } = {}) {
  const state = { value: initial, writes: [] as any[], reads: 0, version: 0, savedBy: '', history: [] as any[] }
  // A save that lands in the gap between somebody reading the record and writing
  // it - the one moment the browser cannot see. Counted down so a test can say
  // "this happens once, then stops".
  let sneak = opts.landsUnderneath || 0

  const supabase = {
    from: (table: string) => table === 'deal_history' ? ({
      // The copy put aside before a save. See lib/deal-history.ts.
      insert: async (row: any) => { state.history.push(row); return { error: null } },
    }) as any : ({
      select: (cols: string) => ({
        eq: () => ({
          single: async () => {
            state.reads++
            if (opts.readError) return { data: null, error: opts.readError }
            if (String(cols).trim() === 'row_version') return { data: { row_version: state.version }, error: null }
            return { data: { fact_find_data: state.value, row_version: state.version, last_saved_name: state.savedBy }, error: null }
          },
        }),
      }),
      update: (fields: any) => {
        let pinned: number | null = null
        const chain: any = {
          eq: (col: string, val: any) => { if (col === 'row_version') pinned = val; return chain },
          select: async () => {
            if (opts.rlsBlocks) return { data: [], error: null }
            // Their save lands HERE - after ours read the record, before ours
            // writes it. The one moment the browser cannot see.
            if (sneak > 0) { sneak--; state.version++; state.value = { ...state.value, sneakedIn: true } }
            if (pinned !== null && pinned !== state.version) return { data: [], error: null }
            state.writes.push(fields)
            state.value = fields.fact_find_data
            if (typeof fields.last_saved_name === 'string') state.savedBy = fields.last_saved_name
            state.version = typeof fields.row_version === 'number' ? fields.row_version : state.version + 1
            return { data: [{ id: 'd1' }], error: null }
          },
        }
        return chain
      },
    }),
  }
  return { supabase, state }
}

const save = (supabase: any, guard: any, value: any, onAdopt?: any, onMerge?: any) =>
  saveGuarded({ supabase, dealId: 'd1', column: 'fact_find_data', guard, value, onAdopt, onMerge })

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
    expect(state.writes).toEqual([{ fact_find_data: { dependants: '2' }, row_version: 1 }])
  })

  it('carries the extra columns the LO and compliance put on the deal', async () => {
    const { supabase, state } = fakeDb({ a: 1 })
    const guard = newGuard({ a: 1 })
    await saveGuarded({ supabase, dealId: 'd1', column: 'fact_find_data', guard,
      value: { a: 2 }, patch: { loan_amount: 1700000, lender_id: 'x' } })
    expect(state.writes[0]).toEqual({ fact_find_data: { a: 2 }, loan_amount: 1700000, lender_id: 'x', row_version: 1 })
  })
})

describe('a form cannot collide with itself', () => {
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
    expect(results.filter(r => r.kind === 'overwrote')).toHaveLength(0)
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

  // NOTHING IS EVER REFUSED. Before 7 Sep 2026 this returned a red banner and
  // wrote nothing, which left people unable to save at all.
  it('saves anyway when the form cannot fold their fields in, and keeps theirs', async () => {
    const loaded = { dependants: '0', suburb: '' }
    const { supabase, state } = fakeDb({ ...loaded })
    const kylie = newGuard(loaded)
    const katie = newGuard(loaded)
    await save(supabase, katie, { dependants: '2', suburb: '' })
    // onAdopt but no onMerge - this is BC.
    const out = await save(supabase, kylie, { dependants: '0', suburb: 'Killara' }, () => {})
    expect(out.kind).toBe('overwrote')
    expect(state.writes).toHaveLength(2)
    expect(state.value).toEqual({ dependants: '0', suburb: 'Killara' })
  })

  it('names the field when the same one was changed by both', async () => {
    const loaded = { dependants: '0' }
    const { supabase, state } = fakeDb({ ...loaded })
    const kylie = newGuard(loaded)
    await save(supabase, newGuard(loaded), { dependants: '2' })
    const out = await save(supabase, kylie, { dependants: '3' }, () => {}, () => {})
    expect(out.kind).toBe('overwrote')
    expect((out as any).fields).toBe('Dependants')
    // Ours went in. Theirs is not lost - it is in the history.
    expect(state.value).toEqual({ dependants: '3' })
  })

  it('says the screen is out of date when there is nothing of ours to save', async () => {
    const loaded = { dependants: '0' }
    const { supabase, state } = fakeDb({ ...loaded })
    const guard = newGuard(loaded)
    await save(supabase, newGuard(loaded), { dependants: '2' })
    // No onAdopt: BC cannot refresh itself, so it is told rather than shown.
    const out = await save(supabase, guard, loaded)
    expect(out.kind).toBe('behind')
    // And nothing of theirs was written over, because we had nothing to write.
    expect(state.value).toEqual({ dependants: '2' })
  })

  it('settles when they happened to type exactly what we were about to', async () => {
    const loaded = { dependants: '0' }
    const { supabase, state } = fakeDb({ ...loaded })
    const guard = newGuard(loaded)
    await save(supabase, newGuard(loaded), { dependants: '2' })
    expect((await save(supabase, guard, { dependants: '2' })).kind).toBe('settled')
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

describe('what the notes say', () => {
  // Not one of them stops anybody doing anything.
  it('never tells anybody they cannot save', () => {
    const all = [
      overwroteMessage('BC', 'Deposit', 'Katie Amos'),
      overwroteMessage('Fact Find'),
      behindMessage('BC', 'Katie Amos'),
      behindMessage('Compliance'),
    ]
    for (const m of all) {
      expect(m).not.toMatch(/not been saved|cannot|reload to pick up|wipe out/i)
    }
  })

  it('says the work went in, and that theirs is kept', () => {
    const m = overwroteMessage('BC', 'Deposit', 'Katie Amos')
    expect(m).toContain('Your BC is saved')
    expect(m).toContain('Katie Amos')
    expect(m).toContain('you both changed Deposit')
    expect(m).toContain('Nothing is lost')
  })

  it('names nobody gracefully when the record is unsigned', () => {
    expect(overwroteMessage('BC')).toContain('Somebody else')
    expect(behindMessage('BC')).toContain('Somebody else')
  })

  it('tells somebody looking at an old screen that they are not blocked', () => {
    const m = behindMessage('BC', 'Katie Amos')
    expect(m).toContain('Katie Amos has saved this BC')
    expect(m).toContain('nothing is blocked')
  })
})

// NAMING SOMEBODY WHO HAS GONE HOME.
//
// The presence table only knows who has the deal open right now. On the deal
// Fabio was looking at on 7 Sep 2026 the person who saved was Kylie, and she had
// closed the tab thirty six minutes earlier - so presence had nothing to say and
// the banner said "somebody". A save signs itself instead.
describe('who saved it', () => {
  const sign = (supabase: any, guard: any, value: any, name: string, onMerge?: any) =>
    saveGuarded({ supabase, dealId: 'd1', column: 'fact_find_data', guard, value,
      savedBy: { id: 'u1', name }, tabLabel: 'Fact Find', onMerge })

  it('writes down who did it', async () => {
    const { supabase, state } = fakeDb({ a: 1 })
    await sign(supabase, newGuard({ a: 1 }), { a: 2 }, 'Kylie Searle')
    expect(state.writes[0].last_saved_name).toBe('Kylie Searle')
    expect(state.writes[0].last_saved_tab).toBe('Fact Find')
    expect(state.writes[0].last_saved_by).toBe('u1')
  })

  it('names them in the banner even though they have left the deal', async () => {
    const loaded = { dependants: '0' }
    const { supabase } = fakeDb({ ...loaded })
    // Kylie saves, then goes home. Presence knows nothing about her any more.
    await sign(supabase, newGuard(loaded), { dependants: '2' }, 'Kylie Searle')
    // Fabio, who has had it open since before that, types something else.
    const out = await sign(supabase, newGuard(loaded), { dependants: '3' }, 'Fabio De Castro', () => {})
    expect(out.kind).toBe('overwrote')
    expect((out as any).who).toBe('Kylie Searle')
  })

  // A deal last touched before any of this existed.
  it('says nothing rather than guessing when the record is unsigned', async () => {
    const loaded = { dependants: '0' }
    const { supabase } = fakeDb({ ...loaded })
    await saveGuarded({ supabase, dealId: 'd1', column: 'fact_find_data', guard: newGuard(loaded),
      value: { dependants: '2' } })
    const out = await sign(supabase, newGuard(loaded), { dependants: '3' }, 'Fabio De Castro', () => {})
    expect(out.kind).toBe('overwrote')
    expect((out as any).who).toBe('')
  })

  it('leaves the stamp alone when the form does not know who is typing', async () => {
    const { supabase, state } = fakeDb({ a: 1 })
    await save(supabase, newGuard({ a: 1 }), { a: 2 })
    expect(state.writes[0].last_saved_name).toBeUndefined()
  })
})

// NOTHING IS EVER LOST.
//
// Alexis_Janes_INV_Preapp_2026, 7 Sep 2026: a finished BC was replaced by an
// almost empty one and there was no copy of it anywhere - not in the portal, not
// in a backup taken early enough. Fabio: "I cannot have the basic data be lost
// moving forward." Every save now puts aside what it is replacing.
describe('keeping what a save replaces', () => {
  const full = { dependants: '2', suburb: 'Killara', notes: 'a', a: '1', b: '2', c: '3', d: '4', e: '5' }

  it('keeps a copy the first time a form is saved in a sitting', async () => {
    const { supabase, state } = fakeDb({ ...full })
    const guard = newGuard(full)
    await saveGuarded({ supabase, dealId: 'd1', column: 'fact_find_data', guard,
      value: { ...full, dependants: '3' }, savedBy: { id: 'u1', name: 'Kylie Searle' } })
    expect(state.history).toHaveLength(1)
    expect(state.history[0].data).toEqual(full)
    expect(state.history[0].column_name).toBe('fact_find_data')
    expect(state.history[0].replaced_by_name).toBe('Kylie Searle')
    expect(state.history[0].filled).toBe(8)
  })

  it('does not then keep a copy of every keystroke', async () => {
    const { supabase, state } = fakeDb({ ...full })
    const guard = newGuard(full)
    await save(supabase, guard, { ...full, f: '6' })
    expect(state.history).toHaveLength(1)
    // Everything after that, within a few minutes and only adding, is not kept.
    await save(supabase, guard, { ...full, f: '6', g: '7' })
    await save(supabase, guard, { ...full, f: '6', g: '7', h: '8' })
    expect(state.history).toHaveLength(1)
  })

  // The one that matters: anything being REMOVED is kept, whatever the clock says.
  it('always keeps a copy when something is being taken away', async () => {
    const { supabase, state } = fakeDb({ ...full })
    const guard = newGuard(full)
    await save(supabase, guard, { ...full, f: '6' })
    expect(state.history).toHaveLength(1)
    const { notes, ...withoutNotes } = full
    await save(supabase, guard, { ...withoutNotes, f: '6' })
    expect(state.history).toHaveLength(2)
    expect(state.history[1].data.notes).toBe('a')
  })

  // A save that is refused writes nothing, so there is nothing to put aside.
  it('has nothing to keep when the save is refused for emptying the form', async () => {
    const { supabase, state } = fakeDb({ ...full })
    const guard = newGuard(full)
    const out = await save(supabase, guard, { dependants: '2' })
    expect(out.kind).toBe('error')
    expect(state.value).toEqual(full)
  })
})
