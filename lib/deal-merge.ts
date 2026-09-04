// TWO PEOPLE, ONE DEAL, DIFFERENT FIELDS.
//
// lib/save-conflict.ts stops one person's autosave wiping out another's. It does
// that by refusing to write, which is safe but blunt: Katie filling in rates and
// Kylie filling in the applicant's date of birth are not in conflict at all, and
// telling either of them to reload and type it again is a portal getting in the
// way of its own users.
//
// So before refusing, work out whether anything is ACTUALLY contested. Three
// copies of the record are compared, not two:
//
//   base    what my screen was last agreed to hold
//   theirs  what the database holds now, after they saved
//   mine    what my screen holds now, after I typed
//
// A field only they touched is taken from them. A field only I touched is taken
// from me. A field neither touched is unchanged. A field BOTH touched, to
// different values, is a real clash - and one clash anywhere makes the whole
// save refuse, exactly as before. Nothing is ever quietly resolved in somebody's
// favour: either everything fits together, or nobody's work is written.
//
// WHY IT REFUSES ON THE WHOLE RECORD RATHER THAN THE GOOD PART. Half-writing a
// merge would leave the record in a state neither person has ever seen, on a
// document that feeds credit assessments. All or nothing is the only version of
// this that can be explained to a compliance officer.

export type MergePath = (string | number)[]

export type MergeResult =
  // Everything fits. `merged` is what should be written, and `fromThem` names
  // the fields that came from the other person so they can be shown on screen.
  | { ok: true; merged: any; fromThem: MergePath[] }
  // The same field, changed by both, to different things.
  | { ok: false; clashes: MergePath[] }

const norm = (v: any) => JSON.stringify(v === undefined ? null : v)
const same = (a: any, b: any) => norm(a) === norm(b)
const isRecord = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Rows the fact find and the LO keep in lists - applicants, jobs, income lines,
// properties, liabilities, splits, lender options - all carry an id. That id is
// what makes "the same row" mean something when two people have both been
// editing the list.
function keyedById(list: any[]): Map<string, any> | null {
  const map = new Map<string, any>()
  for (const item of list) {
    if (!isRecord(item)) return null
    const id = item.id
    if (typeof id !== 'string' && typeof id !== 'number') return null
    const key = String(id)
    if (map.has(key)) return null
    map.set(key, item)
  }
  return map
}

type Walk = { value: any; drop?: boolean }

// WHICH FIELDS, not "something in here somewhere".
//
// When a whole branch is taken from the other person - because this screen never
// touched it - the honest thing to report is not "Lenders" but the leaves that
// actually differ: "Lender option 1 - Rate". A notice naming the field is one
// somebody acts on; a notice naming the section is one they learn to skip.
const REPORT_LIMIT = 20
function collectDiff(b: any, t: any, path: MergePath, out: MergePath[]): void {
  if (out.length >= REPORT_LIMIT) return
  if (same(b, t)) return

  if (isRecord(t) && isRecord(b)) {
    for (const k of new Set([...Object.keys(b), ...Object.keys(t)])) collectDiff(b[k], t[k], [...path, k], out)
    return
  }
  if (Array.isArray(t) && Array.isArray(b)) {
    const bMap = keyedById(b), tMap = keyedById(t)
    if (bMap && tMap) {
      let i = 0
      for (const [id, ti] of tMap) { collectDiff(bMap.get(id), ti, [...path, i], out); i++ }
      // A row they removed. Named by the list, since the row is not there to point at.
      for (const id of bMap.keys()) if (!tMap.has(id)) { out.push(path); break }
      return
    }
  }
  out.push(path)
}

export function merge3(base: any, theirs: any, mine: any): MergeResult {
  const fromThem: MergePath[] = []
  const clashes: MergePath[] = []

  const walk = (b: any, t: any, m: any, path: MergePath): Walk => {
    // They and I agree, whatever we each did to get here.
    if (same(t, m)) return { value: m }
    // Only I changed it.
    if (same(b, t)) return { value: m }
    // Only they changed it.
    if (same(b, m)) { collectDiff(b, t, path, fromThem); return { value: t } }

    // Both of us changed it, to different things. It is only a real clash if we
    // cannot go deeper.
    if (isRecord(t) && isRecord(m)) return walkRecord(isRecord(b) ? b : {}, t, m, path)
    if (Array.isArray(t) && Array.isArray(m)) return walkList(Array.isArray(b) ? b : [], t, m, path)

    clashes.push(path)
    return { value: m }
  }

  const walkRecord = (b: any, t: any, m: any, path: MergePath): Walk => {
    const out: any = {}
    const keys = new Set([...Object.keys(b), ...Object.keys(t), ...Object.keys(m)])
    for (const k of keys) {
      const r = walk(b[k], t[k], m[k], [...path, k])
      // A key one of us deleted stays deleted. It only gets this far when the
      // other person did not touch it - a delete against an edit is a clash and
      // is caught above.
      if (r.value !== undefined) out[k] = r.value
    }
    return { value: out }
  }

  const walkList = (b: any[], t: any[], m: any[], path: MergePath): Walk => {
    const bMap = keyedById(b), tMap = keyedById(t), mMap = keyedById(m)
    // A plain list - checkbox selections, the research criteria, a checklist.
    // There is no such thing as "the same row" here, so both of us having
    // changed it is a clash.
    if (!bMap || !tMap || !mMap) { clashes.push(path); return { value: m } }

    // My order, then any row they added that I have never seen, on the end.
    const order = [...mMap.keys()]
    for (const id of tMap.keys()) if (!mMap.has(id)) order.push(id)

    const out: any[] = []
    for (const id of order) {
      const bi = bMap.get(id), ti = tMap.get(id), mi = mMap.get(id)
      const at: MergePath = [...path, out.length]

      // A row neither of us has any more.
      if (ti === undefined && mi === undefined) continue

      // A row that is new to both of us. Two different rows given the same id is
      // not something this codebase can produce, but if it ever did, refusing is
      // the right answer.
      if (bi === undefined) {
        if (ti !== undefined && mi !== undefined) {
          if (same(ti, mi)) { out.push(mi); continue }
          clashes.push(at); out.push(mi); continue
        }
        if (mi !== undefined) { out.push(mi); continue }
        fromThem.push(at); out.push(ti); continue
      }

      // They deleted the row. Fine, unless I had been editing it.
      if (ti === undefined) {
        if (same(bi, mi)) { fromThem.push(at); continue }
        clashes.push(at); out.push(mi); continue
      }
      // I deleted the row. Fine, unless they had been editing it.
      if (mi === undefined) {
        if (same(bi, ti)) continue
        clashes.push(at); continue
      }

      const r = walk(bi, ti, mi, at)
      if (r.value !== undefined) out.push(r.value)
    }
    return { value: out }
  }

  const top = walk(base, theirs, mine, [])
  if (clashes.length > 0) return { ok: false, clashes }
  return { ok: true, merged: top.value, fromThem }
}
