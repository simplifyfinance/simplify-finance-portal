// PACO ANSWERS OUT OF THE LENDER'S OWN SECTION.
//
// 14 Oct 2026. Until now he answered from a table of pre-chopped rules, carved
// out of a document by one model call at the moment it was dropped. Fabio, on
// the whole point of the library: "are you now saving these as one big library
// where it will just search answers to questions? this is the whole premise."
//
// It is. The document is stored whole, split into the sections the lender
// already wrote, and searched when somebody asks - so an answer is a real
// section of a real document, with its heading and its tables intact, not four
// fragments that were separated from each other weeks earlier.
//
// ---------------------------------------------------------------------------
// THE RULE THIS FILE EXISTS TO ENFORCE
// ---------------------------------------------------------------------------
//
// The search asks for ALL the words first. If that finds nothing it asks again
// for ANY of them, and says so by returning `loosened`.
//
// That second pass is why "can a casual worker borrow" finds the Borrowers
// section instead of returning nothing on a document that covers casual income
// perfectly well. It is also dangerous, and the danger was measured rather
// than imagined: asked "crypto currency as a deposit" - a word that appears
// NOWHERE in Macquarie's guidelines - the loose pass matches "deposit" and
// hands back Contributions and Genuine Savings, which is about something else
// entirely.
//
// Both implementation briefs name declining to answer as the single
// highest-value behaviour to get right. So:
//
//   A LOOSENED RESULT IS NEVER PRESENTED AS AN ANSWER.
//
// Paco says nothing in that lender's policy matches the question, and offers
// the closest sections as somewhere to look. The distinction is the whole
// difference between a research tool and a confident liar.

export type FoundSection = {
  sectionId: string
  documentId: string
  /** "10.2.1", "1A", or empty where the lender did not number their sections. */
  number: string
  title: string
  /** "10.2 PAYG Income > 10.2.1 Allowances" where a document nests. */
  path: string
  /** "2 of 3" when one oversized section had to be cut. Else empty. */
  part: string
  body: string
  tier: string
  score: number
}

export type SectionAnswer = {
  /** What Paco quotes. Empty when he is declining. */
  sections: FoundSection[]
  /** The same sections, offered as somewhere to look rather than as an answer. */
  closest: FoundSection[]
  /**
   * 'answer'   every word matched; these sections are the answer
   * 'closest'  nothing matched all the words; these are near, and said to be
   * 'nothing'  the words are not in this lender's documents at all
   */
  kind: 'answer' | 'closest' | 'nothing'
  /** The line Paco leads with. Never empty. */
  says: string
}

const txt = (v: any): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())

/** One row as the database hands it back. */
export function cleanSection(r: any): FoundSection | null {
  const body = txt(r?.body)
  const title = txt(r?.title)
  // A SECTION WITHOUT WORDS OR A NAME CANNOT BE QUOTED, and an unquotable
  // answer is one we will not put in front of a credit assessor.
  if (!body || !title) return null
  return {
    sectionId: txt(r?.section_id ?? r?.sectionId),
    documentId: txt(r?.document_id ?? r?.documentId),
    number: txt(r?.number), title, path: txt(r?.path), part: txt(r?.part),
    body, tier: txt(r?.tier) || 'A',
    score: Number(r?.score) || 0,
  }
}

/**
 * How Paco should present what the search found.
 *
 * Takes rows and gives rows. It does not search, it does not fetch and it
 * never writes the answer itself - the words below are the FRAME around a
 * quote, never a summary of one, because the moment Paco paraphrases a policy
 * he is a worse version of reading the document.
 */
export function sectionAnswer(
  rows: any[],
  loosened: boolean,
  lender: string,
): SectionAnswer {
  const found = (Array.isArray(rows) ? rows : []).map(cleanSection).filter(Boolean) as FoundSection[]
  const whose = lender ? `${lender}'s` : 'that lender’s'

  if (found.length === 0) {
    return {
      sections: [], closest: [], kind: 'nothing',
      says: `Nothing in ${whose} policy mentions that. Check with the lender or your BDM — and tell me what they say.`,
    }
  }

  if (loosened) {
    // THE CRYPTO CASE. Measured 14 Oct 2026 against the real document: the
    // word appears zero times, the loose pass matches "deposit", and the
    // section that comes back is about genuine savings. Presenting that as an
    // answer would be the most convincing kind of wrong.
    return {
      sections: [], closest: found, kind: 'closest',
      says: `Nothing in ${whose} policy matches all of that. The closest I have is below — it may not be about your question.`,
    }
  }

  return {
    sections: found, closest: [], kind: 'answer',
    says: `From ${whose} own policy:`,
  }
}

/** How a quote from a section is addressed, in a broker's words. */
export function citeSection(s: FoundSection, lender: string, document: string): string {
  const where = s.number ? `${s.number} ${s.title}` : s.title
  const part = s.part ? ` (part ${s.part})` : ''
  return [lender, document, `${where}${part}`].filter(Boolean).join(' — ')
}

// WHAT PACO IS NOT ALLOWED TO DO WITH A SECTION.
//
// Kept as words so lib/paco-reads-the-section.test.ts can hold the file to
// them, and so the next person to open this knows which of these were
// decisions rather than accidents.
export const THE_RULES = [
  'a loosened result is never presented as an answer',
  'a section is quoted, never summarised',
  'nothing found is a real answer and is said plainly',
  'the section is named so anybody can open the document and read it',
] as const
