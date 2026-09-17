import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// CHANGING SOMEBODY'S EMAIL MEANS CHANGING THEIR LOGIN.
//
// 17 Sep 2026. Ellesse was recorded as ellesse@simpilfyfinance.com.au - a domain
// that does not exist - so nothing the portal ever sent her arrived, and the Team
// screen could not fix it: the name had a pencil and the email was grey text.
//
// The address lives in two places: the profile row the portal shows, and the
// login Supabase holds. Changing only the first looks like a fix and is not.

const route = readFileSync('app/api/change-user-email/route.ts', 'utf8')
const team = readFileSync('components/TeamSection.tsx', 'utf8')
const invite = readFileSync('app/api/invite-user/route.ts', 'utf8')

describe('the route changes both, in the right order', () => {
  it('changes the login as well as the profile row', () => {
    expect(route).toMatch(/auth\.admin\.updateUserById\(userId, \{ email: next \}\)/)
    expect(route).toMatch(/from\('user_profiles'\)\.update\(\{ email: next \}\)/)
  })

  it('does the LOGIN first, so a failure never locks somebody out', () => {
    expect(route.indexOf('updateUserById'), 'the profile is written before the login')
      .toBeLessThan(route.indexOf("update({ email: next })"))
  })

  it('says so plainly if the profile write fails after the login changed', () => {
    expect(route).toMatch(/halfDone: true/)
    expect(route).toMatch(/now signs in as/)
  })

  it('checks the row came back, because a refused write returns none and no error', () => {
    expect(route).toMatch(/!rows \|\| rows\.length === 0/)
  })
})

describe('what it refuses', () => {
  it('anything that is not an email, before writing', () => {
    expect(route).toMatch(/if \(!EMAIL\.test\(next\)\)/)
    expect(route.indexOf('EMAIL.test'), 'it validates after touching the login')
      .toBeLessThan(route.indexOf('updateUserById'))
  })

  it('an address that already belongs to somebody, and names them', () => {
    expect(route).toMatch(/already belongs to \$\{clash\.full_name\}/)
  })

  it('anybody who is not an admin, checked on the server', () => {
    expect(route).toMatch(/Only an admin can change/)
    expect(route, 'permission is judged from the caller, not from what was posted')
      .toMatch(/auth\.getUser\(\)/)
  })

  it('treats the same address in another case as no change', () => {
    expect(route).toMatch(/unchanged: true/)
  })
})

describe('the Team screen', () => {
  it('lets the email be edited the way the name is', () => {
    expect(team).toMatch(/setEditingEmailId\(user\.id\)/)
  })

  it('asks before changing it, naming both addresses', () => {
    expect(team).toMatch(/Change how \{emailAsk\.user\.full_name/)
    expect(team).toMatch(/\{emailAsk\.user\.email\}/)
    expect(team).toMatch(/\{emailAsk\.next\}/)
  })

  it('says the old address stops working', () => {
    expect(team).toMatch(/sign in with the new address/)
  })

  it('and reminds them to resend the invite', () => {
    expect(team).toMatch(/Send the invite again/)
  })
})

describe('the two that stop it happening again', () => {
  it('inviting an admin turns on sees all deals', () => {
    expect(invite).toMatch(/sees_all_deals: role === 'admin'/)
  })

  it('the Team screen warns about an admin who cannot see the book', () => {
    expect(team).toMatch(/This admin cannot see every deal/)
    expect(team).toMatch(/!user\.sees_all_deals/)
  })
})
