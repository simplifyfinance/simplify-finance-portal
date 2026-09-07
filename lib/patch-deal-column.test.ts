import { describe, it, expect } from 'vitest'
import { patchDealColumn } from './patch-deal-column'

function fakeDb(stored: any, opts: { readError?: any; rlsBlocks?: boolean; writeError?: any; landsUnderneath?: number } = {}) {
  const state = { value: stored, writes: [] as any[], version: 0, tries: 0 }
  let sneak = opts.landsUnderneath || 0

  const supabase = {
    from: () => ({
      select: (cols: string) => ({ eq: () => ({ single: async () => {
        if (opts.readError) return { data: null, error: opts.readError }
        if (String(cols).trim() === 'row_version') return { data: { row_version: state.version }, error: null }
        state.tries++
        return { data: { compliance_data: state.value, row_version: state.version }, error: null }
      } }) }),
      update: (fields: any) => {
        let pinned: number | null = null
        const chain: any = {
          eq: (col: string, val: any) => { if (col === 'row_version') pinned = val; return chain },
          select: async () => {
            if (opts.writeError) return { data: null, error: opts.writeError }
            if (opts.rlsBlocks) return { data: [], error: null }
            // Their save lands HERE - after ours read the record, before ours
            // writes it. The one moment the browser cannot see.
            if (sneak > 0) { sneak--; state.version++; state.value = { ...(state.value || {}), sneakedIn: true } }
            if (pinned !== null && pinned !== state.version) return { data: [], error: null }
            state.writes.push(fields)
            state.value = fields.compliance_data
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

const tick = (supabase: any, fallback: any) =>
  patchDealColumn(supabase, 'd1', 'compliance_data', cur => ({ ...cur, preApproval: true }), fallback)

describe('changing one field inside a whole-column record', () => {
  // The bug this exists to stop. The page was rendered before the notes were
  // typed, so the copy it is holding does not have them.
  it('does not write back over work done since the page was rendered', async () => {
    const stale = { securityAddress: 'NSW' }
    const { supabase, state } = fakeDb({ securityAddress: 'NSW', analysisComment: 'typed after the page loaded' })
    const { problem } = await tick(supabase, stale)
    expect(problem).toBeNull()
    expect(state.value.analysisComment).toBe('typed after the page loaded')
    expect(state.value.preApproval).toBe(true)
  })

  it('applies the change to what the database holds, not to what it was handed', async () => {
    const { supabase, state } = fakeDb({ a: 'fresh' })
    await patchDealColumn(supabase, 'd1', 'compliance_data', cur => ({ ...cur, b: 2 }), { a: 'stale' })
    expect(state.value).toEqual({ a: 'fresh', b: 2 })
  })

  // A tick that refuses because the network blinked is worse than the problem.
  it('falls back to what is on screen when the record cannot be read', async () => {
    const { supabase, state } = fakeDb(null, { readError: { message: 'network' } })
    const { problem } = await tick(supabase, { securityAddress: 'NSW' })
    expect(problem).toBeNull()
    expect(state.value).toEqual({ securityAddress: 'NSW', preApproval: true })
  })

  it('copes with a record that has never been written', async () => {
    const { supabase, state } = fakeDb(null)
    await tick(supabase, null)
    expect(state.value).toEqual({ preApproval: true })
  })

  it('reports a write the database refused - zero rows and no error', async () => {
    const { supabase } = fakeDb({ a: 1 }, { rlsBlocks: true })
    const { problem } = await tick(supabase, { a: 1 })
    expect(problem).toContain('refused it')
  })

  it('reports a write that errored', async () => {
    const { supabase } = fakeDb({ a: 1 }, { writeError: { message: 'boom' } })
    const { problem } = await tick(supabase, { a: 1 })
    expect(problem).toContain('boom')
  })
})

describe('somebody saves in the gap between reading and writing', () => {
  it('starts again rather than overwriting them', async () => {
    const { supabase, state } = fakeDb({ securityAddress: 'NSW' }, { landsUnderneath: 1 })
    const { problem } = await tick(supabase, { securityAddress: 'NSW' })
    expect(problem).toBeNull()
    expect(state.value.sneakedIn).toBe(true)
    expect(state.value.preApproval).toBe(true)
    expect(state.tries).toBe(2)
  })

  it('pins the write to the version it read', async () => {
    const { supabase, state } = fakeDb({ a: 1 })
    await tick(supabase, { a: 1 })
    expect(state.writes[0].row_version).toBe(1)
  })

  it('gives up rather than trying forever', async () => {
    const { supabase } = fakeDb({ a: 1 }, { landsUnderneath: 99 })
    const { problem } = await tick(supabase, { a: 1 })
    expect(problem).toContain('somebody else is saving this deal')
  })

  // A deploy ahead of the migration must not stop a tick saving.
  it('still saves when the version column is not there yet', async () => {
    const state = { value: { a: 1 } as any, writes: [] as any[] }
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: { compliance_data: state.value }, error: null }) }) }),
        update: (fields: any) => {
          const chain: any = { eq: () => chain, select: async () => {
            state.writes.push(fields); state.value = fields.compliance_data; return { data: [{ id: 'd1' }], error: null }
          } }
          return chain
        },
      }),
    }
    const { problem } = await tick(supabase, { a: 1 })
    expect(problem).toBeNull()
    expect(state.writes[0].row_version).toBeUndefined()
  })
})
