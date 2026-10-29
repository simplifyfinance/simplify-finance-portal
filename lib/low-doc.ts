// LOW DOC: THE INCOME IS DECLARED, NOT WORKED OUT.
//
// 29 Oct 2026. Two more ways to assess a self-employed client, beside the three
// that read tax returns.
//
// THERE IS NO ARITHMETIC HERE, AND THAT IS THE DESIGN.
//
// Fabio asked first for a BAS calculator, sent three lender spreadsheets, and
// then withdrew it: "the calculator will work out the BAS, but we still need to
// determine the income that we're going to declare... each lender has their own
// risk appetite or how much income you can declare after the BAS is calculated.
// So don't do that."
//
// He is right, and the spreadsheets say so themselves. Every one of them -
// Pepper's, RESIMAC's and the four-quarter one - opens with "What income is
// your client declaring?" and ends in Pass or Refer to BDM. The BAS maths
// produces a CEILING to test a declared figure against; it does not produce the
// figure. Building a calculator here would have put a number on a fact find
// that no lender ever asked for.
//
// So: one field, typed by somebody who has read the evidence. What this file
// holds is the small amount of truth around it - which methods are low doc, and
// what each one lets us say to a client.

/** Exactly as the two options read on the form. */
export const LOW_DOC_BAS = 'Low doc — BAS'
export const LOW_DOC_LETTER = "Low doc — accountant's letter"

export const LOW_DOC_METHODS: string[] = [LOW_DOC_BAS, LOW_DOC_LETTER]

const txt = (v: any) => String(v ?? '').trim()

export function isLowDoc(method: any): boolean {
  return LOW_DOC_METHODS.includes(txt(method))
}

/**
 * WHAT THE CLIENT'S EMAIL IS ALLOWED TO SAY THE FIGURE RESTS ON.
 *
 * 29 Oct 2026. Fabio: "on the BC and LO HTML emails that go to the client, we
 * change the wording. It says income as per BAS, income as per accountant's
 * letter. It doesn't say tax returns."
 *
 * THE FIGURE ITSELF IS STILL NEVER SENT. That rule is older than this file and
 * does not bend for low doc: the sentence names the evidence, never the amount.
 * See incomeBreakdownFor() in lib/income-calculations.ts, which marks every
 * self-employed line as "no figure for the client" and now carries this
 * alongside it.
 *
 * Anything that is not a low doc method gets "tax returns", which is what the
 * three full-doc methods have always said and what an unanswered method says
 * too - naming a document we do not hold would be worse than the general word.
 */
export function evidenceWords(method: any): string {
  const m = txt(method)
  if (m === LOW_DOC_BAS) return 'BAS'
  if (m === LOW_DOC_LETTER) return "accountant's letter"
  return 'tax returns'
}

/** The whole sentence, in one place, so three emails cannot word it three ways. */
export function incomeEvidenceSentence(method: any): string {
  return `Income as per ${evidenceWords(method)} provided`
}

/**
 * HOW COMPLIANCE DESCRIBES THE METHOD.
 *
 * The same shape as the full-doc wording in lib/self-employed-facts.ts - a
 * phrase that finishes "the income has been assessed using ___".
 */
export function lowDocMethodWords(method: any): string {
  const m = txt(method)
  if (m === LOW_DOC_BAS) return 'the income declared by the client, supported by the BAS provided'
  if (m === LOW_DOC_LETTER) return "the income declared by the client, supported by the accountant's letter provided"
  return ''
}
