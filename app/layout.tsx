import type { Metadata } from "next";
import "./globals.css";

// WHAT THE BROWSER TAB SAYS, AND WHO IS READING IT.
//
// 2 Oct 2026. Every tab in the portal said the same eleven words - "Simplify
// Finance Portal" - so with four open you could not tell them apart. A browser
// cuts a long tab title off from the RIGHT, so the only part that survived was
// the part that was identical on all of them.
//
// This is the root, and the root is inherited by the pages a CLIENT opens from
// an email: ready, opportunity, proceed. They have never heard of ONE and never
// should - Fabio, 30 Sep 2026: "one is internal only". So the default here is
// the company, and ONE is added inside app/(app), behind the login.
export const metadata: Metadata = {
  title: "Simplify Finance",
  description: "Simplify Finance",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
