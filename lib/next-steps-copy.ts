// THE WORDS IN THE CLIENT'S "WHAT HAPPENS NEXT" EMAIL, AND ITS SUBJECT LINE.
//
// Pure copy - no database, no cookies, no network. Split out of proceed-flow.ts
// on 11 Sep 2026 so a unit test can read a sentence without loading the Supabase
// server client (and through it next/headers). proceed-flow.ts re-exports
// everything here, so every existing import still works.
//
// THE BANK STATEMENTS STEP IS NOT OPTIONAL.
//
// This used to drop the statements step, its button and its wording whenever the
// WealthDesk link in Settings was blank, which quietly turned a three-step email
// into a two-step one with no way for the client to send us anything - and
// nobody would ever know, because a shorter email looks perfectly normal.
//
// Fabio, 11 Sep 2026: "that box needs to be completed at all times, no option for
// sending an email without the link should ever be there - I'd rather a client
// say the link doesn't work."
//
// So the step always renders. A broken link gets reported by the client in
// minutes. A missing step gets reported by nobody. Settings now refuses to save
// the link blank, which is where this is actually prevented.

export type ProceedStage = 'BC' | 'LO'

export type ProceedStep = {
  num: string
  title: string
  desc: string
  accent: boolean
  button: boolean
}

export function buildNextStepsContent(stage: ProceedStage, wealthDeskLink?: string) {
  if (stage === 'BC') {
    const steps: ProceedStep[] = [
      { num: '1', title: "You'll be invited to our client portal", desc: "You'll receive a text and an email with instructions to log in. That's where you'll upload your supporting documents.", accent: false, button: false },
      { num: '2', title: 'Share your bank statements', desc: "You'll also need to provide your bank statements. Click the button below now — it'll take you straight to a secure page to connect your bank and share them. It's bank-level encrypted and never stored.", accent: true, button: true },
      { num: '3', title: 'Your lending options presented', desc: "Once we've received your bank statements and documents through the client portal, we'll present your personalised lending options with rates, comparisons, and our recommendation — within 48 business hours.", accent: false, button: false },
    ]
    return { heading: 'What happens next', steps, showWealthDesk: true }
  }
  const steps: ProceedStep[] = [
    { num: '1', title: 'Application prepared', desc: 'Our credit team will finalise your compliance assessment and prepare your application for submission.', accent: false, button: false },
    { num: '2', title: 'Documents to review and sign', desc: "You'll receive our credit guide, credit proposal, and lender application form via email shortly. Please keep an eye out and sign these when they arrive.", accent: true, button: false },
    { num: '3', title: 'Lender submission', desc: "We'll submit your application to your chosen lender and keep you updated on their response.", accent: false, button: false },
    { num: '4', title: 'Approval & next steps', desc: "Once approved, we'll guide you through the remaining steps to settlement.", accent: false, button: false },
  ]
  return { heading: 'What happens next', steps, showWealthDesk: false }
}

// THE SUBJECT LINE.
//
// It used to be `${deal.deal_name} — what happens next`, which put our internal
// file reference (Kylie_Searle_Purchase_2026) in front of the client as the first
// thing they read, and sent the IDENTICAL subject twice - once when they agree to
// proceed and again, weeks later, when they pick a lender. In a threaded inbox the
// second one looked like the first one resent.
//
// So: no file name, and the two stages read differently. The subject names the job
// the client has to do, which is the thing that gets an email opened.
export function nextStepsSubject(stage: ProceedStage): string {
  return stage === 'BC'
    ? 'Next steps — your client portal and bank statements'
    : 'Next steps — documents to sign and submission'
}
