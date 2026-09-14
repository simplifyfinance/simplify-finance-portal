import { describe, it, expect } from 'vitest'
import { brokerDocumentLine } from './document-request'

// WHAT THE BROKER IS TOLD WHEN THE PORTAL ASKS FOR THE DOCUMENTS ITSELF.
//
// 14 Sep 2026. The request now fires the moment the client agrees to proceed at
// the end of BC, with nobody pressing anything. This paragraph in the broker's
// email is the ONLY place a person finds out what happened, so these tests are
// about it being impossible to miss when it goes wrong.

describe('the line in the broker email', () => {
  it('says nothing at all when no request was attempted', () => {
    // The LO step, or a deal that had already proceeded.
    expect(brokerDocumentLine(null)).toBe('')
  })

  it('names how many went, and who to', () => {
    const t = brokerDocumentLine({ ok: true, status: 200, sent: 7, to: 'Ellie Whitcombe' })
    expect(t).toContain('7 documents have been requested')
    expect(t).toContain('Ellie Whitcombe')
    expect(t).toContain('Nothing for you to press')
  })

  it('counts one document as one document', () => {
    expect(brokerDocumentLine({ ok: true, status: 200, sent: 1, to: 'Ellie' }))
      .toContain('1 document has been requested')
  })

  it('SHOUTS when the request did not go out', () => {
    // Nothing else tells anybody. The client has already been told their
    // documents are coming and the deal has moved on.
    const t = brokerDocumentLine({ ok: false, status: 500, sent: 0,
      error: 'No recipient is set for document requests.' })
    expect(t).toContain('** THE DOCUMENT REQUEST DID NOT GO OUT')
    expect(t).toContain('No recipient is set')
    expect(t).toContain('press Request documents')
  })

  it('says plainly when there was nothing to ask for', () => {
    const t = brokerDocumentLine({ ok: true, status: 200, sent: 0, skipped: true,
      reason: 'There is nothing due to ask for.' })
    expect(t).toContain('No documents were requested')
    expect(t).toContain('nothing due')
    expect(t).not.toContain('DID NOT GO OUT')
  })

  it('explains a short list rather than letting it look incomplete', () => {
    const t = brokerDocumentLine({ ok: true, status: 200, sent: 3, to: 'Ellie',
      covered: ['ANZ statements', 'CBA statements'] })
    expect(t).toContain('already on file')
    expect(t).toContain('ANZ statements, CBA statements')
  })

  it('never lets the discharge question disappear quietly', () => {
    // It is a yes or no a person answers, and it is excluded from every
    // automatic request. Going automatic must not mean going silent.
    const t = brokerDocumentLine({ ok: true, status: 200, sent: 4, to: 'Ellie',
      awaitingAnswer: ['Discharge of mortgage'] })
    expect(t).toContain('Waiting on your yes or no')
    expect(t).toContain('Discharge of mortgage')
    expect(t).toContain('formal approval')
  })

  it('still shouts about a failure even when there are notes to add', () => {
    const t = brokerDocumentLine({ ok: false, status: 502, sent: 0, error: 'Resend refused',
      awaitingAnswer: ['Discharge of mortgage'], covered: ['ANZ statements'] })
    expect(t).toContain('** THE DOCUMENT REQUEST DID NOT GO OUT')
    expect(t).toContain('Discharge of mortgage')
    expect(t).toContain('ANZ statements')
  })

  it('escapes whatever it is handed rather than breaking the email', () => {
    const t = brokerDocumentLine({ ok: true, status: 200, sent: 2, to: 'Tom & Jerry' })
    expect(t).toContain('Tom &amp; Jerry')
    expect(t).not.toContain('Tom & Jerry')
  })

  it('never renders an empty value', () => {
    for (const d of [
      { ok: true, status: 200, sent: 2 },
      { ok: true, status: 200, sent: 0, skipped: true },
      { ok: false, status: 500, sent: 0 },
    ] as any[]) {
      expect(brokerDocumentLine(d), JSON.stringify(d)).not.toMatch(/undefined|null<|\$\{/)
    }
  })
})
