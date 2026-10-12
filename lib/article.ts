// "a" OR "an" — BY HOW THE WORD SOUNDS, NOT HOW IT IS SPELLED.
//
// 12 Oct 2026, found reading a compliance pack back: "They own 7/22 Sample
// Road, Hawks Nest NSW 2324, an unit."
//
// The rule was `starts with a vowel letter -> an`, written out four separate
// times - in box one, box four, box power and box security. A vowel LETTER is
// not a vowel SOUND. "Unit" starts with a vowel and takes "a", because it is
// said "yoo-nit".
//
// IT IS NOT AS SIMPLE AS "U TAKES A". This file already writes "an unsecured
// loan", which is correct - "unsecured" is said "un-", a real vowel sound. So
// the exceptions are listed by the sound they make rather than by their first
// letter, and anything not on a list falls through to the old rule, which is
// right for the overwhelming majority of words.
//
// ONE COPY. Four was three too many: a word fixed in one box stayed wrong in
// the other three.

const txt = (v: unknown) => String(v ?? '').trim()

// Vowel letter, consonant sound - these take "a".
//   unit, union, university, uniform, usual, used, useful, utility,
//   European, euro, one-bedroom
// `uni` stops short of "uninsured" and "uninhabitable", which really do take
// "an"; `one` stops short of "onerous" for the same reason.
const CONSONANT_SOUND = /^(uni(?!n)|use|usu|uti|eu|ewe|one(?=[-\s]|$))/i

// Consonant letter, vowel sound - these take "an".
const VOWEL_SOUND = /^(hour|honest|honou?r|heir)/i

/** "a" or "an", for the word that follows it. */
export function article(word: unknown): 'a' | 'an' {
  const w = txt(word)
  if (VOWEL_SOUND.test(w)) return 'an'
  if (CONSONANT_SOUND.test(w)) return 'a'
  return /^[aeiou]/i.test(w) ? 'an' : 'a'
}

/** The word with its article in front of it. Empty in, empty out. */
export function withArticle(word: unknown): string {
  const w = txt(word)
  return w ? `${article(w)} ${w}` : ''
}
