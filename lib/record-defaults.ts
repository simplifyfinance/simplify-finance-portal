// A SAVED RECORD IS TRUSTED FOR WHAT IT HOLDS, NEVER FOR WHAT IT IS MISSING.
//
// 10 Sep 2026. Melissa could not open the compliance tab on Wesley Perrott at all:
// "This page couldn't load", every other tab fine. The console said
//
//     Uncaught TypeError: Cannot read properties of undefined (reading '0')
//
// which was `d.applicants[activeApplicant]` on the first render.
//
// His compliance_data was a real, non-empty object - the deal structure block
// writes the security address and the split detail into that same column - but
// it had never held applicants, risks, productReqs or expenses, because nobody
// had opened that tab on him. Every form loaded its record the same way:
//
//     if (stored && Object.keys(stored).length > 0) return stored
//
// which trusts a record written by a different screen to have every section this
// screen renders. It does not. So the page died before the effect that fills the
// applicants in ever got to run.
//
// This is the shape of that failure, in one place, with tests. A section that is
// absent - or null, or an array where an object belongs, or an object where an
// array belongs - falls back to the blank. Everything actually saved is kept.
//
// Fabio, 10 Sep 2026: "I cannot have this happen again."

const isObj = (x: any) => x !== null && typeof x === 'object' && !Array.isArray(x)
const isArr = (x: any) => Array.isArray(x)

// The sections a screen cannot render without, and the shape each must be.
export type Shapes = Record<string, 'object' | 'array' | 'arrayNotEmpty'>

export function rightShape(value: any, want: 'object' | 'array' | 'arrayNotEmpty'): boolean {
  if (want === 'object') return isObj(value)
  if (want === 'array') return isArr(value)
  return isArr(value) && value.length > 0
}

// `blank` is what this screen would build for a brand new deal. `stored` is
// whatever is in the database, which may have been written by another screen
// entirely. The result always has every key the blank has.
export function withDefaults<T extends Record<string, any>>(
  stored: any, blank: T, shapes: Shapes = {},
): T {
  if (!isObj(stored) || Object.keys(stored).length === 0) return blank

  const out: any = { ...blank, ...stored }

  // A key the blank has and the record does not - or has as null - comes from
  // the blank. `{...blank, ...stored}` alone does not do this: an explicit null
  // in the record wins over the default, and null is exactly what breaks a page.
  for (const key of Object.keys(blank)) {
    if (out[key] === undefined || out[key] === null) out[key] = (blank as any)[key]
  }

  // And the sections named as load-bearing are checked for shape, not just
  // presence. An array where an object belongs is not a section, it is a crash.
  for (const [key, want] of Object.entries(shapes)) {
    if (!rightShape(out[key], want)) out[key] = (blank as any)[key]
  }
  return out as T
}
