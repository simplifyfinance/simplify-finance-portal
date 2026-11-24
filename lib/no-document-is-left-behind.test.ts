import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// "A FILE WITH NOTHING POINTING AT IT."
//
// November 2026 audit. Two objects were found sitting in the deal-documents
// bucket with no record anywhere in the database that mentioned them. Both were
// dated October. Both were client fact finds.
//
// A fact find is not test data. There is nothing for a robot to generate one
// from. So those two files were the last remaining trace of two real deals that
// had been deleted - and the only reason anybody ever knew those deals existed
// is that the files outlived the records.
//
// The cause was one line in deleteDeal:
//
//     await browser.storage.from('deal-documents').remove(paths)
//
// Awaited, and its result thrown away. The very next call - deleting the
// document RECORDS - was checked properly and aborted the whole deletion if it
// failed. So the function was careful about the half it could see and blind to
// the half it could not. If the storage call failed, or removed only some of
// the paths it was given, the records went anyway, the deal went, and the person
// who pressed the button was shown nothing at all.
//
// Supabase makes the silent case easy to miss: a partial removal comes back
// with NO error and a shorter list. So the count is checked too, not just the
// error.
//
// This test exists so the check cannot quietly go away again.

const PAGE = readFileSync('app/(app)/deals/page.tsx', 'utf8')

describe('deleting a deal never leaves a document behind', () => {
  it('captures the result of the storage removal instead of discarding it', () => {
    expect(PAGE).not.toContain("await browser.storage.from('deal-documents').remove(paths)")
    expect(PAGE).toContain("const { data: removed, error: rmErr } = await browser.storage")
  })

  it('stops the deletion when the removal errored or was only partial', () => {
    expect(PAGE).toContain('if (rmErr || !removed || removed.length !== paths.length)')
  })

  it('tells the person nothing was changed, rather than failing silently', () => {
    const start = PAGE.indexOf('if (rmErr || !removed')
    expect(start).toBeGreaterThan(-1)
    const block = PAGE.slice(start, start + 600)
    expect(block).toContain('alert(')
    expect(block).toContain('Nothing has been changed')
    expect(block).toContain('return')
  })

  it('still removes the files BEFORE the records, so the records stay findable', () => {
    const removal = PAGE.indexOf(".from('deal-documents').remove(paths)")
    const records = PAGE.indexOf(".delete().eq('deal_id', id)")
    expect(removal).toBeGreaterThan(-1)
    expect(records).toBeGreaterThan(-1)
    expect(removal).toBeLessThan(records)
  })
})
