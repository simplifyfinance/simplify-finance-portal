// WHICH OF THE THREE WORDINGS THIS DEAL GETS.
//
// Every compliance box is written three ways so two files side by side do not
// read like a form letter. The variant is seeded from the deal id, so it never
// moves: one deal regenerated ten times reads the same ten times.
//
// SPLIT OUT OF box-one.ts ON 12 OCT 2026, TO BREAK A CIRCLE.
//
// box-security.ts imported this from box-one.ts. The moment box-one needed
// securitiesOf() from box-security - so box one could name the three houses a
// refinance is secured against, instead of saying "the security recorded on
// this deal" - the two files imported each other.
//
// TypeScript is happy with that and so are the unit tests, because nothing is
// called while the modules are loading. A bundler is not reliably happy with it:
// one of the two ends up half-built, and the symptom is a function that is
// undefined at runtime on one page and fine on another. This codebase has
// already lost an evening to a compliance button that silently wrote nothing.
//
// Eight files use this and none of them need the rest of box-one, so it lives
// on its own and the circle cannot come back.
const txt = (v: any) => String(v ?? '').trim()

export function variantOf(dealId: any): 1 | 2 | 3 {
  const s = txt(dealId)
  if (!s) return 1
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return ((h % 3) + 1) as 1 | 2 | 3
}
