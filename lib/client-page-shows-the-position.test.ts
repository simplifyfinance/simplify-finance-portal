import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { heldLine, settledSince, outOfDateLine, auDate, sourceLine } from './client-position'

// WHAT THE CLIENT PAGE TELLS SOMEBODY ABOUT A POSITION.
//
// Before 23 Sep 2026 it showed properties and liabilities under a bare date.
// Assets were saved and never drawn, nothing said where the figures came from,
// and a position that predated a settled deal looked identical to a fresh one.
// See /home/claude/client-position-audit.md, section 4.

const page = () => readFileSync(join(__dirname, '..', 'app', '(app)', 'clients', '[id]', 'page.tsx'), 'utf8')

describe('who owns an item', () => {
  it('says nothing when a sole applicant owns the whole thing', () => {
    // There is no second person and no share. A line here would be noise.
    expect(heldLine({ share: null, jointWith: [], ownershipConfirmed: true })).toBe(null)
  })

  it('gives the share when one was recorded', () => {
    expect(heldLine({ share: 50, jointWith: ['Megan Isherwood'], ownershipConfirmed: true }))
      .toBe('50% share, joint with Megan Isherwood')
  })

  it('names who else is on it when there is no percentage', () => {
    // Liabilities and assets are ticked, never split, so there is no share to
    // print - but who else holds it is still a fact.
    expect(heldLine({ share: null, jointWith: ['Dylan Smyth'], ownershipConfirmed: true }))
      .toBe('joint with Dylan Smyth')
  })

  it('warns when nobody ever said who owns it', () => {
    const line = heldLine({ share: null, jointWith: ['Megan Isherwood'], ownershipConfirmed: false })
    expect(line).toContain('Ownership not confirmed')
    expect(line).toContain('Megan Isherwood')
  })

  it('reads three or more names without a comma splice', () => {
    expect(heldLine({ share: 25, jointWith: ['A One', 'B Two', 'C Three'], ownershipConfirmed: true }))
      .toBe('25% share, joint with A One, B Two and C Three')
  })

  it('says nothing for an item this client does not hold', () => {
    expect(heldLine(null)).toBe(null)
    expect(heldLine(undefined)).toBe(null)
  })
})

describe('a position that is behind a settled deal', () => {
  const settled = (id: string, at: string, name = 'Chapman — refinance') =>
    ({ id, deal_name: name, settled_at: at })

  it('finds a deal that settled after the position was recorded', () => {
    const d = settledSince('2026-03-01T00:00:00Z', [settled('d1', '2026-09-03T00:00:00Z')])
    expect(d?.id).toBe('d1')
  })

  it('says nothing when the position is newer than every settlement', () => {
    expect(settledSince('2026-09-10T00:00:00Z', [settled('d1', '2026-09-03T00:00:00Z')])).toBe(null)
  })

  it('treats a client with a settled deal and no position at all as behind', () => {
    // This is the case the old page could not show: nothing drawn, so nothing
    // to notice.
    expect(settledSince(null, [settled('d1', '2026-09-03T00:00:00Z')])?.id).toBe('d1')
  })

  it('ignores deals that have not settled', () => {
    expect(settledSince('2026-01-01T00:00:00Z', [{ id: 'd1', deal_name: 'Live one', settled_at: null }]))
      .toBe(null)
  })

  it('picks the most recent settlement, because that is the missing loan', () => {
    const d = settledSince('2026-01-01T00:00:00Z', [
      settled('old', '2026-04-01T00:00:00Z'),
      settled('new', '2026-09-03T00:00:00Z'),
      settled('mid', '2026-06-01T00:00:00Z'),
    ])
    expect(d?.id).toBe('new')
  })

  it('survives a rubbish date without claiming the position is behind', () => {
    expect(settledSince('2026-01-01T00:00:00Z', [{ id: 'd1', settled_at: 'not a date' }])).toBe(null)
  })

  it('has no opinion when there are no deals', () => {
    expect(settledSince('2026-01-01T00:00:00Z', [])).toBe(null)
    expect(settledSince('2026-01-01T00:00:00Z', null)).toBe(null)
  })
})

describe('the wording', () => {
  it('names the deal and tells somebody the loan may be missing', () => {
    const line = outOfDateLine({ id: 'd1', deal_name: 'Chapman — refinance', settled_at: '2026-09-03T00:00:00Z' }, true)
    expect(line).toContain('Chapman — refinance')
    expect(line).toContain('may not be in the figures')
  })

  it('says something different when nothing was ever recorded', () => {
    const line = outOfDateLine({ id: 'd1', deal_name: 'Chapman', settled_at: '2026-09-03T00:00:00Z' }, false)
    expect(line).toContain('nothing has ever been recorded')
    expect(line).not.toContain('may not be in the figures')
  })

  it('separates a settlement from an application', () => {
    expect(sourceLine('settlement', 'Chapman')).toContain('settlement')
    expect(sourceLine('application', 'Chapman')).toContain('application')
    expect(sourceLine('settlement', 'Chapman')).not.toEqual(sourceLine('application', 'Chapman'))
  })

  it('does not print an empty date as Invalid Date', () => {
    expect(auDate(null)).toBe('')
    expect(auDate('')).toBe('')
    expect(auDate('nonsense')).toBe('')
  })
})

describe('the client page draws what is saved', () => {
  it('has an assets panel at all', () => {
    // Assets have been saved on every capture since the portal was built and
    // drawn nowhere. This is the gate that stops that happening again.
    const src = page()
    expect(src).toMatch(/position_assets/)
    expect(src).toMatch(/Assets/)
    expect(src).toMatch(/assets\.map/)
  })

  it('says where the position came from, not just when', () => {
    expect(page()).toMatch(/sourceLine\(/)
  })

  it('flags a settled deal newer than the position', () => {
    expect(page()).toMatch(/settledSince\(/)
  })

  it('shows who owns each item', () => {
    expect(page()).toMatch(/heldLine\(/)
  })

  it('draws something for a client with no position, instead of nothing', () => {
    expect(page()).toContain('No position recorded yet')
  })

  it('shows the two expiry dates, which are the only fields that say when to ring', () => {
    const src = page()
    expect(src).toContain('fixedRateExpiryDate')
    expect(src).toContain('interestOnlyExpiryDate')
  })
})
