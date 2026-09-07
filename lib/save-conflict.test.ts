import { describe, it, expect } from 'vitest'
import { snapshot, newGuard, emptyGuard, adopt, saveGuarded, conflictMessage } from './save-conflict'

// A deals table with one row, standing in for Postgres. Records every write so
// a test can assert that nothing was written, which is half the point of the
// guard - the failures it exists to stop are writes that should not have
// happened, not errors.
function fakeDb(initial: any, opts: { readError?: any; rlsBlocks?: boolean; landsUnderneath?: number } = {}) {
  const state = { value: initial, writes: [] as any[], reads: 0, version: 0, savedBy: '' }
  // A save that lands in the gap between somebody reading the record and writing
  // it - the one moment the browser cannot see. Counted down so a test can say
  // "this happens once, then stops".
  let sneak = opts.landsUnderneath || 0

  const supabase = {
    from: () => ({
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

  it('refuses when the form cannot fold their fields in', async () => {
    const loaded = { dependants: '0', suburb: '' }
    const { supabase, state } = fakeDb(loaded)
    const kylie = newGuard(loaded)
    const katie = newGuard(loaded)
    await save(supabase, katie, { dependants: '2', suburb: '' })
    // onAdopt but no onMerge - this is BC.
    const out = await save(supabase, kylie, { dependants: '0', suburb: 'Killara' }, () => {})
    expect(out.kind).toBe('conflict')
    expect(state.writes).toHaveLength(1)
    expect(state.value).toEqual({ dependants: '2', suburb: '' })
  })

  it('refuses on the SAME field, and names it', async () => {
    const loaded = { dependants: '0' }
    const { supabase, state } = fakeDb(loaded)
    const kylie = newGuard(loaded)
    await save(supabase, newGuard(loaded), { dependants: '2' })
    const out = await save(supabase, kylie, { dependants: '3' }, () => {}, () => {})
    expect(out.kind).toBe('conflict')
    expect((out as any).fields).toBe('Dependants')
    // Nothing of theirs was touched.
    expect(state.value).toEqual({ dependants: '2' })
  })

  // Refusing has to be recoverable, or it is not a guard, it is a lock.
  it('is over the moment the page is reloaded', async () => {
    const loaded = { dependants: '0', suburb: '' }
    const { supabase } = fakeDb(loaded)
    const kylie = newGuard(loaded)
    await save(supabase, newGuard(loaded), { dependants: '2', suburb: '' })
    expect((await save(supabase, kylie, { dependants: '0', suburb: 'Killara' }, () => {})).kind).toBe('conflict')
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
    expect((await save(supabase, guard, loaded)).kind).toBe('conflict')
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

  // Fabio, 7 Sep 2026: "BC says there's someone there and we don't know who??"
  it('names the person, because the portal knows who it is', () => {
    expect(conflictMessage('BC', '', 'Katie Amos').title)
      .toBe('Katie Amos is editing this BC at the same time as you')
    expect(conflictMessage('BC', '', 'Katie Amos').body).toContain('Katie has saved changes')
  })

  it('names them on a field clash too', () => {
    expect(conflictMessage('Fact Find', 'Dependants', 'Kylie Searle').title)
      .toBe('You and Kylie Searle have both changed Dependants')
  })

  it('reads properly for more than one person', () => {
    expect(conflictMessage('BC', '', 'Katie Amos and Ellie').title)
      .toBe('Katie Amos and Ellie are editing this BC at the same time as you')
  })

  // They saved and then closed the tab. There is nobody to name, and it must not
  // read as "and  have both changed".
  it('falls back gracefully when whoever saved has since left', () => {
    expect(conflictMessage('BC', '', '').title).toBe('Somebody else is editing this BC at the same time as you')
    expect(conflictMessage('BC', 'Deposit', '').title).toBe('You and somebody else have both changed Deposit')
  })
})


// THE CASE THE WHOLE THING EXISTS FOR. Katie fills in the rates while Kylie
// fills in a date of birth. Neither should be told anything is wrong, and
// neither should lose a keystroke.
describe('two people, different fields', () => {
  const loaded = () => ({
    dependants: '0',
    applicants: [{ id: 'a1', firstName: 'Ricardo', dob: '' }],
    lenders: [{ id: 'l1', lenderName: 'UBank', rate: '' }],
  })

  it('keeps both, writes once, and says whose came in', async () => {
    const { supabase, state } = fakeDb(loaded())
    const katie = newGuard(loaded())
    const kylie = newGuard(loaded())

    // Katie: the rate.
    const katieScreen = loaded(); katieScreen.lenders[0].rate = '5.64'
    expect((await save(supabase, katie, katieScreen)).kind).toBe('saved')

    // Kylie, who never saw that rate, types a date of birth.
    let kylieScreen: any = loaded(); kylieScreen.applicants[0].dob = '14/03/1979'
    const out = await save(supabase, kylie, kylieScreen, undefined, (m: any) => { kylieScreen = m })
    expect(out.kind).toBe('merged')
    expect((out as any).fields).toBe('Lender option 1 - Rate')

    // Both are in the record.
    expect(state.value.lenders[0].rate).toBe('5.64')
    expect(state.value.applicants[0].dob).toBe('14/03/1979')
    // And on Kylie's screen, so her next keystroke cannot undo Katie's rate.
    expect(kylieScreen.lenders[0].rate).toBe('5.64')
  })

  it('does not undo their work on the very next keystroke', async () => {
    const { supabase, state } = fakeDb(loaded())
    const katie = newGuard(loaded())
    const kylie = newGuard(loaded())
    const katieScreen = loaded(); katieScreen.lenders[0].rate = '5.64'
    await save(supabase, katie, katieScreen)

    let kylieScreen: any = loaded(); kylieScreen.applicants[0].dob = '14/03/1979'
    await save(supabase, kylie, kylieScreen, undefined, (m: any) => { kylieScreen = m })
    // She keeps typing.
    kylieScreen = { ...kylieScreen, dependants: '2' }
    expect((await save(supabase, kylie, kylieScreen, undefined, (m: any) => { kylieScreen = m })).kind).toBe('saved')
    expect(state.value.lenders[0].rate).toBe('5.64')
    expect(state.value.dependants).toBe('2')
  })

  it('merges a row they added into a list this screen has never seen it in', async () => {
    const { supabase, state } = fakeDb(loaded())
    const katie = newGuard(loaded())
    const kylie = newGuard(loaded())
    const katieScreen: any = loaded()
    katieScreen.applicants.push({ id: 'a2', firstName: 'Joanne', dob: '' })
    await save(supabase, katie, katieScreen)

    let kylieScreen: any = loaded(); kylieScreen.dependants = '2'
    const out = await save(supabase, kylie, kylieScreen, undefined, (m: any) => { kylieScreen = m })
    expect(out.kind).toBe('merged')
    expect(state.value.applicants.map((a: any) => a.firstName)).toEqual(['Ricardo', 'Joanne'])
    expect(state.value.dependants).toBe('2')
  })

  it('refuses when they edit a row this screen has deleted', async () => {
    const { supabase, state } = fakeDb(loaded())
    const katie = newGuard(loaded())
    const kylie = newGuard(loaded())
    const katieScreen: any = loaded(); katieScreen.lenders[0].rate = '5.64'
    await save(supabase, katie, katieScreen)

    const kylieScreen: any = loaded(); kylieScreen.lenders = []
    const out = await save(supabase, kylie, kylieScreen, undefined, () => {})
    expect(out.kind).toBe('conflict')
    expect(state.value.lenders[0].rate).toBe('5.64')
  })
})

// THE GAP THE BROWSER CANNOT SEE.
//
// Everything above decides in the browser: read the record, judge it safe, write
// it. Between those last two steps somebody else's save can land, and by then it
// is too late to notice. deals.row_version makes Postgres refuse the write at
// the instant it happens instead. See docs/deal-row-version.sql.
describe('somebody saves in the gap between reading and writing', () => {
  it('does not overwrite them - it starts again and writes the truth', async () => {
    const loaded = { dependants: '0' }
    const { supabase, state } = fakeDb({ ...loaded }, { landsUnderneath: 1 })
    const guard = newGuard(loaded)
    const out = await saveGuarded({ supabase, dealId: 'd1', column: 'fact_find_data', guard,
      value: { dependants: '2' }, onMerge: () => {}, onAdopt: () => {} })
    // Their change survived, and so did ours.
    expect(state.value.sneakedIn).toBe(true)
    expect(state.value.dependants).toBe('2')
    expect(out.kind === 'saved' || out.kind === 'merged').toBe(true)
  })

  it('pins every write to the version it read', async () => {
    const { supabase, state } = fakeDb({ a: 1 })
    const guard = newGuard({ a: 1 })
    await save(supabase, guard, { a: 2 })
    expect(state.writes[0].row_version).toBe(1)
    await save(supabase, guard, { a: 3 })
    expect(state.writes[1].row_version).toBe(2)
  })

  // A deploy that gets ahead of the migration must not stop anybody saving.
  it('still saves when the version column is not there yet', async () => {
    const state = { value: { a: 1 } as any, writes: [] as any[] }
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: { fact_find_data: state.value }, error: null }) }) }),
        update: (fields: any) => {
          const chain: any = { eq: () => chain, select: async () => {
            state.writes.push(fields); state.value = fields.fact_find_data; return { data: [{ id: 'd1' }], error: null }
          } }
          return chain
        },
      }),
    }
    expect((await save(supabase, newGuard({ a: 1 }), { a: 2 })).kind).toBe('saved')
    expect(state.writes[0].row_version).toBeUndefined()
  })

  it('still reports a write row level security refused, rather than trying forever', async () => {
    const { supabase } = fakeDb({ a: 1 }, { rlsBlocks: true })
    const out = await save(supabase, newGuard({ a: 1 }), { a: 2 })
    expect(out.kind).toBe('error')
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
    expect(out.kind).toBe('conflict')
    expect((out as any).who).toBe('Kylie Searle')
  })

  // A deal last touched before any of this existed.
  it('says nothing rather than guessing when the record is unsigned', async () => {
    const loaded = { dependants: '0' }
    const { supabase } = fakeDb({ ...loaded })
    await saveGuarded({ supabase, dealId: 'd1', column: 'fact_find_data', guard: newGuard(loaded),
      value: { dependants: '2' } })
    const out = await sign(supabase, newGuard(loaded), { dependants: '3' }, 'Fabio De Castro', () => {})
    expect(out.kind).toBe('conflict')
    expect((out as any).who).toBe('')
  })

  it('leaves the stamp alone when the form does not know who is typing', async () => {
    const { supabase, state } = fakeDb({ a: 1 })
    await save(supabase, newGuard({ a: 1 }), { a: 2 })
    expect(state.writes[0].last_saved_name).toBeUndefined()
  })
})
