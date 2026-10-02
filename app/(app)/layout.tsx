import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";

// EVERYTHING BEHIND THE LOGIN IS ONE. Nothing outside it is.
//
// The template puts the page's own name first, because that is the half a
// narrow tab keeps: "Deals · ONE" cut short is still "Deals". It applies to the
// pages inside this group, never to the group itself - which is why `default`
// is here as well, for anything that forgets to name itself.
export const metadata: Metadata = {
  title: { default: "ONE by Simplify", template: "%s · ONE" },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overscroll-x-contain">
        {children}
      </main>
    </div>
  );
}
