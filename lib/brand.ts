import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { siteUrl } from './site-url'

// The trading name a client-facing email goes out under.
//
// The borrowing capacity email has read this from settings for a long time;
// everything else had Simplify Finance typed into it, licence number included.
// One definition now, so a second brand cannot be right in one email and wrong
// in the next.

export type Brand = {
  id: string
  name: string
  headerColor: string
  accentColor: string
  logoUrl: string
  footerAddress: string
  acl: string
  // The address under a sign-off on a client email. A second brand has its own
  // website, so this is stored beside the rest of it rather than typed into the
  // email builders - where it would have been Simplify Finance's for everybody.
  web: string
}

// WHOSE CREDIT LICENCE IT IS. One company holds it; a brand either trades
// under it or it does not. See brandLegal() for why those two facts are one.
export const LICENCE_HOLDER = 'Mortgage Specialists Pty Ltd'

export const DEFAULT_BRAND: Brand = {
  id: 'simplify',
  name: 'Simplify Finance',
  headerColor: '#343333',
  accentColor: '#2DBEFF',
  logoUrl: `${siteUrl()}/logo-charcoal-tagline.png`,
  footerAddress: 'St Leonards, Sydney',
  acl: '387025',
  web: 'simplifyfinance.com.au',
}

export function normaliseBrand(raw: any): Brand {
  return {
    id: String(raw?.id || DEFAULT_BRAND.id),
    name: String(raw?.name || DEFAULT_BRAND.name),
    headerColor: String(raw?.headerColor || DEFAULT_BRAND.headerColor),
    accentColor: String(raw?.accentColor || DEFAULT_BRAND.accentColor),
    // A brand with no logo of its own does not borrow another brand's.
    logoUrl: String(raw?.logoUrl || (raw?.id && raw.id !== DEFAULT_BRAND.id ? '' : DEFAULT_BRAND.logoUrl)),
    footerAddress: String(raw?.footerAddress || DEFAULT_BRAND.footerAddress),
    // A BRAND DOES NOT BORROW A CREDIT LICENCE. Same rule as the logo and the
    // website above, and it is the one that matters.
    //
    // 27 Oct 2026. Fabio: "SimplifyBA we were big on removing the the footer
    // with Specialist ACL go BACK TO ORIGINALLY when we set this up". The
    // buyers agency email was going out saying "Mortgage Specialists Pty Ltd
    // ... Australian Credit Licence 387025". A buyers agency does not hold a
    // credit licence and must not claim one.
    //
    // Nobody chose that number for it. The "+ Add another brand" button in
    // Settings typed 387025 into every new brand, and this line put it back if
    // anybody cleared it. Both are gone.
    acl: String(raw?.acl || (raw?.id && raw.id !== DEFAULT_BRAND.id ? '' : DEFAULT_BRAND.acl)),
    // Like the logo: a brand of its own does not borrow another brand's website.
    web: String(raw?.web || (raw?.id && raw.id !== DEFAULT_BRAND.id ? '' : DEFAULT_BRAND.web)),
  }
}

// Server side. The licence number goes on client-facing email, so an unknown
// brand id falls back to the default rather than to nothing at all.
export async function resolveBrand(id: string | null | undefined): Promise<Brand> {
  const wanted = String(id || '').trim().toLowerCase()
  if (!wanted) return DEFAULT_BRAND
  try {
    const admin = createSupabaseAdmin()
    const { data } = await admin.from('settings').select('brands').eq('id', 'singleton').maybeSingle()
    const list: any[] = Array.isArray((data as any)?.brands) ? (data as any).brands : []
    const row = list.find(b => String(b?.id || '').trim().toLowerCase() === wanted)
      || list.find(b => String(b?.name || '').trim().toLowerCase() === wanted)
    return row ? normaliseBrand(row) : DEFAULT_BRAND
  } catch {
    return DEFAULT_BRAND
  }
}

/**
 * THE LINE AT THE BOTTOM OF A CLIENT EMAIL.
 *
 * It used to be one sentence with the company and the licence typed into it,
 * so every brand claimed both whether or not either was true.
 *
 * THE COMPANY AND THE LICENCE ARE ONE FACT, NOT TWO. "Mortgage Specialists Pty
 * Ltd" appears because that is who holds the credit licence. A brand that does
 * not trade under the licence is not trading under that company either, so a
 * brand with no ACL recorded gets neither - it is left with its own name and
 * its own address, which is all a buyers agency should be saying.
 *
 * Simplify Finance and Navigate both have 387025 recorded, so neither changes.
 */
export function brandLegal(brand: Brand): string {
  const acl = String(brand.acl ?? '').trim()
  const address = String(brand.footerAddress ?? '').trim()
  const parts = [`&copy; 2026 ${brand.name}`]
  if (acl) parts.push(LICENCE_HOLDER)
  if (address) parts.push(address)
  if (acl) parts.push(`Australian Credit Licence ${acl}`)
  return parts.join(' | ')
}
