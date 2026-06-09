'use client'
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, Users, Building2, Mail, UserPlus, Settings } from "lucide-react";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Deals", href: "/deals", icon: Briefcase },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Lender library", href: "/lenders", icon: Building2 },
  { label: "Email generator", href: "/emails", icon: Mail },
];

const admin = [
  { label: "Team", href: "/team", icon: UserPlus },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside style={{background:'#343333'}} className="w-56 min-w-56 flex flex-col text-white h-screen">
      <div className="px-4 py-5 border-b border-white/10">
        <div style={{color:'#2DBEFF'}} className="font-semibold text-sm tracking-wide">Simplify Finance</div>
        <div className="text-white/40 text-xs mt-1">Credit & Compliance Portal</div>
      </div>
      <nav className="flex-1 px-2 py-3">
        <div className="text-white/30 text-xs uppercase tracking-widest px-2 mb-2">Main</div>
        {nav.map(item => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${
                path.startsWith(item.href)
                  ? 'text-[#2DBEFF] bg-[#2DBEFF]/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}>
              <Icon size={15} />
              {item.label}
            </Link>
          );
        })}
        <div className="text-white/30 text-xs uppercase tracking-widest px-2 mb-2 mt-4">Admin</div>
        {admin.map(item => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${
                path.startsWith(item.href)
                  ? 'text-[#2DBEFF] bg-[#2DBEFF]/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}>
              <Icon size={15} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div style={{background:'#2DBEFF'}} className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold">FD</div>
          <div>
            <div className="text-xs text-white/70">Fabio De Castro</div>
            <div className="text-xs text-white/30">Admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
