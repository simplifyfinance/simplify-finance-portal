import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // THE BUILD'S OWN NAME, CARRIED INTO THE BROWSER.
  //
  // 6 Oct 2026. Vercel hands every build the commit it was made from. Naming
  // it here bakes it into the page, so a tab can tell whether what it is
  // running is still what is deployed. See lib/new-version.ts.
  //
  // On a laptop there is no commit, so it is 'dev' - and lib/new-version.ts
  // refuses to call anything on 'dev' a new version.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  },
};

export default nextConfig;
