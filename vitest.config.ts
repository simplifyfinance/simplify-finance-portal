import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// WHICH TESTS ARE THE MATHS TESTS.
//
// vitest was picking up everything with "test" in the name, including the
// browser checks - which are Playwright's, use its own runner, and blew up the
// whole ship on 9 Sep 2026 the first time they existed. It was also still
// running the tests of files sitting in _to_delete, which are by definition not
// part of the portal any more.
//
// vitest reads the code. Playwright opens the page. Two runners, two jobs, and
// ship.sh calls them separately - see scripts/check-browser.sh.
const ROOT = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  // `@/lib/...` RESOLVES UNDER NEXT AND DID NOT RESOLVE HERE.
  //
  // Which is why every tested library uses relative imports, and why anything
  // reached through `@/` - lib/brand.ts, lib/email-shell.ts, and so every
  // template email built on them - simply could not be tested at all. The first
  // test that touched one failed on the import, not on anything it asserted.
  //
  // A regex, not the bare string '@'. A plain '@' alias also matches
  // '@supabase/supabase-js' and every other scoped package, and rewrites them
  // into the repo where they do not exist.
  resolve: { alias: [{ find: /^@\//, replacement: ROOT }] },
  test: {
    exclude: [
      // vitest's own defaults, restated - naming an exclude list replaces them
      // rather than adding to them, and losing them silently is the sort of
      // thing that only shows up months later.
      '**/node_modules/**',
      '**/dist/**',
      '**/.idea/**',
      '**/.git/**',
      '**/.cache/**',
      '**/.next/**',
      // Playwright's. Run by scripts/check-browser.sh, after the build.
      'tests/browser/**',
      // Waiting to be deleted; not part of the portal.
      '_to_delete/**',
    ],
  },
})
