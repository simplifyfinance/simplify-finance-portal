// One rule for deciding what a commission line actually is, by the name the
// aggregator writes on it. The register only holds lenders we write
// residential loans with, so an insurance or commercial name being absent
// from it is correct, not a gap — nothing should warn about those.

export type Segment = 'residential' | 'commercial' | 'insurance'

// Names that are not residential lending. Insurance first: a commercial
// insurance product must read as insurance, not as commercial.
const INSURANCE = /allianz|insurance|honey/i
const COMMERCIAL = /commercial|business|asset finance|equipment/i

export function segmentForLender(lenderRaw: unknown): Segment {
  const r = String(lenderRaw ?? '')
  if (INSURANCE.test(r)) return 'insurance'
  if (COMMERCIAL.test(r)) return 'commercial'
  return 'residential'
}

// Only a residential name missing from the register is worth telling anyone
// about. Everything else is out of scope by design.
export function shouldBeInRegister(lenderRaw: unknown): boolean {
  return !!String(lenderRaw ?? '').trim() && segmentForLender(lenderRaw) === 'residential'
}
