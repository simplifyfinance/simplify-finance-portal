import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'

// THE CODE RUNS IN AUSTRALIA, AND NOTHING SAYS SO UNLESS THIS FILE DOES.
//
// 23 Nov 2026. Found while working out why the portal is slow to load, and it
// turned out to be the same shape as the Singapore problem: a default nobody
// chose.
//
// Vercel runs server-side code in Washington DC unless told otherwise. There
// was no vercel.json, so every request made this trip:
//
//     a broker in Sydney  ->  a server in Virginia  ->  a database in
//     Singapore  ->  back to Virginia  ->  back to Sydney
//
// For every page, and for every one of the ten or more "who is this user"
// questions a single page asks. That is where the seconds went.
//
// IT IS ALSO A RESIDENCY FACT, not only a speed one. Every loan contract, tax
// return and payslip the portal reads is read by code executing in the United
// States. The database moving to Sydney does nothing about that on its own -
// this file is the other half.
//
// WHY A TEST AND NOT A COMMENT. Deleting vercel.json does not fail anything.
// The portal keeps working, slightly slower, from another country, and nobody
// finds out. That is the exact failure mode this repository keeps meeting:
// a default that is wrong, silent, and only visible to somebody who goes
// looking. See docs/the-security-audit.md.
//
// Fabio, from the first day of the project: everything stays in Australia.

const SYDNEY = 'syd1'

describe('the portal runs in Australia', () => {
  it('vercel.json exists at all', () => {
    expect(existsSync('vercel.json'),
      'Without this file Vercel runs the server-side code in Washington DC. '
      + 'It is one line and it is the difference between the portal being in '
      + 'Australia and only the database being in Australia.').toBe(true)
  })

  it('and it pins the region to Sydney', () => {
    const cfg = JSON.parse(readFileSync('vercel.json', 'utf-8'))
    expect(cfg.regions,
      'vercel.json must set "regions". Without it the default is iad1, Virginia.')
      .toBeDefined()
    expect(cfg.regions,
      `"regions" must be exactly ["${SYDNEY}"]. A second region means some `
      + 'requests are served from somewhere else, which is a residency question '
      + 'as well as a speed one.')
      .toEqual([SYDNEY])
  })
})

// AND THE MIDDLEWARE DOES NOT ASK WHO SOMEBODY IS BEFORE IT KNOWS IT CARES.
//
// auth.getUser() is a round trip to Supabase, not a local read. It used to run
// at the top of middleware.ts, before the four client-facing pages were waved
// through - so every client opening a link from an email paid for a trip to
// Singapore to be told something those pages never looked at.
describe('and it does not ask Singapore a question it will not use', () => {
  const MW = readFileSync('middleware.ts', 'utf-8')

  it('the public pages are let through before anybody is identified', () => {
    const publicCheck = MW.indexOf("pathname.startsWith('/ready')")
    const getUser = MW.indexOf('auth.getUser()')
    expect(publicCheck).toBeGreaterThan(-1)
    expect(getUser).toBeGreaterThan(-1)
    expect(getUser,
      'auth.getUser() must come AFTER the public-route check in middleware.ts. '
      + 'Before it, every client opening /ready or /answers makes a round trip '
      + 'to Supabase whose answer is then discarded.')
      .toBeGreaterThan(publicCheck)
  })
})
