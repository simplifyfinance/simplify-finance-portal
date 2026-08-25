'use client'
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Briefcase, Users, Building2, UserPlus, Settings, LogOut, BarChart3, Percent, TrendingUp, CalendarCheck, Mail } from "lucide-react"
import { useEffect, useState } from "react"
import { createSupabaseBrowser } from "@/lib/supabase-browser"
import { can, roleLabel as formatRoleLabel } from '@/lib/permissions'

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Deals", href: "/deals", icon: Briefcase },
  { label: "Pipeline", href: "/pipeline", icon: TrendingUp },
  { label: "Settlements", href: "/settlements", icon: CalendarCheck, settlementsOnly: true },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Lender library", href: "/lenders", icon: Building2 },
  { label: "Templates", href: "/templates", icon: Mail },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Cheat sheet", href: "/cheat-sheet", icon: Percent, newTab: true },
]

// The heading is cosmetic. Each item states who may see it, so finance staff keep
// Commissions without being made an admin.
const adminNav = [
  { label: "Commissions", href: "/commissions", icon: Percent, need: 'finance' as const },
  { label: "Team workload", href: "/credit-team-workload", icon: BarChart3, need: 'admin' as const },
  { label: "Team", href: "/team", icon: UserPlus, need: 'admin' as const },
  { label: "Settings", href: "/settings", icon: Settings, need: 'admin' as const },
]

type Profile = { full_name: string; role: string; email: string; is_admin?: boolean; sees_finance?: boolean
                 sees_settlements?: boolean }

// Settings has outgrown one scroll, so it nests under the nav item rather than
// growing a second left column beside the one the portal already has.
const SUBNAV: Record<string, { key: string; label: string; adminOnly?: boolean; financeOnly?: boolean }[]> = {
  '/pipeline': [
    { key: 'report', label: 'Report' },
    { key: 'actuals', label: 'Monthly actuals', adminOnly: true },
  ],
  '/lenders': [
    { key: 'lenders', label: 'Products & policy' },
  ],
  '/settings': [
    { key: 'brands', label: 'Brands' },
    { key: 'brokers', label: 'Broker profiles' },
    { key: 'targets', label: 'Targets', adminOnly: true },
    { key: 'commissions', label: 'Commission library', financeOnly: true },
    { key: 'ai', label: 'AI expenses', financeOnly: true },
    { key: 'people', label: 'Credit team' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'compliance', label: 'Compliance AI' },
    { key: 'connections', label: 'Connections' },
  ],
}

export default function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('user_profiles').select('full_name, role, email, is_admin, sees_finance, sees_settlements').eq('id', user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
    })
  }, [])

  async function handleLogout() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const visibleAdmin = adminNav.filter(item =>
    item.need === 'finance'
      ? !!(profile?.is_admin || profile?.sees_finance)
      : can(profile?.role, 'manageTeam'))

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?'
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  function toggleSection(href: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  const [hash, setHash] = useState('')
  useEffect(() => {
    const read = () => setHash(window.location.hash.slice(1))
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  // One renderer for every nav item that has sub-items, so Settings and the Lender
  // library cannot drift apart as more sections gain sub-pages.
  function subNav(href: string) {
    const subs = (SUBNAV[href] || [])
      .filter(sx => !sx.adminOnly || profile?.is_admin)
      .filter(sx => !sx.financeOnly || profile?.sees_finance)
    if (subs.length === 0 || !path.startsWith(href) || collapsed.has(href)) return null
    const active = subs.some(sx => sx.key === hash) ? hash : subs[0].key
    return (
      <div className="mb-1.5">
        {subs.map(sx => (
          <button key={sx.key} onClick={() => { window.location.hash = sx.key }}
            className={`block w-full text-left pl-[31px] pr-2.5 py-1.5 rounded-md text-xs transition-colors ${
              active === sx.key ? 'bg-white/10 text-white font-semibold' : 'text-white/45 hover:text-white hover:bg-white/5'
            }`}>
            {sx.label}
          </button>
        ))}
      </div>
    )
  }

  const roleLabel = formatRoleLabel(profile?.role)

  return (
    <aside style={{ background: '#343333' }} className="w-56 min-w-56 flex flex-col text-white h-screen">
      <div className="px-4 py-4 border-b border-white/10 flex justify-center">
        <img src="/logo-charcoal.png" alt="Simplify Finance" className="h-16 w-auto" />
      </div>
      <div className="px-4 py-2 border-b border-white/10">
        <div className="text-white/40 text-xs">Credit & Compliance Portal</div>
      </div>

      <nav className="flex-1 px-2 py-3">
        <div className="text-white/30 text-xs uppercase tracking-widest px-2 mb-2">Main</div>
        {nav
          .filter(item => !(item as any).settlementsOnly || profile?.is_admin || profile?.sees_settlements)
          .map(item => {
          const Icon = item.icon
          const linkClass = `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${
            path.startsWith(item.href) ? 'text-[#2DBEFF] bg-[#2DBEFF]/10' : 'text-white/60 hover:text-white hover:bg-white/5'
          }`
          if ((item as any).newTab) {
            return (
              <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                <Icon size={15} />
                {item.label}
              </a>
            )
          }
          const hasSubs = !!SUBNAV[item.href]
          const open = hasSubs && path.startsWith(item.href) && !collapsed.has(item.href)
          return (
            <div key={item.href}>
              <Link href={item.href} className={linkClass}
                onClick={() => { if (!hasSubs) history.replaceState(null, '', item.href); setHash('') }}>
                <Icon size={15} />
                {item.label}
                {hasSubs && (
                  <span role="button" aria-label={open ? 'Collapse' : 'Expand'}
                    onClick={e => toggleSection(item.href, e)}
                    className="ml-auto -mr-1 px-1 py-0.5 rounded opacity-50 hover:opacity-100 hover:bg-white/10">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d={open ? 'M12 10L8 6l-4 4' : 'M4 6l4 4 4-4'} />
                    </svg>
                  </span>
                )}
              </Link>
              {subNav(item.href)}
            </div>
          )
        })}

        {visibleAdmin.length > 0 && (
          <>
            <div className="text-white/30 text-xs uppercase tracking-widest px-2 mb-2 mt-4">Admin</div>
            {visibleAdmin.map(item => {
              const Icon = item.icon
              const hasSubs = !!SUBNAV[item.href]
              const open = hasSubs && path.startsWith(item.href) && !collapsed.has(item.href)
              return (
                <div key={item.href}>
                  <Link href={item.href}
                    onClick={() => { if (!hasSubs) history.replaceState(null, '', item.href); setHash('') }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${
                      path.startsWith(item.href) ? 'text-[#2DBEFF] bg-[#2DBEFF]/10' : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}>
                    <Icon size={15} />
                    {item.label}
                    {hasSubs && (
                      <span role="button" aria-label={open ? 'Collapse' : 'Expand'}
                        onClick={e => toggleSection(item.href, e)}
                        className="ml-auto -mr-1 px-1 py-0.5 rounded opacity-50 hover:opacity-100 hover:bg-white/10">
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                             strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <path d={open ? 'M12 10L8 6l-4 4' : 'M4 6l4 4 4-4'} />
                        </svg>
                      </span>
                    )}
                  </Link>
                  {subNav(item.href)}
                </div>
              )
            })}
          </>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <div style={{ background: '#2DBEFF' }} className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold">{initials}</div>
          <div>
            <div className="text-xs text-white/70">{profile?.full_name || '...'}</div>
            <div className="text-xs text-white/30">{roleLabel}</div>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-xs transition-colors w-full px-1">
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
