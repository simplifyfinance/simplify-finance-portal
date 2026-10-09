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
import { buildFinalCheckinEmail, SUBJECT, BOOK_LABEL } from './final-checkin-email'
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
    // 9 Oct 2026, Fabio's words after seeing the three layouts: "One last
    // check-in on your borrowing capacity ius the subject line". Lower case,
    // and in his voice - a person writing, not a system announcing a stage.
    expect(SUBJECT).toBe('One last check-in on your borrowing capacity')
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


// ---------------------------------------------------------------------------
// THE LIFTED PARAGRAPH, AND THE WAY BACK IN.
//
// 9 Oct 2026. Three layouts were mocked and Fabio picked B: the second
// paragraph - the one that lets the client off the hook - lifted into its own
// panel, and the broker's Calendly link as a button under the four.
//
// THE WORDING DID NOT CHANGE AND MUST NOT. These tests exist to let the layout
// be rearranged again without anybody quietly rewriting a sentence while they
// are in there.
describe('the layout he picked', () => {
  const words = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

  it('lifts the second paragraph into its own panel, words untouched', () => {
    const out = buildFinalCheckinEmail({ clientNames: 'Dervla and Rohan', ...sender })
    // The panel is a table with a bgcolor, because Word paints a background
    // from the attribute and throws the CSS away - see lib/email-shell.ts.
    expect(out.html).toContain('bgcolor="#F5FBFE"')
    expect(words(out.html)).toContain('there is absolutely no problem')
  })

  it('puts the broker\'s booking link under the four paragraphs', () => {
    const out = buildFinalCheckinEmail({
      clientNames: 'Dervla', calendlyUrl: 'https://calendly.com/robin', ...sender,
    })
    expect(out.html).toContain('https://calendly.com/robin')
    expect(out.html).toContain(BOOK_LABEL)
    expect(out.plainText).toContain('https://calendly.com/robin')
  })

  it('has no button at all when the broker has no link on file', () => {
    // NEVER A DEAD BUTTON, AND NEVER SOMEBODY ELSE'S CALENDAR. A broker with
    // nothing on their profile sends the email without one rather than being
    // blocked from sending, and rather than borrowing the default.
    const out = buildFinalCheckinEmail({ clientNames: 'Dervla', calendlyUrl: '', ...sender })
    expect(out.html).not.toContain(BOOK_LABEL)
    expect(out.html).not.toContain('calendly')
    expect(words(out.html)).toContain('pick things back up from where we left off')
  })

  it('still carries all four paragraphs with the button on', () => {
    const out = buildFinalCheckinEmail({
      clientNames: 'Dervla', calendlyUrl: 'https://calendly.com/robin', ...sender,
    })
    const w = words(out.html)
    for (const line of [
      'one final check-in regarding the borrowing capacity assessment',
      'things can get busy and plans can change',
      'close off your file for now',
      'Wishing you all the best in the meantime',
    ]) expect(w).toContain(line)
  })
})

// ---------------------------------------------------------------------------
// IT IS SENT ON SOMEBODY'S BEHALF, WHICH THE OTHER THREE ARE NOT.
//
// The other three announce a bank's decision and are signed by the person who
// just read the letter. This one chases a client on behalf of their broker, who
// may not be at the keyboard - so it picks its sender, and the send screen
// draws the same Sending as panel the Templates page uses.
describe('it picks who it is from', () => {
  it('is the only template that does', () => {
    expect(templateById('final_checkin')!.picksSender).toBe(true)
    for (const id of ['preapproval', 'preapproval_extension', 'formal_approval']) {
      expect(templateById(id)!.picksSender).toBe(false)
    }
  })

  it('every template answers the question, so a new one cannot forget', () => {
    for (const t of TEMPLATES) expect(typeof t.picksSender).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// THE SCREEN THAT OPENS IS THE ONE YOU CLICKED.
//
// 9 Oct 2026. Fabio clicked Final check-in, picked a deal, and a screen titled
// "Pre-approval" opened. The title was a hand-written chain of three in
// components/MilestoneEmails.tsx with everything else falling through to
// "Pre-approval" - so a fourth template was never going to be named right.
//
// The names live in TEMPLATES. This is the test that says so.
describe('every template can say its own name', () => {
  // WHERE THE NAMES WENT.
  //
  // lib/nothing-is-lost.page.json used to find "Formal approval" and
  // "Pre-approval extension" written out inside components/MilestoneEmails.tsx,
  // because titleOf spelled them there by hand. They are not lost - they are in
  // TEMPLATES, which is where they always should have been, and the snapshot
  // entry for that file was reduced by exactly those two.
  //
  // THIS IS WHAT REPLACES IT. The snapshot could only see the copy; this sees
  // the original, and it covers all four rather than the two that happened to
  // be spelled out.
  it('every name a person reads on the send screen is here', () => {
    expect(TEMPLATES.map(t => t.name).sort()).toEqual(
      ['Final check-in', 'Formal approval', 'Pre-approval', 'Pre-approval extension'])
  })

  it('no two share one, and none is blank', () => {
    const names = TEMPLATES.map(t => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const n of names) expect(n.trim().length).toBeGreaterThan(0)
  })

  it('the final check-in is not called Pre-approval', () => {
    expect(templateById('final_checkin')!.name).toBe('Final check-in')
  })
})
