import { createSupabaseAdmin } from '@/lib/supabase-admin'

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
}

export const DEFAULT_BRAND: Brand = {
  id: 'simplify',
  name: 'Simplify Finance',
  headerColor: '#343333',
  accentColor: '#2DBEFF',
  logoUrl: 'https://simplify-finance-portal.vercel.app/logo-charcoal-tagline.png',
  footerAddress: 'St Leonards, Sydney',
  acl: '387025',
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
    acl: String(raw?.acl || DEFAULT_BRAND.acl),
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

export function brandLegal(brand: Brand): string {
  return `&copy; 2026 ${brand.name} | Mortgage Specialists Pty Ltd | ${brand.footerAddress} | ` +
         `Australian Credit Licence ${brand.acl}`
}
