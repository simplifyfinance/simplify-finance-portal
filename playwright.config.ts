import { defineConfig, devices } from '@playwright/test'

// THE ROBOT THAT OPENS THE PORTAL AND TYPES INTO IT.
//
// Every other check on ship.sh reads the code. Not one of them opens a page,
// types in a box, or puts two windows on one deal. In the week of 3-9 Sep 2026
// three faults reached the team that no code-level check could ever have seen:
// the deal page jumping under somebody's hands, a colleague showing as present
// in a deal she had left days earlier, and letters vanishing out of Kylie's
// sentences as she wrote them. Every one would have been obvious within two
// minutes of somebody looking.
//
// Fabio, 9 Sep 2026: "How do we stop the bugs?"
//
// This is the answer that does not rely on anybody remembering.
//
// IT RUNS AGAINST THE BUILD BEING SHIPPED, not against the live site - testing
// production would test the code that is already out there, which is the one
// version we know nothing new about.
export default defineConfig({
  testDir: './tests/browser',
  // A dropped keystroke is a race. Racing tests that retry quietly are how a
  // flake becomes a fact of life, so a failure here fails.
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.PORTAL_TEST_URL || 'http://localhost:3100',
    // Kept on failure only. A passing run should be silent.
    // Signed in once, by hand, by scripts/portal-login.sh. No password is
    // stored anywhere for this to read.
    storageState: '.auth/portal.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  // THE CHROME ALREADY ON THE MACHINE.
  //
  // Playwright would rather download its own build of Chromium, and on 9 Sep
  // 2026 that download timed out on Fabio's connection - a 150MB fetch to run a
  // test that types a sentence. `channel: 'chrome'` drives the Chrome that is
  // already installed instead: nothing to download, nothing to keep up to date,
  // and it is the browser the team actually uses, which makes it the right one
  // to be testing in.
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
})
