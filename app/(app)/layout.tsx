import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import TopProgress from "@/components/TopProgress";

// EVERYTHING BEHIND THE LOGIN IS ONE. Nothing outside it is.
//
// The template puts the page's own name first, because that is the half a
// narrow tab keeps: "Deals · ONE" cut short is still "Deals". It applies to the
// pages inside this group, never to the group itself - which is why `default`
// is here as well, for anything that forgets to name itself.
//
// AND THE ICON IS STATED, NOT INFERRED. It used to be a file called icon.png
// sitting in this folder, on the understanding that Next.js would work out that
// it belonged to these routes. It did not - every tab showed the Simplify
// Finance mark instead, including deals. Stating it here replaces whatever the
// root layout said, which is exactly the behaviour we want and the behaviour a
// folder name could not guarantee.
export const metadata: Metadata = {
  title: { default: "ONE by Simplify", template: "%s · ONE" },
  icons: { icon: [{ url: "/one-o.png", type: "image/png" }] },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // bg-gray-50 is the board behind the cards. It is a warm off-white now
    // rather than Tailwind's cool one - the name is the same, the value is
    // ours. See "the grey it wears" in lib/colours.ts.
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      {/* THE BAR GOES HERE AND NOWHERE ELSE.
          It is fixed to the window rather than drawn inside <main>, which
          scrolls - a bar that slides away the moment you scroll is a bar you
          will not see on exactly the long pages that take longest to load. */}
      <TopProgress />
      <main className="flex-1 overflow-y-auto overscroll-x-contain">
        {children}
      </main>
    </div>
  );
}
