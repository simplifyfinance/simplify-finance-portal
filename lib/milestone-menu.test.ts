// WHICH EMAIL A DEAL CAN SEND, AND WHEN.
//
// Fabio, 30 Sep 2026: "we dont have a condtional apporval tempalkte we have a
// pre-approval and a pre-approval extnesion confirmaiton".
//
// NAMED FOR THE MENU, not for the emails. lib/milestone-emails.test.ts next
// door tests what the three emails SAY. I wrote this file over the top of that
// one by reusing its name, and the only thing that caught it was the suite
// count going DOWN rather than up - 2920 to 2909. Worth remembering: a new test
// file that does not raise the total has replaced something.

import { describe, it, expect } from 'vitest'
import {
  TEMPLATES, templateById, emailsSent, lastSent, timesSent, withSent,
  menuFor, suggestedFor, type SentEmail,
} from './milestone-emails'

const sent = (template: any, at: string, by = 'Katie Amos'): SentEmail => ({
  template, at, by, to: ['alexis@example.com'], cc: [], attached: true,
})

describe('the catalogue', () => {
  it('is three, not four - there is no conditional approval template', () => {
    expect(TEMPLATES.map(t => t.id))
      .toEqual(['preapproval', 'preapproval_extension', 'formal_approval'])
    expect(templateById('conditional_approval')).toBeNull()
  })

  it('every one needs the bank letter', () => {
    // "letter is compulsory" - each of them says "please find attached".
    for (const t of TEMPLATES) expect(t.letterRequired).toBe(true)
  })

  it('only the formal approval copies settlements', () => {
    // There is no settlement to run on a pre-approval, and a house hunt can take
    // months - copying them would fill an inbox with deals nobody can act on.
    expect(TEMPLATES.filter(t => t.copySettlements).map(t => t.id)).toEqual(['formal_approval'])
  })
})

describe('what has already gone out', () => {
  const deal = { emails_sent: [
    sent('preapproval', '2026-09-12T00:00:00Z'),
    sent('preapproval_extension', '2026-12-01T00:00:00Z', 'Fabio de Castro'),
  ] }

  it('reads them back', () => {
    expect(emailsSent(deal)).toHaveLength(2)
    expect(lastSent(deal, 'preapproval')!.by).toBe('Katie Amos')
  })

  it('takes the latest of a kind, not the first', () => {
    // A template can go twice: a client loses the email, an applicant is added.
    const twice = { emails_sent: [
      sent('preapproval', '2026-09-12T00:00:00Z', 'Katie Amos'),
      sent('preapproval', '2026-09-20T00:00:00Z', 'Ellie Watts'),
    ] }
    expect(lastSent(twice, 'preapproval')!.by).toBe('Ellie Watts')
    expect(timesSent(twice, 'preapproval')).toBe(2)
  })

  it('adds one without disturbing the rest', () => {
    const next = withSent(deal, sent('formal_approval', '2026-12-10T00:00:00Z'))
    expect(next).toHaveLength(3)
    expect(next.slice(0, 2)).toEqual(emailsSent(deal))
  })

  it('drops a template that no longer exists rather than listing it', () => {
    expect(emailsSent({ emails_sent: [sent('conditional_approval', '2026-09-01T00:00:00Z')] }))
      .toEqual([])
  })

  it('survives rubbish in the column', () => {
    expect(emailsSent({ emails_sent: 'nope' })).toEqual([])
    expect(emailsSent({ emails_sent: [null, {}] })).toEqual([])
    expect(lastSent({}, 'preapproval')).toBeNull()
  })
})

