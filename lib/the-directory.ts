// THE TEAM DIRECTORY, LIVE INSTEAD OF A PDF.
//
// 27 Oct 2026. Catherine, Operations Manager, item 9 of nine: "Live group
// directory - in the portal or Teams, instead of a PDF on the shared drive."
//
// THE PDF IS NOT THE PORTAL'S TEAM PAGE WITH A NEW COAT ON. It covers SIMPLIFY
// GROUP: 35 people, seven businesses, Australia and the Philippines. Most of
// them have no portal login - the accountants, the buyers agents, the
// processing team - so it cannot be built from user_profiles without inventing
// accounts for people who do not need one.
//
//   user_profiles  who can sign in
//   directory      who we are
//
// Everything here is arithmetic over rows, so it is tested without a database.

const txt = (v: any) => String(v ?? '').trim()

export type Person = {
  id: string
  business: string
  name: string
  role: string
  email: string
  phone: string
  /** 'AU' or 'PH' today. Free text, because a third office is a fact. */
  location: string
  sortOrder: number
}

export function personFromRow(r: any): Person {
  return {
    id: txt(r?.id),
    business: txt(r?.business) || 'Simplify Finance',
    name: txt(r?.name),
    role: txt(r?.role),
    email: txt(r?.email),
    phone: txt(r?.phone),
    location: txt(r?.location).toUpperCase(),
    sortOrder: Number(r?.sort_order ?? 100),
  }
}

export function blankPerson(business = 'Simplify Finance'): Person {
  return { id: '', business, name: '', role: '', email: '', phone: '', location: 'AU', sortOrder: 100 }
}

/**
 * ONE SEARCH BOX OVER EVERY COLUMN.
 *
 * Somebody opening this is looking for a person, a job, or "who does
 * settlements". All three are typed into the same box, so all three are
 * matched - name, role, business, email and the number itself.
 *
 * A PHONE NUMBER IS MATCHED WITHOUT ITS SPACES. "0421788220" and
 * "0421 788 220" are the same number, and the one a person pastes out of
 * their phone has no spaces in it.
 */
export function matches(p: Person, find: any): boolean {
  const q = txt(find).toLowerCase()
  if (!q) return true
  const bare = q.replace(/[\s()-]/g, '')
  const hay = [p.name, p.role, p.business, p.email, p.location].join(' ').toLowerCase()
  if (hay.includes(q)) return true
  return !!bare && p.phone.replace(/[\s()-]/g, '').includes(bare)
}

export type Group = { business: string; people: Person[] }

/**
 * GROUPED BY BUSINESS, IN THE ORDER THE PDF HAD THEM.
 *
 * Within a business, sort_order first and then the name. The PDF's order
 * carried meaning - directors at the bottom of their own team - and losing it
 * for alphabetical would be tidier and wrong.
 *
 * A business with nobody left in it after a search disappears rather than
 * sitting there as an empty heading.
 */
export function byBusiness(people: Person[], find?: any): Group[] {
  const hit = (people || []).filter(p => matches(p, find))
  const by = new Map<string, Person[]>()
  for (const p of hit) by.set(p.business, [...(by.get(p.business) || []), p])
  return [...by.entries()]
    .map(([business, list]) => ({
      business,
      people: [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.business.localeCompare(b.business))
}

/** Everybody, once each, for the count at the top. */
export function businessesIn(people: Person[]): string[] {
  return [...new Set((people || []).map(p => p.business).filter(Boolean))].sort()
}

/**
 * A ROW WITH NO NAME IS NOT A PERSON.
 *
 * The PDF this replaces has six of them - one reads "B", one reads "(", four
 * are blank with only a location. They were left out of the seed rather than
 * invented, which is why the directory counts 29 where the PDF claims 35.
 * This is the same rule applied to anything typed in later.
 */
export function isReal(p: Person): boolean {
  return txt(p?.name).length > 1
}
