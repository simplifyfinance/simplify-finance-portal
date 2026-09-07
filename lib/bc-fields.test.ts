import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Agreed after the blank-data incident: thirteen fields reached the database but
// never the client email, because the BC form kept two hand-written lists of its
// fields and they drifted apart.
//
// buildBcData() is now the one list the payload is built from. The autosave's
// dependency array is still written by hand beside it, and it has to hold the
// same names — a field missing from it does not trigger a save when it changes,
// so the value sits in the form and never reaches the database until something
// else happens to change. That is the same silent failure wearing a new hat.
//
// This reads the source rather than running the form, because the failure is
// invisible at runtime: nothing throws, nothing logs, the field is just late.

const SRC = readFileSync(join(process.cwd(), 'app/(app)/deals/[id]/BCForm.tsx'), 'utf8')

function names(list: string): string[] {
  return list
    .split(',')
    .map(s => s.trim().split(':')[0].trim())
    .filter(Boolean)
    .filter(n => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n))
}

describe('the BC form keeps one list of its fields', () => {
  const payloadMatch = SRC.match(/function buildBcData\(\)\s*\{\s*return \{([^}]+)\}/)
  const depsMatch = [...SRC.matchAll(/\}, \[([^\]]*template[^\]]*)\]\)/g)]
    .map(m => m[1])
    .filter(list => /\bsplits\b/.test(list) && list.split(',').length > 10)

  it('still has both lists where the guard expects them', () => {
    // If either disappears, this test must fail loudly rather than pass by
    // finding nothing and comparing two empty sets.
    expect(payloadMatch, 'buildBcData() was not found in BCForm.tsx').not.toBeNull()
    expect(depsMatch.length, 'the autosave dependency array was not found in BCForm.tsx').toBe(1)
  })

  it('saves every field it sends, and sends every field it saves', () => {
    const payload = names(payloadMatch![1])
    const deps = names(depsMatch[0])
    expect(payload.length).toBeGreaterThan(40)

    const notSaved = payload.filter(f => !deps.includes(f))
    const notSent = deps.filter(f => !payload.includes(f))

    expect(notSaved, `In buildBcData() but missing from the autosave dependencies, so changing ${notSaved.join(', ')} would not trigger a save:\n  ${notSaved.join('\n  ')}`).toEqual([])
    expect(notSent, `Watched by the autosave but not in buildBcData(), so ${notSent.join(', ')} never reaches the database or the client email:\n  ${notSent.join('\n  ')}`).toEqual([])
  })

  // EVERY BOX HAS TO BE PUTTABLE-BACK.
  //
  // When two people are in the BC at once, the save path folds the other
  // person's boxes onto this screen through BC_SETTERS. A field in the saved
  // record with no setter and no place on the derived list would be dropped on
  // the floor by that fold - and then written back over the top from stale
  // state on the very next keystroke. Silent, and the exact shape of the bug
  // that lost a BC on 7 Sep.
  it('can put every saved field back onto the screen', () => {
    const setterMatch = SRC.match(/const BC_SETTERS: Record<string, \(v: any\) => void> = \{([^}]+)\}/)
    const derivedMatch = SRC.match(/const BC_DERIVED = \[([^\]]+)\]/)
    expect(setterMatch, 'BC_SETTERS was not found in BCForm.tsx').not.toBeNull()
    expect(derivedMatch, 'BC_DERIVED was not found in BCForm.tsx').not.toBeNull()

    const settable = names(setterMatch![1])
    const derived = derivedMatch![1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    const payload = names(payloadMatch![1])

    const orphans = payload.filter(f => !settable.includes(f) && !derived.includes(f))
    expect(orphans, `Saved by the BC but with no setter and not listed as derived, so a merge would silently drop ${orphans.join(', ')}:\n  ${orphans.join('\n  ')}`).toEqual([])

    // The other direction: something claimed as derived that is really a box,
    // or a setter for a field that is no longer saved.
    const notDerived = derived.filter(f => !payload.includes(f))
    expect(notDerived, `Listed in BC_DERIVED but not saved at all: ${notDerived.join(', ')}`).toEqual([])
    const bothWays = settable.filter(f => derived.includes(f))
    expect(bothWays, `Both settable and derived, which cannot both be true: ${bothWays.join(', ')}`).toEqual([])
  })

  it('lists each field once', () => {
    const payload = names(payloadMatch![1])
    const dupes = payload.filter((f, i) => payload.indexOf(f) !== i)
    expect(dupes, `Listed twice in buildBcData(): ${dupes.join(', ')}`).toEqual([])
  })
})
