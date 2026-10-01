// "A", "A and B", "A, B and C".
//
// Lived inside lib/box-one.ts, which eight other files import it from. It is
// needed outside the compliance boxes now - the offset sentence names however
// many splits actually carry one - and box-one imports lib/debt-recycling.ts,
// so reaching back the other way would be a circle. One home, no circle, and
// box-one still exports it so nothing that already imports it has to change.
export function andList(items: string[]): string {
  const xs = items.filter(Boolean)
  if (xs.length === 0) return ''
  if (xs.length === 1) return xs[0]
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}
