// AN UNLOCK THAT KEEPS COMING BACK LOCKED.
//
// 26 Nov 2026. Catherine, on a Macquarie deal changed the day after lodgement:
//
//   "I may need your help with the best way to do that as it kept locking"
//
// She was not doing anything wrong. The unlock lived in the deal page's memory
// and nowhere else, so anything that reloaded the page put the lock straight
// back - and plenty of things on a deal reload the page when they finish. From
// where she was standing the button simply did not hold.
//
// WHAT IT KEEPS, AND WHAT IT DELIBERATELY DOES NOT
//
// A reload is the same person, in the same tab, in the middle of the same piece
// of work. Leaving the deal is not. So this is sessionStorage - it dies with
// the browser tab - and the deal page clears it when it unmounts, which is what
// navigating away does. A reload does not unmount anything, so the unlock
// survives exactly the case it was failing.
//
// THE PROMISE ON SCREEN STILL HOLDS: "unlocks every tab on this deal, and
// re-locks when you leave it." It just also holds when you did not leave.
//
// PER DEAL, NEVER GLOBAL. Unlocking one lodged deal must not quietly unlock the
// next one somebody opens.
//
// Every call is wrapped: sessionStorage throws in a private window and in some
// locked-down browsers, and a deal page that will not render because of a lock
// preference is worse than a deal that re-locks.

const KEY = 'deal-unlocked:'

export function unlockKey(dealId: string): string {
  return KEY + String(dealId || '')
}

export function rememberUnlock(dealId: string, store?: Storage): void {
  if (!dealId) return
  try {
    const s = store || (typeof sessionStorage !== 'undefined' ? sessionStorage : null)
    s?.setItem(unlockKey(dealId), '1')
  } catch { /* a browser that will not store it simply re-locks */ }
}

export function unlockIsRemembered(dealId: string, store?: Storage): boolean {
  if (!dealId) return false
  try {
    const s = store || (typeof sessionStorage !== 'undefined' ? sessionStorage : null)
    return s?.getItem(unlockKey(dealId)) === '1'
  } catch {
    return false
  }
}

export function forgetUnlock(dealId: string, store?: Storage): void {
  if (!dealId) return
  try {
    const s = store || (typeof sessionStorage !== 'undefined' ? sessionStorage : null)
    s?.removeItem(unlockKey(dealId))
  } catch { /* nothing to do - it was never stored */ }
}
