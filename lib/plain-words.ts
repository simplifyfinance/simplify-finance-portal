// PUNCTUATION AND CASE ARE NOT MEANING.
//
// "Self-employed" and "self employed" are the same question, and a bot that
// treats them as different is a bot that says "nada" to a question it holds the
// answer to.
//
// SPLIT OUT OF paco.ts ON 12 OCT 2026, TO BREAK A CIRCLE. paco-knowledge.ts
// needed this, paco.ts needs claimsFor() from paco-knowledge, and the two then
// imported each other - the same fault that had been found in the compliance
// boxes earlier the same day, made again within the hour by the person who had
// just written the test for it. See lib/the-files-do-not-import-each-other.test.ts.
export function flat(s: any): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
