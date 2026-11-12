// EVERY APPLICANT ON A REAL DEAL HAS A CLIENT RECORD.
//
// 12 Nov 2026. A settlements person marked a deal settled and the portal said
// "Nothing to record against - no applicant on it is linked to a client
// record, so there is nowhere to write what they own."
//
// 174 deals in the book were like that. Mostly the SECOND applicant on a joint
// deal: the deal's own client_id points at the first one, and before 22
// September nobody created a record for the other.
//
// The backfill cleared them. This stops it coming back.
//
// WHEN. Fabio, 12 Nov 2026: "link everything that is from compliance issued or
// lodged, right? So they're actually true deals. Anything before that, it
// could just be an inquiry."
//
// He is right, and the data proved it: among the unlinked were applicants
// called "Camilla", "Don", "Eva" and one simply called "Husband". Those are
// placeholders on a deal somebody is still working out. Creating client
// records for them would fill the client list with people who do not exist.
//
// So nothing happens until a deal has compliance sent or has lodged. At that
// point the names are real.
//
// AND IT NEVER GUESSES A PERSON. No first name or no last name, and it is left
// alone - a surname cannot be invented and half a name is not a client. Those
// stay for somebody to fix by hand, which is three deals in the whole book.

const txt = (v: any) => String(v ?? '').trim()

export type Applicant = {
  id?: any
  clientId?: any
  firstName?: any
  lastName?: any
  email?: any
  phone?: any
}

/** A deal far enough along that its applicants are real people. */
export function realEnough(deal: any): boolean {
  return !!txt(deal?.compliance_sent_at) || !!txt(deal?.lodged_at)
}

/** Has a name worth creating a record from. */
export function nameable(a: Applicant): boolean {
  return !!txt(a?.firstName) && !!txt(a?.lastName)
}

export type Missing = { index: number; applicant: Applicant }

/**
 * WHICH APPLICANTS NEED A RECORD, or none.
 *
 * Empty for a deal that is not far enough along, for one where everybody is
 * already linked, and for an applicant nobody has finished naming.
 */
export function needRecords(deal: any): Missing[] {
  if (!realEnough(deal)) return []
  const list: Applicant[] = Array.isArray(deal?.fact_find_data?.applicants)
    ? deal.fact_find_data.applicants : []
  return list
    .map((applicant, index) => ({ index, applicant }))
    .filter(({ applicant }) => applicant && !txt(applicant.clientId) && nameable(applicant))
}

/** What to write into the clients table for one of them. */
export function rowFor(a: Applicant): {
  first_name: string; last_name: string; email: string | null; phone: string | null
} {
  return {
    first_name: txt(a.firstName),
    last_name: txt(a.lastName),
    email: txt(a.email) || null,
    phone: txt(a.phone) || null,
  }
}

/**
 * THE APPLICANTS, WITH THE NEW IDS WRITTEN IN.
 *
 * Returns a new list - the caller writes it back as fact_find_data.applicants.
 * Anything not in `made` is returned untouched, so a record that could not be
 * created cannot blank an applicant who was already fine.
 */
export function withIds(deal: any, made: Record<number, string>): Applicant[] {
  const list: Applicant[] = Array.isArray(deal?.fact_find_data?.applicants)
    ? deal.fact_find_data.applicants : []
  return list.map((a, i) => (made[i] ? { ...a, clientId: made[i] } : a))
}

/**
 * THE WHOLE THING, against whatever client the caller hands it.
 *
 * `create` takes one row and gives back its id, or null where it could not.
 * Nothing here throws: a deal reaching compliance must not fail because a
 * client record would not write. It returns what it managed, and the caller
 * decides whether a partial result is worth saving. It always is - a second
 * applicant linked is better than neither.
 */
export async function linkApplicants(
  deal: any,
  create: (row: ReturnType<typeof rowFor>) => Promise<string | null>,
): Promise<{ applicants: Applicant[]; made: number; failed: number } | null> {
  const missing = needRecords(deal)
  if (!missing.length) return null

  const made: Record<number, string> = {}
  let failed = 0
  for (const { index, applicant } of missing) {
    let id: string | null = null
    try {
      id = await create(rowFor(applicant))
    } catch {
      id = null
    }
    if (id) made[index] = id
    else failed += 1
  }

  const count = Object.keys(made).length
  if (!count) return null
  return { applicants: withIds(deal, made), made: count, failed }
}
