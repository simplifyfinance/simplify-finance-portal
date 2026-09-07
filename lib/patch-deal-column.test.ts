import { describe, it, expect } from 'vitest'
import { patchDealColumn } from './patch-deal-column'

function fakeDb(stored: any, opts: { readError?: any; rlsBlocks?: boolean; writeError?: any } = {}) {
  const state = { value: stored, writes: [] as any[] }
  const supabase = {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () =>
        opts.readError ? { data: null, error: opts.readError }
                       : { data: { compliance_data: state.value }, error: null } }) }),
      update: (patch: any) => ({ eq: () => ({ select: async () => {
        if (opts.writeError) return { data: null, error: opts.writeError }
        if (opts.rlsBlocks) return { data: [], error: null }
        state.writes.push(patch)
        state.value = patch.compliance_data
        return { data: [{ id: 'd1' }], error: null }
      } }) }),
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
