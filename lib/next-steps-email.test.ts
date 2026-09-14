import { describe, it, expect } from 'vitest'
import { buildNextStepsEmailHtml } from './next-steps-email'

// THE ACTUAL BYTES THAT GET EMAILED TO THE CLIENT.
//
// The route builds its email by calling buildNextStepsEmailHtml and nothing else,
// so this is the real email rather than a copy of it. The robot checks the same
// thing through a live preview; this runs even when the robot is skipped.

const LINK = 'https://simplify.wealthdesk.com.au/iv/tk/abc123'
const BUTTON = 'Click here to share your bank statements'

describe('the email the client agrees to proceed on', () => {
  it('puts the WealthDesk link on the button', () => {
    const html = buildNextStepsEmailHtml({ stage: 'BC', clientName: 'Kylie', wealthDeskLink: LINK })
    expect(html).toContain(BUTTON)
    expect(html).toContain(`href="${LINK}"`)
  })

  it('carries all three steps', () => {
    const html = buildNextStepsEmailHtml({ stage: 'BC', clientName: 'Kylie', wealthDeskLink: LINK })
    expect(html).toContain("You'll be invited to our client portal")
    expect(html).toContain('Share your bank statements')
    expect(html).toContain('Your lending options presented')
  })

  it('keeps the statements step even when the link is blank', () => {
    // It used to drop the step, the button and the wording together, turning a
    // three-step email into a two-step one that looked entirely normal.
    for (const link of ['', undefined]) {
      const html = buildNextStepsEmailHtml({ stage: 'BC', clientName: 'Kylie', wealthDeskLink: link })
      expect(html, String(link)).toContain('Share your bank statements')
      expect(html, String(link)).toContain(BUTTON)
    }
  })

  it('never renders an empty value into a client-facing email', () => {
    const html = buildNextStepsEmailHtml({ stage: 'BC', clientName: 'Kylie', wealthDeskLink: LINK })
    expect(html).not.toMatch(/undefined|\$\{/)
  })

  it('greets them by name, and falls back to something a person could send', () => {
    expect(buildNextStepsEmailHtml({ stage: 'BC', clientName: 'Kylie' })).toContain('Great news, Kylie!')
    expect(buildNextStepsEmailHtml({ stage: 'BC', clientName: null })).toContain('Great news, there!')
  })

  it('escapes a name rather than letting it break the email', () => {
    // "Tom & Jerry" as a first name used to put a bare ampersand into the HTML.
    const html = buildNextStepsEmailHtml({ stage: 'BC', clientName: 'Tom & Jerry' })
    expect(html).toContain('Tom &amp; Jerry')
    expect(html).not.toContain('Tom & Jerry')
  })

  it('is built with tables, because Outlook on Windows paints nothing else', () => {
    const html = buildNextStepsEmailHtml({ stage: 'BC', clientName: 'Kylie', wealthDeskLink: LINK })
    expect(html).not.toContain('display:flex')
    expect(html).toContain('bgcolor=')
  })
})

describe('the second email, after they pick a lender', () => {
  const html = buildNextStepsEmailHtml({ stage: 'LO', clientName: 'Kylie', wealthDeskLink: LINK })

  it('is about signing and submission', () => {
    expect(html).toContain('Application prepared')
    expect(html).toContain('Documents to review and sign')
    expect(html).toContain('Lender submission')
    expect(html).toContain('Approval & next steps')
  })

  it('does not carry the statements button', () => {
    expect(html).not.toContain(BUTTON)
    expect(html).not.toContain(LINK)
  })
})
