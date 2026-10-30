const txt = (v: unknown) => String(v ?? '').trim()

/**
 * WHOSE DEAL IS THIS, BEFORE ANYBODY HAS SAID?
 *
 * 29 Oct 2026. Fabio, on a deal that went out under the wrong name: "all deals
 * created are still picking up Mark as the broker and not who the broker is
 * when the deal is created, we need to keep changing it."
 *
 * It was not Mark. It was whoever was signed in. The New deal box opened with
 * the creator's OWN name already in it, and the Create button is only disabled
 * while that box is empty - so for an admin it was never disabled, and one
 * click filed the deal under the person making it. Two in two days: Patrick
 * Cleary under Fabio, the Emma White one under Mark. The fortnight's book read
 * 418 fabio, 20 mark, 11 justin, which is not a book, it is a list of who was
 * signed in.
 *
 * A BROKER IS THE ONE EXCEPTION, and the only one. A broker making a deal is
 * making their own: no dropdown is drawn for them and their own name is right.
 *
 * EVERYBODY ELSE IS ASKED. Admins - and that is Fabio, Kylie, Alan and Mark -
 * make deals that belong to other people, so the answer cannot be assumed from
 * the login. The guard that makes them answer has been there all along; it was
 * simply never reached, because the box was never empty.
 *
 * The rule this restores is written four lines above it in the form itself:
 * "An unassigned deal is visible and fixable; one quietly filed under the wrong
 * broker is neither."
 */
export function brokerToStartWith(userRole: unknown, brokerKey: unknown): string {
  return txt(userRole) === 'broker' ? txt(brokerKey) : ''
}
