import { describe, it, expect } from 'vitest'
import { newGuard, saveGuarded } from './save-conflict'

// THE 112 CHARACTERS THAT WERE SAVED AND THEN UNSAVED.
//
// 17 Sep 2026. The robot typed a sentence into the Fact Find with the deal open
// in a second window. All 112 characters were on screen, the save line said
// Saved, and the database held 29. Nothing had failed: the sentence WAS written,
// and the other window wrote its own older copy of the record over the top a
// fifth of a second later.
//
// The window that did it was not being careless. Its fields and the other
// window's had been merged a moment earlier, and this file had handed it the
// merged record - but a React form only takes a new value on its next render,
// and a save that fires in that gap is still built on what came before. Every
// check here said that screen was up to date, because the record and what we
// believed the record held agreed. They did. The value about to be written was
// older than both.

function fakeDb(initial: any) {
  const state = { value: initial, writes: [] as any[], version: 0 }
  const supabase = {
    from: (table: string) => table === 'deal_history' ? ({
      insert: async (row: any) => { return { error: null } },
    }) as any : ({
      select: (cols: string) => ({
        eq: () => ({
          single: async () => String(cols).trim() === 'row_version'
            ? { data: { row_version: state.version }, error: null }
            : { data: { fact_find_data: state.value, row_version: state.version, last_saved_name: 'Kylie' }, error: null },
        }),
      }),
      update: (fields: any) => {
        let pinned: number | null = null
        const chain: any = {
          eq: (col: string, val: any) => { if (col === 'row_version') pinned = val; return chain },
          select: async () => {
            if (pinned !== null && pinned !== state.version) return { data: [], error: null }
            state.writes.push(fields.fact_find_data)
            state.value = fields.fact_find_data
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

const SHORT = 'Richard and Letitia want to be '
const LONG = SHORT + 'in the new place before the school year starts, and to keep the offset topped up.'

// What the OTHER window did while this one was typing somewhere else.
const loaded = () => ({ goals2Years: SHORT, goals10Years: 'original', dependants: '2' })

describe('a merged record that the screen has not taken yet', () => {
  it('NEVER writes the pre-merge value over the newer one', async () => {
    const { supabase, state } = fakeDb(loaded())
    const guard = newGuard(loaded())

    // This window typed in a different box. Its copy of the goals box is still
    // the short one it loaded.
    const mine = { ...loaded(), goals10Years: 'typed here' }

    // The other window saved the finished sentence.
    state.value = { ...loaded(), goals2Years: LONG }
    state.version++

    // Our save merges: their sentence, our box. The form is handed the merged
    // record - and does NOT take it, because React has not rendered yet.
    let handedToTheForm: any = null
    const first = await saveGuarded({
      supabase, dealId: 'd1', column: 'fact_find_data', guard, value: mine,
      onMerge: (merged: any) => { handedToTheForm = merged },
    })
    expect(first.kind).toBe('merged')
    expect(handedToTheForm.goals2Years).toBe(LONG)
    expect(state.value.goals2Years).toBe(LONG)

    // THE MOMENT THAT COST 84 CHARACTERS. The debounce fires again with the same
    // stale value, because the screen still holds it.
    const second = await saveGuarded({
      supabase, dealId: 'd1', column: 'fact_find_data', guard, value: mine,
      onMerge: (merged: any) => { handedToTheForm = merged },
    })

    expect(state.value.goals2Years,
      'the older window wrote its stale copy over the finished sentence').toBe(LONG)
    expect(state.value.goals10Years, 'and this window\'s own typing survived').toBe('typed here')
    expect(second.kind).not.toBe('error')
  })

  it('writes normally again once the screen has taken the merge', async () => {
    const { supabase, state } = fakeDb(loaded())
    const guard = newGuard(loaded())
    const mine = { ...loaded(), goals10Years: 'typed here' }
    state.value = { ...loaded(), goals2Years: LONG }
    state.version++

    let onScreen: any = mine
    await saveGuarded({
      supabase, dealId: 'd1', column: 'fact_find_data', guard, value: onScreen,
      onMerge: (merged: any) => { onScreen = merged },
    })
    // The render happened: the form now holds the merged record and types on.
    const after = { ...onScreen, goals10Years: 'typed here and more' }
    await saveGuarded({
      supabase, dealId: 'd1', column: 'fact_find_data', guard, value: after,
      onMerge: (merged: any) => { onScreen = merged },
    })

    expect(state.value.goals2Years).toBe(LONG)
    expect(state.value.goals10Years).toBe('typed here and more')
  })

  it('still takes their version quietly when this screen has typed nothing', async () => {
    const { supabase, state } = fakeDb(loaded())
    const guard = newGuard(loaded())
    state.value = { ...loaded(), goals2Years: LONG }
    state.version++

    let adopted: any = null
    const out = await saveGuarded({
      supabase, dealId: 'd1', column: 'fact_find_data', guard, value: loaded(),
      onAdopt: (stored: any) => { adopted = stored },
    })
    expect(out.kind).toBe('settled')
    expect(adopted.goals2Years).toBe(LONG)
    expect(state.value.goals2Years, 'nothing of ours should have been written').toBe(LONG)
  })

  it('a screen that has taken an adopted record can save again', async () => {
    const { supabase, state } = fakeDb(loaded())
    const guard = newGuard(loaded())
    state.value = { ...loaded(), goals2Years: LONG }
    state.version++

    let onScreen: any = loaded()
    await saveGuarded({
      supabase, dealId: 'd1', column: 'fact_find_data', guard, value: onScreen,
      onAdopt: (stored: any) => { onScreen = stored },
    })
    const typed = { ...onScreen, dependants: '3' }
    await saveGuarded({
      supabase, dealId: 'd1', column: 'fact_find_data', guard, value: typed,
      onAdopt: (stored: any) => { onScreen = stored },
    })
    expect(state.value.goals2Years).toBe(LONG)
    expect(state.value.dependants).toBe('3')
  })
})
