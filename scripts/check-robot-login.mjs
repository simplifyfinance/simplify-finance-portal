// IS THE ROBOT STILL SIGNED IN? ASK BEFORE SPENDING EIGHT MINUTES FINDING OUT.
//
// 15 Nov 2026, and this has now cost two evenings.
//
// 13 Nov: every browser test failed. I blamed a fetch wrapper I had written
// that day, removed it, and watched them fail again. The real cause was
// .auth/portal.json holding a refresh token that Supabase had stopped
// accepting. The browser check had not genuinely run in two weeks.
//
// 14 Nov: Fabio signed out of the portal to test the Forgot password link.
// Supabase revoked every refresh token for that user - including the robot's,
// which signs in as him. The next ship passed every code check, every one of
// 8,301 tests and the build, then sat in the browser step for thirty-four
// minutes failing all 42 tests and retrying them. The server log said it in
// one line the whole time:
//
//     AuthApiError: Invalid Refresh Token: Refresh Token Not Found
//
// WHY IT TAKES SO LONG TO SAY SO. Every test waits for [data-ready="1"] on a
// deal card. Signed out, the page draws perfectly and that marker never comes,
// so each test burns its full thirty second timeout and is then retried. The
// failure looks like forty-two broken features. It is one dead token.
//
// So: one page load, about five seconds, before any of that. If the saved
// session cannot reach the portal, say so in words that name the fix.
//
// IT DOES NOT TOUCH THE SESSION. No sign-in, no password, no writing to
// .auth/portal.json. It opens one page with the saved state and reads the
// address it lands on. Supabase rotates refresh tokens on use, so taking a
// copy of the context and letting it write back would be a way to corrupt the
// very thing it is checking.
import { chromium } from '@playwright/test'
import { statSync } from 'fs'

const URL = process.env.PORTAL_TEST_URL || 'http://localhost:3100'
const STATE = '.auth/portal.json'

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ storageState: STATE })
const page = await context.newPage()

let landed = ''
let trouble = ''
try {
  // 45 seconds, not 20. The server was started moments ago and /dashboard is
  // the heaviest page in the portal - it reads the whole book. A cold first
  // render is slow, and timing that out would fail a ship for a reason that
  // has nothing to do with being signed in.
  await page.goto(`${URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  // The portal decides where a signed-out visitor goes on the client, after the
  // first paint, so the address immediately after domcontentloaded is not the
  // answer yet.
  await page.waitForTimeout(2500)
  landed = page.url()
} catch (e) {
  trouble = String(e?.message || e)
}
await browser.close()

// IT FAILS THE SHIP FOR ONE REASON ONLY: the portal sent the saved session to
// the login page. That is unambiguous, and it is the fault this exists to
// catch.
//
// ANYTHING ELSE AND IT STANDS ASIDE. A slow page, a flake, a changed address -
// none of those prove the robot is signed out, and a gate that fails on things
// it has not proved is a gate somebody starts ignoring. The 42 tests behind it
// are still there to catch a real fault; this only ever saves time.
if (trouble) {
  console.log(`  (could not check the robot's login: ${trouble.split('\n')[0]})`)
  console.log('  (carrying on - the browser tests will say if something is wrong)')
  process.exit(0)
}

if (!/\/login/.test(landed)) {
  process.exit(0)
}

// HOW OLD THE SAVED SESSION IS. Not proof of anything on its own - a token can
// die an hour after it was written - but it is the first thing anybody asks.
let age = ''
try {
  const days = Math.floor((Date.now() - statSync(STATE).mtimeMs) / 86_400_000)
  age = days === 0 ? 'saved today' : days === 1 ? 'saved yesterday' : `saved ${days} days ago`
} catch { age = 'unknown age' }

console.error('')
console.error('  THE ROBOT IS NOT SIGNED IN.')
console.error('')
console.error(`  ${STATE} (${age}) no longer gets into the portal.`)
console.error(`  It landed on: ${landed}`)
console.error('')
console.error('  Nothing is wrong with the code. The browser check would have')
console.error('  failed all 42 tests on a thirty second timeout each, which takes')
console.error('  half an hour and looks like forty-two broken features.')
console.error('')
console.error('  Fix it:   ./scripts/portal-login.sh')
console.error('')
console.error('  This happens when somebody signs out of the portal, resets')
console.error('  their sign-in, or the saved token simply expires. Supabase')
console.error('  revokes every token for a user at once, so signing yourself')
console.error('  out signs the robot out too.')
console.error('')
process.exit(1)
