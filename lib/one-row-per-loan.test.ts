import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// "WHO IS WITH UBANK" AS ONE QUERY.
//
// A loan lives three levels down a jsonb column: a loan inside a property
// inside `clients.position_properties`. Every segmentation question therefore
// meant loading the whole book into a browser and unpacking it in Javascript -
// which is what the Reports page does, and why it broke on a value with a comma
// in it.
//
// docs/client-loans-view.sql flattens it. It was rehearsed against a real
// Postgres before being handed over, including the comma-formatted money, the
// rubbish values and a client with no position at all.

const sql = () => readFileSync(join(__dirname, '..', 'docs', 'client-loans-view.sql'), 'utf8')

describe('the loan view', () => {
  it('is a view, not a second copy of the data', () => {
    // A table would mean a second write path and a day when the two disagree.
    const s = sql()
    expect(s).toMatch(/create view public\.client_loans/)
    expect(s.toLowerCase()).not.toMatch(/create table public\.client_loans/)
  })

  it('runs as whoever is asking, so nobody sees a row they could not already see', () => {
    // WITHOUT THIS THE VIEW LEAKS THE ENTIRE BOOK. A view runs with its
    // creator's privileges by default, which would step straight around the
    // policies on `clients`.
    expect(sql()).toMatch(/security_invoker\s*=\s*true/)
  })

  it('covers unsecured debt too, not just mortgages', () => {
    // "Who has a personal loan" is exactly the kind of question this is for.
    const s = sql()
    expect(s).toContain('position_liabilities')
    expect(s).toContain('position_properties')
    expect(s).toContain('union all')
  })

  it('reads money that was typed with commas', () => {
    // Number('620,000') is NaN and '620,000'::numeric throws. Both have already
    // cost a screen - see lib/money.ts.
    expect(sql()).toContain("regexp_replace")
    expect(sql()).toContain("'[^0-9.-]'")
  })

  it('turns a figure it cannot read into nothing, never into a wrong number', () => {
    // A bare CASE with no ELSE gives null. A figure the book cannot read must
    // never arrive as a zero - a zero balance is a fact, and this is not one.
    const s = sql()
    expect(s).not.toMatch(/end\s+as\s+balance[\s\S]{0,40}else\s+0/)
    expect(s).toMatch(/~ '\^-\?\[0-9\]\+\(\\\.\[0-9\]\+\)\?\$'/)
  })

  it('pastes into the Supabase editor, which cannot handle a function body', () => {
    // The first version used two helper functions. The editor splits on the
    // semicolons inside a function body and refused the whole file.
    expect(sql()).not.toContain('$$')
  })

  it('carries the two expiry dates, which are the only fields that say when to ring', () => {
    const s = sql()
    expect(s).toContain('fixedRateExpiryDate')
    expect(s).toContain('interestOnlyExpiryDate')
  })

  it('says where each loan came from and when', () => {
    // A book that mixes a settlement three weeks ago with an application in
    // March, without saying so, is a book you have to check before using.
    const s = sql()
    expect(s).toContain('position_source')
    expect(s).toContain('as as_at')
    expect(s).toContain('from_deal_id')
  })

  it('deletes nothing and touches no data', () => {
    const s = sql().toLowerCase()
    expect(s).not.toMatch(/\bdrop table\b/)
    expect(s).not.toMatch(/\bdelete from\b/)
    expect(s).not.toMatch(/\btruncate\b/)
    expect(s).not.toMatch(/\bupdate\s+public\.clients\b/)
    // Replacing the view itself is the one drop, and a view holds no data.
    expect(s).toMatch(/drop view if exists public\.client_loans/)
  })
})
