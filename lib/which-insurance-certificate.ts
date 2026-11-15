// WHICH CERTIFICATE THIS PROPERTY NEEDS.
//
// Belle, 14 Nov 2026: "lenders will generally only require either building
// insurance or strata, depending on the property type."
//
// So it is one row on the screen, not two, and the portal already knows which
// one because the property subtype is on the fact find. The rule itself is not
// new - lib/document-rules.ts has asked for insurance on the right properties
// since September, and that is where this list comes from. It was lifted out
// into its own file the day settlements needed the same answer, rather than
// written a second time, because two copies of a rule about what we do not ask
// a client for is how a client gets asked for it.
//
// Fabio, 3 Sep 2026: "we only need the insurance for a single dwelling, or
// properties like houses that are not strata title."

const txt = (v: any) => String(v ?? '').trim()

/** The body corporate insures the building, so we ask for its certificate. */
export const STRATA_SUBTYPES = ['Unit', 'Townhouse']

/** Nothing built yet. Fabio: "nothing at all, ever". */
export const NO_BUILDING = 'Land'

export type Certificate =
  /** A certificate of currency in the client's own name. */
  | 'building'
  /** The body corporate's certificate, usually via the strata manager. */
  | 'strata'
  /** There is no building to insure. */
  | 'none'
  /** Nobody has recorded the property type. */
  | 'unknown'

export const CERTIFICATE_LABEL: Record<Certificate, string> = {
  building: 'Building insurance',
  strata: 'Strata certificate of currency',
  none: 'No insurance needed',
  unknown: 'Insurance — certificate of currency',
}

/**
 * WHICH ONE, FROM THE PROPERTY SUBTYPE.
 *
 * Written as a list of exemptions and not a list of what qualifies, for the
 * reason document-rules.ts already gives: a property type added to the pick
 * list next year asks for building insurance until somebody decides it should
 * not, which is the safe direction to be wrong in.
 */
export function certificateFor(subtype: any): Certificate {
  const s = txt(subtype)
  if (!s) return 'unknown'
  if (STRATA_SUBTYPES.includes(s)) return 'strata'
  if (s === NO_BUILDING) return 'none'
  return 'building'
}

/** Said in words, so a screen can explain itself. */
export function certificateWhy(subtype: any): string {
  const s = txt(subtype)
  const c = certificateFor(s)
  if (c === 'strata') return `The security is a ${s.toLowerCase()}, so the body corporate insures the building`
  if (c === 'none') return 'The security is land, so there is no building to insure'
  if (c === 'unknown') return 'Nobody has recorded the property type, so a certificate is asked for to be safe'
  return `The security is a ${s.toLowerCase()}, not strata`
}
