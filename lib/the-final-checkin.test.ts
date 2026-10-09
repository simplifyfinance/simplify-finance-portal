// THE FINAL CHECK-IN, FOR A CLIENT WHO HAS GONE QUIET.
//
// 9 Oct 2026, from Fabio's SalesTrekker template "Lead - BC done - final check
// in email". The borrowing capacity went out, nothing came back, and this
// closes the file without closing the door.
//
// IT IS NOT A MILESTONE, AND THAT IS THE WHOLE DESIGN. Fabio: "this is when we
// are chasing clients so dont tie to anyhting like formal apporval settlement
// etc make it always available to generate ensure it is also mulii brand."
//
// Nothing in the record knows whether a client has gone quiet. A person decides
// that, so the portal never withholds the button - and never suggests it either.
import { describe, it, expect } from 'vitest'
import { TEMPLATES, templateById, menuFor, suggestedFor } from './milestone-emails'
import { buildFinalCheckinEmail, SUBJECT } from './final-checkin-email'
import { normaliseBrand, DEFAULT_BRAND } from './brand'

const sender = { senderName: 'Robin Clarke', senderEmail: 'robin@example.com',
                 senderPhone: '0400 000 000', senderWeb: 'example.com' }

describe('it is always available', () => {
  it('is ready on a deal that has reached nothing at all', () => {
    const menu = menuFor({})
    expect(menu.find(i => i.id === 'final_checkin')!.state).toBe('ready')
  })

  it('is ready on a deal that has reached everything', () => {
    const far = { preapproval_at: '2026-09-12T00:00:00Z', formal_approval_at: '2026-12-01T00:00:00Z',
                  lodged_at: '2026-09-01T00:00:00Z' }
    expect(menuFor(far).find(i => i.id === 'final_checkin')!.state).toBe('ready')
  })

  it('says it has gone before, without stopping a second send', () => {
    const twice = { emails_sent: [
      { template: 'final_checkin', at: '2026-09-12T00:00:00Z', by: 'Katie Amos', to: [], cc: [], attached: false },
      { template: 'final_checkin', at: '2026-10-01T00:00:00Z', by: 'Katie Amos', to: [], cc: [], attached: false },
    ] }
    const item = menuFor(twice).find(i => i.id === 'final_checkin')!
    expect(item.state).toBe('sent')
    expect(item.note).toContain('2 times')
  })
})

describe('but it is never the suggestion', () => {
  it('pressing Email on a brand new deal does not offer to close the file', () => {
    // It is always ready, so without the guard in suggestedFor it would be the
    // answer on every deal nothing has happened on yet.
    expect(suggestedFor({})).toBeNull()
  })

  it('and a real milestone still wins when there is one', () => {
    expect(suggestedFor({ preapproval_at: '2026-09-12T00:00:00Z' })).toBe('preapproval')
    expect(suggestedFor({ formal_approval_at: '2026-12-01T00:00:00Z' })).toBe('formal_approval')
  })
})

describe('it promises nothing and attaches nothing', () => {
  it('does not require the bank letter, unlike the other three', () => {
    expect(templateById('final_checkin')!.letterRequired).toBe(false)
    for (const t of TEMPLATES.filter(x => x.id !== 'final_checkin')) {
      expect(t.letterRequired, t.id).toBe(true)
    }
  })

  it('never says please find attached', () => {
    const out = buildFinalCheckinEmail({ clientNames: 'Lucy and James', ...sender })
    expect(out.html.toLowerCase()).not.toContain('attach')
    expect(out.plainText.toLowerCase()).not.toContain('attach')
  })

  it('copies nobody in that the formal approval would', () => {
    expect(templateById('final_checkin')!.copySettlements).toBe(false)
  })
})

describe('the words are his, and the brand is the deal\'s', () => {
  const out = buildFinalCheckinEmail({ clientNames: 'Lucy and James', ...sender })

  it('keeps the subject exactly', () => {
    expect(SUBJECT).toBe('Final Check-In – Borrowing Capacity Review')
    expect(out.subject).toBe(SUBJECT)
  })

  it('keeps the four paragraphs, in his order', () => {
    const t = out.plainText
    const order = ['one final check-in', 'things can get busy', 'close off your file',
                   'Wishing you all the best']
    let at = -1
    for (const phrase of order) {
      const next = t.indexOf(phrase)
      expect(next, `"${phrase}" is missing`).toBeGreaterThan(-1)
      expect(next, `"${phrase}" is out of order`).toBeGreaterThan(at)
      at = next
    }
  })

  it('greets whoever is on the deal, and copes with nobody', () => {
    expect(out.plainText).toContain('Hi Lucy and James,')
    expect(buildFinalCheckinEmail({ clientNames: '', ...sender }).plainText).toContain('Hi there,')
  })

  it('goes out under whichever brand the deal is on', () => {
    const ba = normaliseBrand({ id: 'other', name: 'Another Trading Name',
                                headerColor: '#343333', accentColor: '#2DBEFF' })
    const underBa = buildFinalCheckinEmail({ brand: ba, clientNames: 'Lucy', ...sender })
    expect(underBa.html).toContain('Another Trading Name')
    expect(underBa.plainText).toContain('Another Trading Name')
    // And the default is still the default.
    expect(out.html).toContain(DEFAULT_BRAND.name)
  })
})

describe('the Templates page cannot miss it', () => {
  it('offers exactly what the deal offers', async () => {
    const { readFileSync } = await import('fs')
    const page = readFileSync('app/(app)/templates/TemplatesClient.tsx', 'utf8')
    // The blurb map is typed Record<TemplateId, string>, so a template added to
    // lib/milestone-emails.ts and forgotten here fails the build. It did.
    expect(page).toContain('final_checkin:')
    expect(page).toContain('Record<TemplateId, string>')
  })
})
