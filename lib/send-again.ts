/**
 * SENDING IT AGAIN: THE CLIPBOARD BEFORE THE QUESTION.
 *
 * 30 Oct 2026. Fabio: the "Send again" button is not working.
 *
 * It was working. What was not working was the clipboard behind it.
 *
 * Both client emails are sent the same way: copy the wording, then open a
 * mailto, then paste. The copy is navigator.clipboard.write(), which a browser
 * only allows while a click is still "live" - what the standards call transient
 * user activation. A window.confirm() spends that activation: the dialog takes
 * the focus, and by the time somebody presses OK the click that opened it no
 * longer counts as permission to touch the clipboard.
 *
 * Send to client has no dialog, so it copies and works. Send again asks first,
 * so the write threw, the catch said "could not copy the email - nothing was
 * sent", and the button looked dead. Every time, on the one path that asks.
 *
 * SO THE COPY HAPPENS FIRST, on the click itself, and the question is asked
 * after. Nothing else moves: cancel still cancels, and a copy that genuinely
 * fails still stops the send rather than opening an empty email and marking the
 * deal as sent.
 */
export type SendAgain = 'send' | 'cancelled' | 'could-not-copy'

export async function copyBeforeAsking(
  copy: () => Promise<void>,
  ask: () => boolean,
): Promise<SendAgain> {
  let copied = true
  try {
    await copy()
  } catch {
    copied = false
  }
  // ASKED SECOND, AND STILL ASKED. Cancel means nothing happened - not a copy
  // that went ahead quietly, because the wording is now on their clipboard
  // either way and that is harmless, but no send and no record.
  if (!ask()) return 'cancelled'
  return copied ? 'send' : 'could-not-copy'
}
