// KEEPING SALESTREKKER IN STEP.
//
// Fabio, 17 Sep 2026: "a reminder to the staff when they press the what happens
// next buttons, to ensure SalesTrekker is being updated."
//
// Recording a stage here writes the date, the lender, the total and a snapshot
// of the splits, and sends NOTHING anywhere - no email, no notification. So the
// two systems agree only for as long as somebody remembers to go and say the
// same thing twice. The moment they are thinking about it is the moment they
// press the button, and that is the only moment a reminder is worth putting in
// front of them.
//
// IT NAMES THE STATUS. "Update SalesTrekker" leaves the reader working out what
// that means for this stage; "Mark this deal as Lodged in SalesTrekker" does
// not. One line, no thinking.

// The five stages a person records by hand. Contracts returned and Settlement
// booked are not here: the settlements team records those in their own panel,
// and SalesTrekker does not track them.
const WORDING: Record<string, string> = {
  lodged_at:          'Mark this deal as **Lodged** in SalesTrekker',
  preapproval_at:     'Update the status to **Preapproved** in SalesTrekker',
  offer_accepted_at:  'Record the **accepted offer** and the property in SalesTrekker',
  formal_approval_at: 'Update the status to **Formally approved** in SalesTrekker',
  settled_at:         'Mark the deal **Settled** in SalesTrekker',
}

export function needsSalestrekker(stageKey: string | null | undefined): boolean {
  return Boolean(stageKey && WORDING[String(stageKey)])
}

// The sentence, in three pieces so the screen can bold the status without the
// wording living in a component. Empty when this stage does not need one, which
// is how the caller knows to draw nothing at all.
export function salestrekkerReminder(stageKey: string | null | undefined):
    { before: string; status: string; after: string } | null {
  const line = WORDING[String(stageKey || '')]
  if (!line) return null
  const [before, status, after] = line.split('**')
  return { before, status, after }
}

// What the tick says. One wording, so five dialogs cannot end up saying five
// slightly different things.
export const SALESTREKKER_TICK = 'I have updated SalesTrekker'
export const SALESTREKKER_WHY =
  'Nothing is sent when a stage is recorded here. Without this the two will disagree about where the deal is.'
