import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { copyBeforeAsking } from './send-again'

// THE "SEND AGAIN" BUTTON DID NOTHING.
//
// 30 Oct 2026. Fabio: "Send again button not working."
//
// The button was fine. The clipboard behind it was not. Both client emails are
// sent by copying the wording, opening a mailto and pasting - and the copy is
// navigator.clipboard.write(), which a browser allows only while the click is
// still live. A window.confirm() spends that: the dialog takes the focus, and
// by the time somebody presses OK the click no longer counts as permission.
//
// Send to client has no dialog and works. Send again asks first, so the write
// threw, the catch said "could not copy the email - nothing was sent", and the
// button looked dead. Every time, on the one path that asks.

const BC = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
const LO = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

const ok = () => Promise.resolve()
const fails = () => Promise.reject(new Error('NotAllowedError'))

describe('THE COPY HAPPENS BEFORE THE QUESTION', () => {
  it('and the order is that way round', async () => {
    const seen: string[] = []
    await copyBeforeAsking(
      async () => { seen.push('copy') },
      () => { seen.push('ask'); return true })
    expect(seen).toEqual(['copy', 'ask'])
  })

  it('a yes sends', async () => {
    expect(await copyBeforeAsking(ok, () => true)).toBe('send')
  })

  it('and a no sends nothing', async () => {
    expect(await copyBeforeAsking(ok, () => false)).toBe('cancelled')
  })

  it('AND A COPY THAT GENUINELY FAILS STILL STOPS IT', async () => {
    // Rather than opening an empty email and marking the deal as sent.
    expect(await copyBeforeAsking(fails, () => true)).toBe('could-not-copy')
  })

  it('and a no beats a failed copy, because nothing happened either way', async () => {
    expect(await copyBeforeAsking(fails, () => false)).toBe('cancelled')
  })

  it('and it never throws, whatever the clipboard does', async () => {
    await expect(copyBeforeAsking(fails, () => true)).resolves.toBeDefined()
  })
})

describe('AND BOTH EMAILS ASK IT THE SAME WAY', () => {
  it.each([['BCForm.tsx', BC], ['LOForm.tsx', LO]])('%s', (_name, src) => {
    expect(src).toContain('copyBeforeAsking(copyEmailToClipboard')
    expect(src, 'the dialog is back in front of the clipboard')
      .not.toMatch(/if \(confirm\('Send this email to the client again\?/)
  })

  it('and the send knows the copy already happened', () => {
    expect(BC).toContain('async function sendToClient(preCopied = false)')
    expect(BC).toContain('if (!preCopied) await copyEmailToClipboard()')
    expect(LO).toContain('async function sendEmail(preCopied = false)')
    expect(LO).toContain('if (!preCopied) await copyEmailToClipboard()')
  })

  it('AND THE FIRST SEND IS UNTOUCHED', () => {
    // It has no dialog, so it never had the fault. It still copies.
    expect(BC).toContain('if (bcCompletedAt) { sendToClient(); return }')
  })
})
