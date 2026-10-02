import type { Metadata } from "next";
import "./globals.css";
import { THEME_BOOT } from "@/lib/theme";

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
    // suppressHydrationWarning IS REQUIRED HERE AND IS NOT A WORKAROUND.
    // The script below deliberately writes data-theme onto this element before
    // React has run, so the markup React built on the server and the markup in
    // the browser differ by exactly that attribute, on purpose. Without this,
    // React logs a mismatch for something we did intentionally - and a warning
    // that is always there is a warning nobody reads.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* LIGHT OR DARK, DECIDED BEFORE ANYTHING IS DRAWN.
            React runs after the first paint, so deciding the theme in a
            component means every dark-mode visitor sees a white flash first -
            the one thing that makes a dark mode feel broken. This runs in the
            head instead. It is tiny, cannot throw, and falls back to light.
            The script itself lives in lib/theme.ts beside the rule it follows,
            and lib/theme.test.ts runs this exact string against the same cases
            as the TypeScript version so the two cannot drift. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
