// WHAT A CLIENT ALREADY TOLD US, ON THE NEXT DEAL.
//
// Fabio, 25 Sep 2026: "the client view has the detail... BUT when start a new
// deal and select existing client test 3 the information saved is not coming
// across fix that as this is the point of all this."
//
// Right. A new deal was built with three empty lists - no properties, no
// liabilities, no assets - whoever it was for. So a client who has been through
// a settlement, whose whole position we hold, was re-typed from scratch. The
// record existed and nothing ever read it.
//
// This reads it. Everything below is pure: it takes the applicants on the new
// deal and what each of their client records holds, and returns the three lists
// the new fact find starts with.
//
// THREE THINGS THAT ARE EASY TO GET WRONG, AND WHY:
//
// 1. A JOINT ITEM IS ON BOTH RECORDS. A house owned by two people was written
//    to both of their client records when the last deal settled. Copying both
//    would put the house on the new deal twice. They are the same item and they
//    carry the same id, because both were taken off the one fact find - so the
//    id is what joins them back up.
//
// 2. OWNERSHIP IS A MAP OF APPLICANT IDS, AND THE NEW DEAL HAS NEW ONES. The
//    old ids mean nothing here. Ownership is rebuilt from who actually holds
//    the item on this deal.
//
// 3. A SHARE NOBODY EVER STATED IS NOT INVENTED. Where the old record knows the
//    percentage it is kept. Where it does not, a single owner is 100% - there is
//    nobody else it could belong to - and two owners are left blank for a person
//    to fill in. Splitting it down the middle would be a figure in no document.

export type SeedApplicant = { id: string; clientId?: string | null }

export type ClientPosition = {
  properties?: any[] | null
  liabilities?: any[] | null
  assets?: any[] | null
}

export type Seeded = { properties: any[]; liabilities: any[]; assets: any[] }

const txt = (v: any) => String(v ?? '').trim()

// Two records of the same thing, joined back up. The id is the real answer -
// both copies came off one fact find. The fallback is for anything written
// before ids were carried, where the words have to do it.
function keyOf(item: any, kind: keyof Seeded): string {
  const id = txt(item?.id)
  if (id) return id
  if (kind === 'properties') return 'p:' + txt(item?.address).toLowerCase()
  if (kind === 'liabilities') {
    return 'l:' + [txt(item?.liabilityType), txt(item?.lenderName), txt(item?.accountNumber)]
      .join('|').toLowerCase()
  }
  return 'a:' + [txt(item?.assetType), txt(item?.description), txt(item?.value)].join('|').toLowerCase()
}

type Held = { share: number | null }

export function seedFromClients(
  applicants: SeedApplicant[],
  positionOf: (clientId: string) => ClientPosition | null | undefined,
  newId: () => string,
): Seeded {
  const out: Seeded = { properties: [], liabilities: [], assets: [] }

  for (const kind of ['properties', 'liabilities', 'assets'] as const) {
    // Insertion order is kept, so the list reads the way it read on the record
    // it came from rather than in some order a Map decided.
    const found = new Map<string, { item: any; holders: Map<string, Held> }>()

    for (const a of applicants) {
      const clientId = txt(a?.clientId)
      if (!clientId) continue
      const position = positionOf(clientId)
      for (const item of (position?.[kind] || [])) {
        if (!item) continue
        const key = keyOf(item, kind)
        const seen = found.get(key)
        const share = numberOrNull(item?.held?.share)
        if (seen) { seen.holders.set(a.id, { share }); continue }
        found.set(key, { item, holders: new Map([[a.id, { share }]]) })
      }
    }

    for (const { item, holders } of found.values()) {
      // `held` is a thing the CLIENT record carries - the share, who it is
      // shared with, whether anybody confirmed it. It describes a client's
      // stake, not the item, and it has no business on a fact find.
      const { held, ownership, id, ...rest } = item as any
      out[kind].push({
        ...rest,
        id: newId(),
        ownership: ownershipFor(kind, holders),
      })
    }
  }

  return out
}

function numberOrNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function ownershipFor(kind: keyof Seeded, holders: Map<string, Held>): Record<string, string> {
  const map: Record<string, string> = {}
  const only = holders.size === 1
  for (const [applicantId, held] of holders) {
    if (kind === 'liabilities') {
      // A liability is a tick, not a percentage - see OwnershipCheckboxes.
      map[applicantId] = 'Yes'
      continue
    }
    if (held.share !== null) { map[applicantId] = String(held.share); continue }
    // Nobody ever stated a share. One owner and there is nothing to state.
    map[applicantId] = only ? '100' : ''
  }
  return map
}

// What to tell somebody BEFORE the deal is made, so nothing arrives as a
// surprise. "1 property, 2 liabilities" - and nothing at all when there is
// nothing, because a line saying "0 properties" is noise.
export function seedSummary(seeded: Seeded): string {
  const bits: string[] = []
  const say = (n: number, one: string, many: string) => { if (n > 0) bits.push(`${n} ${n === 1 ? one : many}`) }
  say(seeded.properties.length, 'property', 'properties')
  say(seeded.liabilities.length, 'liability', 'liabilities')
  say(seeded.assets.length, 'asset', 'assets')
  if (bits.length === 0) return ''
  if (bits.length === 1) return bits[0]
  return bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1]
}