describe('what is ready on a deal', () => {
  it('nothing on a deal that has reached no milestone', () => {
    const menu = menuFor({})
    expect(menu.every(i => i.state === 'not_yet')).toBe(true)
    expect(suggestedFor({})).toBeNull()
    // Listed rather than hidden - a missing button is a question, a greyed one
    // is an answer.
    expect(menu).toHaveLength(3)
    for (const i of menu) expect(i.note).not.toBe('')
  })

  it('the pre-approval, once there is one', () => {
    const deal = { preapproval_at: '2026-09-12T00:00:00Z' }
    expect(suggestedFor(deal)).toBe('preapproval')
    expect(menuFor(deal).find(i => i.id === 'preapproval')!.note).toContain('pre-approved 12 Sep')
  })

  it('the formal approval, once there is one', () => {
    const deal = { preapproval_at: '2026-09-12T00:00:00Z', formal_approval_at: '2026-12-01T00:00:00Z' }
    expect(suggestedFor(deal)).toBe('formal_approval')
  })

  it('says when one has already gone, and who sent it', () => {
    const deal = { preapproval_at: '2026-09-12T00:00:00Z',
                   emails_sent: [sent('preapproval', '2026-09-12T00:00:00Z')] }
    const item = menuFor(deal).find(i => i.id === 'preapproval')!
    expect(item.state).toBe('sent')
    expect(item.note).toBe('sent 12 Sep by Katie Amos')
  })
})

describe('the extension has a rule of its own', () => {
  // There is nothing to extend until the client has actually been told about
  // the pre-approval.
  const preapproved = { preapproval_at: '2026-09-12T00:00:00Z' }

  it('is out of reach until the pre-approval email has gone', () => {
    const item = menuFor(preapproved).find(i => i.id === 'preapproval_extension')!
    expect(item.state).toBe('not_yet')
    expect(item.note).toBe('the pre-approval email has not gone yet')
  })

  it('becomes ready once it has', () => {
    const deal = { ...preapproved, emails_sent: [sent('preapproval', '2026-09-12T00:00:00Z')] }
    expect(menuFor(deal).find(i => i.id === 'preapproval_extension')!.state).toBe('ready')
  })

  it('counts them, which is what the $800 line turns on', () => {
    // Fabio's own wording: a fee applies beyond the SECOND pre-approval.
    const deal = { ...preapproved, emails_sent: [
      sent('preapproval', '2026-09-12T00:00:00Z'),
      sent('preapproval_extension', '2026-12-01T00:00:00Z'),
      sent('preapproval_extension', '2027-03-01T00:00:00Z'),
    ] }
    expect(timesSent(deal, 'preapproval_extension')).toBe(2)
    expect(menuFor(deal).find(i => i.id === 'preapproval_extension')!.note).toContain('2 extensions')
  })
})

describe('the menu reads in a useful order', () => {
  it('what is ready leads, what has gone follows, what is not yet is last', () => {
    const deal = {
      preapproval_at: '2026-09-12T00:00:00Z',
      formal_approval_at: '2026-12-01T00:00:00Z',
      emails_sent: [sent('preapproval', '2026-09-12T00:00:00Z')],
    }
    expect(menuFor(deal).map(i => [i.id, i.state])).toEqual([
      ['formal_approval', 'ready'],
      ['preapproval_extension', 'ready'],
      ['preapproval', 'sent'],
    ])
  })

  it('leads with the milestone just reached, not the earliest unsent one', () => {
    // The first version sorted by the order a deal LIVES these, so a formally
    // approved deal offered the pre-approval email first. The one somebody
    // wants is the milestone they have just hit.
    const deal = { preapproval_at: '2026-09-12T00:00:00Z', formal_approval_at: '2026-12-01T00:00:00Z' }
    expect(menuFor(deal)[0].id).toBe('formal_approval')
    expect(suggestedFor(deal)).toBe('formal_approval')
  })

  it('but reads history in the order it happened', () => {
    const deal = { preapproval_at: '2026-09-12T00:00:00Z', formal_approval_at: '2026-12-01T00:00:00Z',
                   emails_sent: [sent('formal_approval', '2026-12-01T00:00:00Z'),
                                 sent('preapproval', '2026-09-12T00:00:00Z')] }
    expect(menuFor(deal).filter(i => i.state === 'sent').map(i => i.id))
      .toEqual(['preapproval', 'formal_approval'])
  })
})
