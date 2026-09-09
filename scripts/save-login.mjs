// SIGN IN ONCE, BY HAND.
//
// Fabio, 9 Sep 2026: "i rather just log inn when we need does that work?"
//
// Yes, and it is the better answer. No password sits in a file for the robot to
// read: a Chrome window opens, a person signs in the way they always do, and the
// signed-in session is saved. The robot reuses that until it expires, and then
// somebody signs in again. Nothing that could be typed into a chat is ever
// written down.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'

const URL = process.env.PORTAL_TEST_URL || 'http://localhost:3100'

const browser = await chromium.launch({ channel: 'chrome', headless: false })
const context = await browser.newContext()
const page = await context.newPage()

console.log('\nA Chrome window is opening. Sign in to the portal as you normally would.')
console.log('It will save itself and close the moment you are through.\n')

await page.goto(URL)
// ANYTHING THAT IS NOT THE LOGIN PAGE.
//
// This waited for "/deals" and the portal signs people in to "/dashboard" - so
// on 9 Sep 2026 Fabio logged in perfectly and the script sat there waiting for
// a page he was never going to be sent to. Where somebody lands after signing
// in is a product decision that will change again; "they are no longer on the
// login screen" will not.
await page.waitForURL(u => !/\/login/.test(u.toString()), { timeout: 300_000 })
// The session is held in the browser's own storage, so it has to be read after
// the app has settled rather than the instant the address changes.
await page.waitForTimeout(2500)

mkdirSync('.auth', { recursive: true })
await context.storageState({ path: '.auth/portal.json' })
await browser.close()

console.log('Signed in and saved. The browser check will use this from now on.')
console.log('If it ever stops working, run this again.\n')
