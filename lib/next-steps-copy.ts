// THE WORDS IN THE CLIENT'S "WHAT HAPPENS NEXT" EMAIL, AND ITS SUBJECT LINE.
//
// Split out of proceed-flow.ts on 11 Sep 2026. These are pure copy - no database,
// no cookies, no network - and proceed-flow.ts imports next/headers through
// supabase-server, which a unit test has no business loading just to read a
// sentence. Nothing in here imports anything.
//
// proceed-flow.ts re-exports both, so every existing import still works.

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
    const steps: ProceedStep[] = wealthDeskLink
      ? [
          { num: '1', title: "You'll be invited to our client portal", desc: "You'll receive a text and an email with instructions to log in. That's where you'll upload your supporting documents.", accent: false, button: false },
          { num: '2', title: 'Share your bank statements', desc: "You'll also need to provide your bank statements. Click the button below now — it'll take you straight to a secure page to connect your bank and share them. It's bank-level encrypted and never stored.", accent: true, button: true },
          { num: '3', title: 'Your lending options presented', desc: "Once we've received your bank statements and documents through the client portal, we'll present your personalised lending options with rates, comparisons, and our recommendation — within 48 business hours.", accent: false, button: false },
        ]
      : [
          { num: '1', title: "You'll be invited to our client portal", desc: "You'll receive a text and an email with instructions to log in. That's where you'll upload your supporting documents.", accent: false, button: false },
          { num: '2', title: 'Your lending options presented', desc: "Once we've reviewed everything, we'll present your personalised lending options with rates, comparisons, and our recommendation — within 48 business hours.", accent: false, button: false },
        ]
    return { heading: 'What happens next', steps, showWealthDesk: !!wealthDeskLink }
  }
  const steps: ProceedStep[] = [
    { num: '1', title: 'Application prepared', desc: 'Our credit team will finalise your compliance assessment and prepare your application for submission.', accent: false, button: false },
    { num: '2', title: 'Documents to review and sign', desc: "You'll receive our credit guide, credit proposal, and lender application form via email shortly. Please keep an eye out and sign these when they arrive.", accent: true, button: false },
    { num: '3', title: 'Lender submission', desc: "We'll submit your application to your chosen lender and keep you updated on their response.", accent: false, button: false },
    { num: '4', title: 'Approval & next steps', desc: "Once approved, we'll guide you through the remaining steps to settlement.", accent: false, button: false },
  ]
  return { heading: 'What happens next', steps, showWealthDesk: false }
}

// THE SUBJECT LINE ON THAT EMAIL.
//
// It used to be `${deal.deal_name} — what happens next`, which put our internal
// file reference (Kylie_Searle_Purchase_2026) in front of the client as the first
// thing they read, and sent the IDENTICAL subject twice - once when they agree to
// proceed and again, weeks later, when they pick a lender. In a threaded inbox the
// second one looked like the first one resent.
//
// So: no file name, and the two stages read differently. The subject names the job
// the client has to do, which is the thing that gets an email opened.
//
// The BC wording follows the steps in buildNextStepsContent: bank statements are
// only mentioned when the WealthDesk link is actually set, because without it there
// is no bank statement step in the email to mention.
export function nextStepsSubject(stage: ProceedStage, wealthDeskLink?: string): string {
  if (stage === 'BC') {
    return wealthDeskLink
      ? 'Next steps — your client portal and bank statements'
      : 'Next steps — your client portal and documents'
  }
  return 'Next steps — documents to sign and submission'
}
