// A BRAND DOES NOT CLAIM A CREDIT LICENCE IT DOES NOT HOLD.
//
// 27 Oct 2026. Fabio: "SimplifyBA we were big on removing the the footer with
// Specialist ACL go BACK TO ORIGINALLY when we set this up".
//
// The buyers agency email was going out with this at the bottom:
//
//   © 2026 SimplifyBA | Mortgage Specialists Pty Ltd | St Leonards, Sydney |
//   Australian Credit Licence 387025
//
// A buyers agency does not hold a credit licence. Three things put that there
// and all three had to go, because fixing any two left it unchanged:
//
//   1. brandLegal() typed the company and the licence into every brand.
//   2. "+ Add another brand" in Settings pre-filled 387025 on a new brand, so
//      nobody ever chose it for SimplifyBA - the form did.
//   3. normaliseBrand() put 387025 back if the field was ever cleared.
//
// THE COMPANY AND THE LICENCE ARE ONE FACT. "Mortgage Specialists Pty Ltd" is
// on the footer because that is who holds the licence. A brand not trading
// under the licence is not trading under that company either, so it gets
// neither - just its own name and address.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { brandLegal, normaliseBrand, DEFAULT_BRAND, LICENCE_HOLDER } from './brand'

// The three brands as they are actually stored, 27 Oct 2026.
const SIMPLIFY = { id: 'simplify', name: 'Simplify Finance', acl: '387025', footerAddress: 'St Leonards, Sydney' }
const NAVIGATE = { id: '1784774195128', name: 'Navigate', acl: '387025', footerAddress: 'St Leonards, Sydney' }
const BA_NOW = { id: '1787804232890', name: 'SimplifyBA', acl: '387025', footerAddress: 'St Leonards, Sydney' }
// The same brand once the number is cleared in Settings.
const BA_FIXED = { ...BA_NOW, acl: '' }

describe('what the footer says', () => {
  it('Simplify Finance is unchanged, to the character', () => {
    expect(brandLegal(normaliseBrand(SIMPLIFY)))
      .toBe('&copy; 2026 Simplify Finance | Mortgage Specialists Pty Ltd | St Leonards, Sydney | Australian Credit Licence 387025')
  })

  it('and Navigate is unchanged too, because it holds the same licence', () => {
    expect(brandLegal(normaliseBrand(NAVIGATE)))
      .toBe('&copy; 2026 Navigate | Mortgage Specialists Pty Ltd | St Leonards, Sydney | Australian Credit Licence 387025')
  })

  it('THE ONE THIS IS FOR: no licence recorded, nothing claimed', () => {
    expect(brandLegal(normaliseBrand(BA_FIXED)))
      .toBe('&copy; 2026 SimplifyBA | St Leonards, Sydney')
  })

  it('and the company goes with the licence, never on its own', () => {
    const out = brandLegal(normaliseBrand(BA_FIXED))
    expect(out).not.toContain(LICENCE_HOLDER)
    expect(out).not.toContain('Australian Credit Licence')
    expect(out).not.toContain('387025')
  })

  it('the address is still shared, and that is deliberate', () => {
    // A blank address falls back to St Leonards. Left as it was, on purpose:
    // an office is not a claim about who holds a licence, and all three brands
    // work out of the same one. If a brand ever opens its own office, this is
    // the line to revisit.
    expect(brandLegal(normaliseBrand({ id: 'x', name: 'A Brand', acl: '', footerAddress: '' })))
      .toBe('&copy; 2026 A Brand | St Leonards, Sydney')
  })

  it('but brandLegal itself drops an address it is not given', () => {
    expect(brandLegal({ ...DEFAULT_BRAND, name: 'A Brand', acl: '', footerAddress: '' }))
      .toBe('&copy; 2026 A Brand')
  })
})

describe('the number cannot come back on its own', () => {
  it('a cleared licence stays cleared', () => {
    // This line used to read `raw?.acl || DEFAULT_BRAND.acl`, so clearing the
    // field in Settings did nothing at all.
    expect(normaliseBrand(BA_FIXED).acl).toBe('')
    expect(normaliseBrand({ id: 'x', name: 'A Brand' }).acl).toBe('')
  })

  it('but the house brand keeps its own', () => {
    // An empty acl on the DEFAULT brand is a missing value, not a statement -
    // Simplify does hold 387025, and its email must say so.
    expect(normaliseBrand({ id: 'simplify', name: 'Simplify Finance' }).acl).toBe('387025')
    expect(DEFAULT_BRAND.acl).toBe('387025')
  })

  it('and a new brand is not born holding our licence', () => {
    const settings = readFileSync('app/(app)/settings/SettingsClient.tsx', 'utf8')
    const add = settings.slice(settings.indexOf("name: 'New Brand'"))
    expect(add.slice(0, 200), 'the Add a brand button pre-fills an ACL again')
      .not.toContain("acl: '387025'")
  })
})

describe('nothing types the licence into an email any more', () => {
  it('only brandLegal says it, and only from the brand', () => {
    for (const f of ['lib/email-shell.ts', 'lib/brand.ts', 'app/api/generate-lo-email/route.ts']) {
      const src = readFileSync(f, 'utf8')
      const code = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')
      // lib/brand.ts is the one place both are allowed to exist, because it is
      // where they are DEFINED - LICENCE_HOLDER and the house brand's own ACL.
      // Everywhere else, typing either one in is how a brand ends up claiming
      // something that is not true of it.
      if (f === 'lib/brand.ts') continue
      expect(code, `${f} types the licence holder in`).not.toContain('Mortgage Specialists Pty Ltd')
      expect(code, `${f} has a licence number typed into it`).not.toContain('387025')
    }
  })
})
