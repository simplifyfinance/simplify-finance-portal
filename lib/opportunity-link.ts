import { signPayload, verifyPayload, siteUrl } from './ready-link'

// The link under "better buying opportunities" in the negative gearing email.
// It carries who it was sent to and who sent it, signed, so the page can greet
// them and the broker knows who read it. Nothing is stored.

export type OpportunityPayload = {
  name: string          // client first name, or "Sarah and Andrew"
  email: string         // comma separated when there are two applicants
  brokerKey: string
  brokerName: string
  sentOn: string        // human date, so the notice can say which email it came from
}

export const signOpportunity = (p: OpportunityPayload) => signPayload(p)
export const verifyOpportunity = (t: string) => verifyPayload<OpportunityPayload>(t)
export const opportunityUrl = (token: string) => `${siteUrl()}/opportunity/${token}`
