'use client'
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Briefcase, Users, Building2, UserPlus, Settings, LogOut, BarChart3 } from "lucide-react"
import { useEffect, useState } from "react"
import { createSupabaseBrowser } from "@/lib/supabase-browser"

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Deals", href: "/deals", icon: Briefcase },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Lender library", href: "/lenders", icon: Building2 },
]

const adminNav = [
  { label: "Team workload", href: "/credit-team-workload", icon: BarChart3 },
  { label: "Team", href: "/team", icon: UserPlus },
  { label: "Settings", href: "/settings", icon: Settings },
]

type Profile = { full_name: string; role: string; email: string }

export default function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('user_profiles').select('full_name, role, email').eq('id', user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
    })
  }, [])

  async function handleLogout() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?'
  const roleLabel = profile?.role === 'admin' ? 'Admin' : profile?.role === 'broker' ? 'Broker' : 'Staff'

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
        {nav.map(item => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${
                path.startsWith(item.href) ? 'text-[#2DBEFF] bg-[#2DBEFF]/10' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}>
              <Icon size={15} />
              {item.label}
            </Link>
          )
        })}

        {profile?.role === 'admin' && (
          <>
            <div className="text-white/30 text-xs uppercase tracking-widest px-2 mb-2 mt-4">Admin</div>
            {adminNav.map(item => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${
                    path.startsWith(item.href) ? 'text-[#2DBEFF] bg-[#2DBEFF]/10' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}>
                  <Icon size={15} />
                  {item.label}
                </Link>
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
