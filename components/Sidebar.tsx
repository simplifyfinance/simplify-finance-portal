'use client'
import { SETTINGS_PANES } from '@/lib/settings-panes'
import { LENDER_PANES } from '@/lib/lender-panes'
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Briefcase, Users, Building2, UserPlus, Settings, LogOut, BarChart3, Percent, TrendingUp, CalendarCheck, Mail } from "lucide-react"
import { useEffect, useState } from "react"
import { createSupabaseBrowser } from "@/lib/supabase-browser"
import { can, roleLabel as formatRoleLabel } from '@/lib/permissions'
import OneMark, { MARK_WIDTH } from '@/components/OneMark'
import ThemeSwitch from '@/components/ThemeSwitch'
import NewVersion from '@/components/NewVersion'
import { navStarted, onBusyChange, isBusy } from '@/components/useBusy'

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
  // NOW, THEN EXPLORE. 7 Oct 2026, when the Pipeline stopped being two
  // reports on one page. Now is the default and the one people open this for;
  // Explore is the period report that used to sit under it.
  '/pipeline': [
    { key: 'now', label: 'Now' },
    { key: 'explore', label: 'Explore' },
    { key: 'actuals', label: 'Monthly actuals', adminOnly: true },
  ],
  // From lib/lender-panes.ts, never a copy - see the note on '/settings' below.
  '/lenders': LENDER_PANES.map(p => ({ key: p.key, label: p.label })),
  '/commissions': [
    { key: 'revenue',    label: 'Revenue' },
    { key: 'months',     label: 'By month' },
    { key: 'trail',      label: 'Trail book' },
    { key: 'missing',    label: 'Trail missing' },
    { key: 'clawback',   label: 'Clawback risk' },
    { key: 'reconcile',  label: 'Settlements vs paid' },
    { key: 'statements', label: 'Statements loaded' },
  ],
  // FROM lib/settings-panes.ts, NEVER A COPY. This list was hardcoded and had
  // fallen three pages behind - Deal board, Rate notice and Statement analysis
  // all existed and none of them were in the menu. 30 Sep 2026.
  '/settings': SETTINGS_PANES.map(p => ({
    key: p.key, label: p.label,
    ...(p.adminOnly ? { adminOnly: true } : {}),
    ...(p.financeOnly ? { financeOnly: true } : {}),
  })),
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

  // THE MARK RUNS WHILE THE PORTAL IS FETCHING.
  // It is the top of the column you have just clicked in, so when the thing
  // that is slow is a nav item, this is already where you are looking.
  const [busy, setBusy] = useState(false)
  useEffect(() => onBusyChange(() => setBusy(isBusy())), [])

  // WHAT WAS JUST PRESSED, BEFORE THE PAGE IT POINTS AT HAS ARRIVED.
  //
  // 7 Oct 2026. Fabio: "settings dropdown still not working you click and it
  // does not come down with all options straightaway very leggy on all 3
  // lender library commissions and settings."
  //
  // It was not lag. subNav refused to draw anything unless path.startsWith()
  // was already true - that is, unless the browser had FINISHED loading the
  // page. So pressing Settings from the Dashboard meant waiting for every
  // query Settings fires, and only then did the list of settings appear
  // underneath it. That list is three or seven fixed names. It never needed
  // the page at all.
  //
  // So the press is remembered here and the list opens on the same tick. The
  // memory clears the moment the address catches up with it - and after six
  // seconds regardless, so a navigation that never lands cannot leave the
  // wrong section hanging open.
  const [pending, setPending] = useState<{ href: string; key?: string } | null>(null)

  const [hash, setHash] = useState('')
  useEffect(() => {
    const read = () => setHash(window.location.hash.slice(1))
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  useEffect(() => {
    if (!pending) return
    if (path.startsWith(pending.href) && (!pending.key || hash === pending.key)) { setPending(null); return }
    const t = setTimeout(() => setPending(null), 6000)
    return () => clearTimeout(t)
  }, [pending, path, hash])

  // A SUB-PAGE IS REACHABLE FROM ANYWHERE, NOT ONLY FROM ITS OWN PAGE.
  //
  // This used to set window.location.hash and nothing else, which worked only
  // because the list was never drawn unless you were already on the page. Now
  // that it opens the moment you press the section, the button has to travel:
  // on the page, the hash is the whole of it and changing it fires hashchange;
  // off it, the route has to change and the hash rides along with it.
  function goSub(href: string, key: string) {
    navStarted()
    setPending({ href, key })
    if (path.startsWith(href)) window.location.hash = key
    else router.push(`${href}#${key}`)
  }

  // THE PRESS, REMEMBERED BEFORE THE ROUTE MOVES.
  // Both lists of nav items call this, because there are two of them - see the
  // note on the Admin block below.
  function pressNav(href: string, hasSubs: boolean) {
    navStarted()
    if (hasSubs) setPending({ href })
    else history.replaceState(null, '', href)
    setHash('')
  }

  // One renderer for every nav item that has sub-items, so Settings and the Lender
  // library cannot drift apart as more sections gain sub-pages.
  function subNav(href: string) {
    const subs = (SUBNAV[href] || [])
      .filter(sx => !sx.adminOnly || profile?.is_admin)
      .filter(sx => !sx.financeOnly || profile?.sees_finance)
    // Open if we are there, OR if it was just pressed. The second half is the
    // whole fix: the names do not depend on the page, so they must not wait
    // for it.
    const showing = path.startsWith(href) || pending?.href === href
    if (subs.length === 0 || !showing || collapsed.has(href)) return null
    const active = (pending?.href === href && pending.key) ? pending.key
                 : subs.some(sx => sx.key === hash) ? hash
                 : subs[0].key
    return (
      <div className="mb-1.5">
        {subs.map(sx => (
          <button key={sx.key} onClick={() => goSub(href, sx.key)}
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
    <aside className="w-56 min-w-56 flex flex-col text-white h-screen bg-sidebar">
      {/* THE LEFT COLUMN IS THE ONE FIXED THING ON SCREEN. It is this near-black
          in both themes - it anchors the page whichever way the rest goes, and
          in dark mode it stops the whole screen being one flat grey. The mark
          was drawn against this exact value, so the two move together or not at
          all. 2 Oct 2026, replacing #343333. */}
      <div className="px-4 pt-[18px] pb-4 border-b border-white/[0.09]">
        <OneMark width={MARK_WIDTH.sidebar} tone="dark" busy={busy} className="block" />
      </div>

      <nav className="flex-1 px-2 py-3">
        <div className="text-white/30 text-xs uppercase tracking-widest px-2 mb-2">Main</div>
        {nav
          .filter(item => !(item as any).settlementsOnly || profile?.is_admin || profile?.sees_settlements)
          .map(item => {
          const Icon = item.icon
          const linkClass = `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${
            path.startsWith(item.href) ? 'text-brand bg-brand/12' : 'text-white/60 hover:text-white hover:bg-white/5'
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
          const open = hasSubs && (path.startsWith(item.href) || pending?.href === item.href)
                       && !collapsed.has(item.href)
          return (
            <div key={item.href}>
              {/* PRESSED IS A STATE, AND IT USED TO HAVE NO MARK AT ALL.
                  Nothing on this item changed until the page it points at had
                  loaded its data, so for a second or two a press looked like a
                  miss - and a person who thinks they missed presses again, and
                  loads the whole thing twice. navStarted() puts the bar up and
                  sets the mark running in the same tick as the click. */}
              <Link href={item.href} className={linkClass}
                onClick={() => pressNav(item.href, hasSubs)}>
                <Icon size={15} />
                {item.label}
                {hasSubs && (
                  <span role="button" aria-label={open ? 'Collapse' : 'Expand'}
                    onClick={e => toggleSection(item.href, e)}
                    className="ml-auto -mr-1.5 -my-1.5 w-6 h-6 flex items-center justify-center rounded opacity-50 hover:opacity-100 hover:bg-white/10">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
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
              const open = hasSubs && (path.startsWith(item.href) || pending?.href === item.href)
                       && !collapsed.has(item.href)
              return (
                <div key={item.href}>
                  {/* THE ADMIN ITEMS ARE A SECOND COPY OF THE BLOCK ABOVE,
                      and until now they did not even call navStarted() - so
                      Settings and Commissions, the two slowest pages in the
                      portal, were the two that gave no sign of having been
                      pressed at all. That is most of why Fabio named those two.
                      Both lists now go through pressNav. The duplication itself
                      is still here and still wants collapsing; this was not the
                      ship to do it in. */}
                  <Link href={item.href}
                    onClick={() => pressNav(item.href, hasSubs)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${
                      path.startsWith(item.href) ? 'text-brand bg-brand/12' : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}>
                    <Icon size={15} />
                    {item.label}
                    {hasSubs && (
                      <span role="button" aria-label={open ? 'Collapse' : 'Expand'}
                        onClick={e => toggleSection(item.href, e)}
                        className="ml-auto -mr-1.5 -my-1.5 w-6 h-6 flex items-center justify-center rounded opacity-50 hover:opacity-100 hover:bg-white/10">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
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
          {/* Near-black letters on the brand blue, not white. White on this blue
              reads at 2.2 to 1 - the initials were there but nobody could see
              them. The blue is a fill, never small text on top of nothing. */}
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-brand text-on-brand">{initials}</div>
          <div>
            <div className="text-xs text-white/70">{profile?.full_name || '...'}</div>
            <div className="text-xs text-white/30">{roleLabel}</div>
          </div>
        </div>
        {/* LIGHT OR DARK, FROM INSIDE THE PORTAL.
            Until now this only lived on the login page, so the only way to
            change the theme was to sign out and change it on the way back in.
            The sidebar is near-black in BOTH themes, so it wears the sidebar
            tone rather than the page's own card-and-line colours. */}
        {/* A NEWER VERSION IS DEPLOYED AND THIS TAB IS NOT IT.
            Sits above the theme switch, under the person's name - the place
            Fabio picked out of three in docs/approved-looks/one-new-version.html.
            It draws nothing at all until there is something to say. */}
        <NewVersion />

        <ThemeSwitch tone="sidebar" className="w-full justify-between mb-3" />

        <button onClick={handleLogout}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-xs transition-colors w-full px-1">
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
