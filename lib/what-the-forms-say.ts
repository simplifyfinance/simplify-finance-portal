// EVERY WORD A PERSON READS ON THE FIVE FORMS.
//
// 2 Oct 2026. Fabio, looking at a mock-up of the Fact Find that was missing
// Purpose and goals, twelve personal detail fields and the whole address
// history block: "you are giving me NO CONFIDENCE you are keeping the structure
// and only REARRANGING".
//
// He was right, and the answer is not a better drawing. A drawing of a form
// with 174 fields in it is lossy by nature, and asking somebody to check 174
// fields by eye is asking them to do the job a test should do.
//
// So this reads the forms themselves and lists what they say. lib/nothing-is-
// lost.test.ts holds that list against a locked snapshot and FAILS THE SHIP if
// any of it disappears. Adding is free. Removing has to be done on purpose, in
// a diff, where somebody can see it.
//
// IT IS DELIBERATELY GREEDY AND SLIGHTLY NOISY. A snapshot does not have to be
// a perfect parse of JSX - it has to be stable, and it has to shrink when a
// field goes. Extra entries cost nothing; a missed one costs everything.

import { readFileSync } from 'fs'

// The forms a person types into, plus the one block that is shown on two of
// them. If a new form tab is ever added, it is added here and its words are
// locked the same way.
export const FORM_FILES = [
  'app/(app)/deals/[id]/FactFindForm.tsx',
  'app/(app)/deals/[id]/BCForm.tsx',
  'app/(app)/deals/[id]/LOForm.tsx',
  'app/(app)/deals/[id]/ComplianceForm.tsx',
  'components/StatementAnalysis.tsx',
  'components/DealStructure.tsx',
]

// AND EVERYTHING ROUND THE OUTSIDE OF THE TABS.
//
// 2 Oct 2026, the same afternoon. The five forms were locked, and Fabio then
// spent an hour catching things I had dropped from the page AROUND them - the
// stage bar, the prompt line, the Client emails menu, the Next action box, the
// cards in the rail. A lock on the forms says nothing about any of it.
//
// These are the files that draw the deal page outside the tab body. Same
// treatment, same direction: adding is free, removing has to be done on purpose
// in a diff.
export const PAGE_FILES = [
  'app/(app)/deals/[id]/DealPageClient.tsx',
  'app/(app)/deals/[id]/DealProgress.tsx',
  'app/(app)/deals/[id]/DealSettlement.tsx',
  'app/(app)/deals/[id]/DealSettlementPanel.tsx',
  'app/(app)/deals/[id]/DealCommission.tsx',
  'app/(app)/deals/[id]/CloseDeal.tsx',
  'app/(app)/deals/[id]/BrokerAssignment.tsx',
  'app/(app)/deals/[id]/CreditOfficerAssignment.tsx',
  'components/DealFile.tsx',
  'components/InternalNotesStrip.tsx',
  'components/DocumentsBox.tsx',
  'components/WhoIsDoingTheBc.tsx',
  'components/Outstanding.tsx',
  'components/DealDocuments.tsx',
  'components/MilestoneEmails.tsx',
  'components/AnzAssessmentEmail.tsx',
  'components/OfferAccepted.tsx',
  'components/TabLock.tsx',
  'components/TestDealBand.tsx',
  'components/DealHistory.tsx',
]

// A label, a placeholder, an option in a dropdown, a button, and the headings
// that sit above a group of fields. Between them that is everything on the
// screen that is a word rather than a value.
const PATTERNS: RegExp[] = [
  /<label[^>]*>\s*([^<>{}][^<>]{1,70}?)\s*(?:<|\{)/g,
  /placeholder="([^"]{2,70})"/g,
  /<option[^>]*>\s*([^<>{}][^<>]{1,70}?)\s*</g,
  /<button[^>]*>\s*([A-Z][^<>{}]{2,60}?)\s*</g,
  />\s*([A-Z][A-Za-z][^<>{}]{3,70}?)\s*<\/(?:div|span|p|h[1-6]|legend|a|button|label|b|em|strong|td|th|li)>/g,
  // A LINK IS A BUTTON WITH A DIFFERENT TAG. "Email the assessment team" and
  // "OneDrive" are anchors, and the page-chrome snapshot came back with ZERO
  // words for AnzAssessmentEmail.tsx until this line existed. A file that reads
  // as empty is the extractor being blind, not the file being quiet - which is
  // why "every file says something" is a test below.
  /<a[^>]*>\s*(?:<svg[\s\S]*?<\/svg>)?\s*([A-Z][^<>{}]{2,60}?)\s*</g,
  // And a heading that is only text, with the tag on the line above it.
  /\n\s{2,}([A-Z][A-Za-z][^<>{}\n]{3,60}?)\s*\n\s*<\//g,
  // AND THE ONES WRITTEN AS A CHOICE RATHER THAN AS TEXT.
  //
  // {addr.isCurrent ? 'Current address' : `Previous address #${i}`}
  //
  // Three labels Fabio pointed at by name were invisible to the five patterns
  // above, because they are string literals inside a JSX expression rather than
  // text between two tags. A snapshot that cannot see a label cannot notice it
  // leaving, so this reads quoted strings that look like something a person
  // reads: a capital, a space, and no code in them.
  // The first word may itself carry a hyphen or an apostrophe - "Move-in date"
  // was missed until it did, which is the third time this pattern has been
  // widened by somebody naming a label it could not see.
  // NOTE THE APOSTROPHE IS NOT IN THE FIRST WORD'S CHARACTER SET.
  //
  // It was, and it ate the quote that ended the string: 'Renting' && 'Rent
  // amount' matched as "Renting' &&", which swallowed the opening quote of the
  // real label and hid "Rent amount" completely. A greedy extractor that
  // consumes the thing it was meant to find is worse than one that misses it,
  // because it reports a healthy count while being blind.
  /['"`]([A-Z][A-Za-z0-9\u2019-]+(?: [^'"`\n{}]{1,55})+?)['"`]/g,
]

// What the last pattern must NOT collect: paths, class names, keys, constants
// and anything with code punctuation in it.
const NOT_A_LABEL = /[_/\\<>{}=&]|\.[a-z]|^[A-Z0-9 ]+$|^https?:/

const JUNK = /^[{}()[\]<>/\\|=+*&^%$#@!~`'"\s.,;:-]+$/

export function wordsIn(source: string): string[] {
  const found = new Set<string>()
  for (const re of PATTERNS) {
    for (const m of source.matchAll(re)) {
      const t = m[1].replace(/\s+/g, ' ').trim()
      if (!t || JUNK.test(t)) continue
      // The quoted-string pattern is the greedy one; keep it to things that
      // read like a label rather than like code.
      if (re.source.startsWith("['\"`]") && NOT_A_LABEL.test(t)) continue
      found.add(t)
    }
  }
  return [...found].sort()
}

export type FormWords = Record<string, string[]>

export function readFormWords(files: readonly string[] = FORM_FILES): FormWords {
  const out: FormWords = {}
  for (const f of files) out[f] = wordsIn(readFileSync(f, 'utf8'))
  return out
}

export function countWords(w: FormWords): number {
  return Object.values(w).reduce((n, v) => n + v.length, 0)
}
