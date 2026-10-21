import { describe, it, expect } from 'vitest'
import { existsSync, statSync } from 'fs'
import { ENTRIES, entryEmailHtml, isShot, shotPath, type Block, type Shot } from './knowledge-base'
import { siteUrl } from './site-url'

// A BROKEN IMAGE IN THE TEAM'S INBOX.
//
// 21 Oct 2026, Fabio: "I need images too mcuh words quick sanppy images showing
// where things are". The pictures are the point of the entry now - "under
// Deposit paid" is four words somebody has to translate into a place on a
// screen. So a missing file is not cosmetic: it is the entry failing at the one
// job it was rewritten to do, in front of the whole team, after it has been
// sent and cannot be taken back.
//
// Nothing here renders anything. It checks the file is there and that the email
// points at a real address.

function shotsIn(blocks: Block[]): Shot[] {
  const out: Shot[] = []
  const eat = (b: Block) => {
    if (isShot(b)) out.push(b)
    else if (b && typeof b === 'object' && !Array.isArray(b) && 'step' in b) b.body.forEach(eat)
  }
  blocks.forEach(eat)
  return out
}

const all = ENTRIES.flatMap(e => shotsIn(e.body).map(s => [e.id, s] as const))

describe('every picture in the knowledge base is really there', () => {
  it('finds the file in public/kb', () => {
    for (const [id, s] of all) {
      const file = `public${shotPath(s.shot)}`
      expect(existsSync(file), `${id}: ${s.shot} is not in public/kb`).toBe(true)
      // A nought byte file uploads clean and renders as a broken image.
      expect(statSync(file).size, `${id}: ${s.shot} is empty`).toBeGreaterThan(1000)
    }
  })

  it('and every picture says what it is a picture of', () => {
    for (const [id, s] of all) {
      expect(s.caption.trim().length, `${id}: ${s.shot} has no caption`).toBeGreaterThan(4)
    }
  })
})

describe('the email version survives somebody’s inbox', () => {
  const withShots = ENTRIES.filter(e => shotsIn(e.body).length > 0)

  it('gives every image an absolute address', () => {
    // A relative src in an inbox points at Outlook, not at the portal.
    for (const e of withShots) {
      const html = entryEmailHtml(e)
      for (const s of shotsIn(e.body)) {
        expect(html, `${e.id}: ${s.shot} is not in the email`)
          .toContain(`${siteUrl()}${shotPath(s.shot)}`)
      }
      expect(html, `${e.id} has a relative image src`).not.toMatch(/src="\/kb\//)
    }
  })

  it('carries alt text, because images are blocked by default in Outlook', () => {
    for (const e of withShots) {
      const html = entryEmailHtml(e)
      for (const s of shotsIn(e.body)) expect(html).toContain(`alt="${s.caption}"`)
    }
  })

  it('and the offer accepted entry carries all five', () => {
    const e = ENTRIES.find(x => x.id === 'offer-accepted')!
    expect(shotsIn(e.body).map(s => s.shot)).toEqual([
      'offer-accepted-loan-now.png',
      'offer-accepted-tell-the-client.png',
      'offer-accepted-what-you-answer.png',
      'offer-accepted-email.png',
      'offer-accepted-handover.png',
    ])
  })
})
