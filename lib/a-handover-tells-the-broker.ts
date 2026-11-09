// THE BROKER IS TOLD WHEN THEIR DEAL GOES FOR COMPLIANCE PREP.
//
// 17 Aug 2026. Alan's November brief, item 4: "When a deal moves from Credit to
// the team for compliance prep, the broker and info@ should receive a
// notification. They often want to add information or double-check details
// before compliance is finalised."
//
// That last sentence is the whole reason, so the email says it. A notification
// that only announces a state change leaves the reader working out whether it
// needs them; this one has a window in it that closes.
//
// WHY IT IS A FILE OF ITS OWN. The wording is the thing Fabio will want to
// change, and it should be changeable without opening a route that also holds
// an API key and a database read. Same split as every other email in the
// portal.

const txt = (v: any) => String(v ?? '').trim()

export const STAGE_LABELS: Record<string, string> = {
  BC: 'Borrowing Capacity',
  LO: 'Lending Options',
  COMPLIANCE: 'Compliance prep',
}

export type HandoverFacts = {
  dealName: string
  brokerFirstName: string
  officerName: string
  lender: string
  /** "refinance, owner occupied" - what this deal is, in words. */
  shape: string
  amount: string
  dealUrl: string
}

/** "ANZ · refinance, owner occupied · $960,000 · Ellie Nguyen" - or what there is. */
export function dealLine(f: HandoverFacts): string {
  return [txt(f.lender), txt(f.shape), txt(f.amount), txt(f.officerName)]
    .filter(Boolean).join(' · ')
}

export function handoverSubject(f: HandoverFacts): string {
  return `Compliance prep started: ${txt(f.dealName) || 'a deal'}`
}

export function handoverHtml(f: HandoverFacts): string {
  const hi = txt(f.brokerFirstName)
  const who = txt(f.officerName)
  // WHO FINISHED IT, WHERE WE KNOW. "Ellie has finished" reads as a handover.
  // "The credit team has finished" reads as a system message, and on a deal
  // somebody has been chasing all week that difference is the whole email.
  const opening = who
    ? `${esc(who)} has finished the lending options on <strong>${esc(f.dealName)}</strong> and the deal has moved to compliance prep.`
    : `<strong>${esc(f.dealName)}</strong> has moved to compliance prep.`
  return [
    `<p>Hi ${esc(hi)},</p>`,
    `<p>${opening}</p>`,
    // THE WINDOW, SAID OUT LOUD. Alan: they want to add information or double
    // check before compliance is finalised. So the email says when that stops
    // being possible, rather than leaving it to be found out.
    `<p>If there is anything to add or anything you want checked, now is the moment &mdash; `
      + `once compliance is issued it is a record of what was recommended.</p>`,
    `<p><a href="${esc(f.dealUrl)}" style="display:inline-block;background:#17140F;color:#F7F4EF;`
      + `border-radius:8px;padding:9px 16px;font-weight:600;text-decoration:none">Open the deal</a></p>`,
    // Enough to know which file it is without opening anything, which is what
    // somebody reading it on a phone needs.
    `<p style="font-size:12px;color:#A79F93;margin-top:16px">${esc(dealLine(f))}</p>`,
  ].join('')
}

export function handoverText(f: HandoverFacts): string {
  const who = txt(f.officerName)
  return [
    `Hi ${txt(f.brokerFirstName)},`,
    '',
    who
      ? `${who} has finished the lending options on ${txt(f.dealName)} and the deal has moved to compliance prep.`
      : `${txt(f.dealName)} has moved to compliance prep.`,
    '',
    'If there is anything to add or anything you want checked, now is the moment — '
      + 'once compliance is issued it is a record of what was recommended.',
    '',
    txt(f.dealUrl),
    '',
    dealLine(f),
  ].join('\n')
}

// THE DEAL IN WORDS, from the two fields that replaced deal_type. A deal with
// neither says nothing rather than printing an empty phrase.
export function shapeOf(deal: any): string {
  const kind = txt(deal?.transaction_type).replace(/_/g, ' ')
  const use = txt(deal?.property_use).replace(/_/g, ' ')
  return [kind, use].filter(Boolean).join(', ')
}

function esc(v: any): string {
  return txt(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
