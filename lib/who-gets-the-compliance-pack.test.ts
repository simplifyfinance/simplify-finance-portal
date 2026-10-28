import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// WHO GETS THE COMPLIANCE PACK IS ITS OWN QUESTION.
//
// 28 Oct 2026. One setting was doing two unrelated jobs, and nothing on the
// Settings page said so.
//
// "When a deal moves stage — who is asked to move the SalesTrekker card"
// decided four emails. Three are a chore: move the card to BC Actioned, to LO
// Actioned, to Compliance. The fourth is the push to SalesTrekker, carrying the
// Fact Find, the Handover and the Broker Notes - the compliance record of what
// went to credit that day, which has to be filed into the client's OneDrive
// folder.
//
// So the pack could not be pointed at one person without pointing every chore
// at them too. The pack for a live deal went to Ellie when it was meant for
// Ellesse, and the only way to find out why was to read the source.
//
// Fabio, 28 Oct 2026: "The settings is not very clear who is receiving what."
// And: "when a deal moves stage is one thing, and then when compliance is
// issued is a separate thing."
//
// This reads the two files rather than the database, because what went wrong
// was not a value - it was which value a line of code reached for.

const ROOT = join(__dirname, '..')
const ROUTE = readFileSync(join(ROOT, 'app', 'api', 'notify-salestrekker', 'route.ts'), 'utf8')
const SETTINGS = readFileSync(join(ROOT, 'app', '(app)', 'settings', 'SettingsClient.tsx'), 'utf8')
const SQL = readFileSync(join(ROOT, 'docs', 'compliance-pack-recipient.sql'), 'utf8')

describe('the two questions are asked separately', () => {
  it('finds the files at all', () => {
    // A test that silently reads nothing passes for ever and protects nothing.
    expect(ROUTE.length).toBeGreaterThan(5000)
    expect(SETTINGS.length).toBeGreaterThan(5000)
  })

  it('THE PACK IS SENT TO ITS OWN RECIPIENT, NOT TO WHOEVER MOVES THE CARD', () => {
    // The one line this whole change is about.
    expect(ROUTE).toContain("'Move this deal card to Compliance Issued', true, attachments, packEmail")
    expect(ROUTE).toContain('recipientName: packName')
  })

  it('and the card-moving emails still go to whoever moves the card', () => {
    // Splitting the pack off must not quietly redirect the chores as well.
    for (const chore of ['BC Actioned', 'LO Actioned', 'Compliance (to be actioned)']) {
      const line = ROUTE.split('\n').find(l => l.includes(chore) && l.includes('notifyCrisMoveCard'))
      expect(line, `no email found for "${chore}"`).toBeTruthy()
      expect(line!.includes('crisEmail'), `"${chore}" no longer goes to whoever moves the card`).toBe(true)
    }
  })

  it('the pack recipient is read from its own setting', () => {
    expect(ROUTE).toContain('compliance_issued_notification_user_id')
  })
})

describe('NOTHING CHANGES ON THE DAY IT SHIPS', () => {
  it('an unset pack recipient falls back to whoever moves the card', () => {
    // The column starts null on every database. If that meant "nobody", the
    // compliance pack would stop arriving the moment this shipped, and a
    // notification that silently stops is the worst kind of change.
    expect(ROUTE).toContain('let packEmail: string | null = crisEmail')
    expect(ROUTE).toContain('let packName: string | null = crisName')
  })

  it('and a person who has been removed does not send it nowhere', () => {
    expect(ROUTE).toContain('if (p?.email) { packEmail = p.email; packName = p.full_name || null }')
  })
})

describe('A COLUMN THE DATABASE HAS NOT GOT YET BREAKS NOTHING', () => {
  // Settings is one row. A field the database has never heard of takes every
  // other setting down with it - this already cost an afternoon on 2 Sep 2026
  // when the documents-received columns shipped before the migration was run.
  it('the route asks for the new column on its own', () => {
    // Naming it in the main select would fail that query, and every
    // notification on this route depends on it.
    const main = ROUTE.split('\n').find(l => l.includes("select('new_deal_notification_user_id"))!
    expect(main.includes('compliance_issued_notification_user_id'),
      'the new column is in the main select, so an un-migrated database loses every notification').toBe(false)
    expect(ROUTE).toMatch(/try \{[\s\S]{0,400}compliance_issued_notification_user_id/)
  })

  it('and Settings saves everything else when the column is missing', () => {
    expect(SETTINGS).toContain("'compliance_issued_notification_user_id'")
    expect(SETTINGS).toContain('DEFERRED')
  })

  it('and sends somebody to the right migration file, not just any of them', () => {
    expect(SETTINGS).toContain('docs/compliance-pack-recipient.sql')
    expect(SETTINGS).toContain('docs/docs-received-schema.sql')
  })

  it('and the migration itself is safe to run twice', () => {
    expect(SQL).toContain('add column if not exists compliance_issued_notification_user_id')
  })
})

describe('THE SETTINGS PAGE SAYS WHAT EACH LINE SENDS', () => {
  // The fault was never only in the code. Somebody read that page, chose a
  // person, and had no way to know they had just chosen who receives three
  // PDFs. Fabio: "we need to make sure there's some clarity around that."
  it('the new line names the three documents', () => {
    expect(SETTINGS).toContain('When compliance is issued — who receives the Fact Find, Handover and Broker Notes')
  })

  it('the card-moving line says it carries no documents', () => {
    expect(SETTINGS).toContain('No documents are attached to any of them.')
  })

  it('and blank says what blank does, rather than leaving it to be found out', () => {
    expect(SETTINGS).toContain('— same as whoever moves the card —')
    expect(SETTINGS).toContain('— nobody, the first person takes them all —')
  })

  // 28 Oct 2026, the same afternoon. One recipient became two and a number.
  // Fabio: "I need to be able to choose two people, not just one."
  it('THERE ARE TWO PEOPLE AND A NUMBER, AND THE PAGE SAYS WHICH IS WHICH', () => {
    expect(SETTINGS).toContain('First — the day starts here')
    expect(SETTINGS).toContain('Then — everything after that')
    expect(SETTINGS).toContain('Packs a day, first person')
  })

  it('and it says the count is working days only', () => {
    expect(SETTINGS).toMatch(/Monday to Friday[\s\S]{0,60}NSW public holidays/)
  })

  it('and that a deal pushed twice does not move', () => {
    expect(SETTINGS).toMatch(/pushed twice keeps whoever it already had/)
  })

  it('THE RULE ITSELF IS NOT WRITTEN OUT ON THE PAGE OR IN THE ROUTE', () => {
    // It lives in lib/compliance-allocation.ts, which is tested without a
    // database. A second copy of "five a day" anywhere is a second opinion.
    expect(SETTINGS).toContain("from '@/lib/compliance-allocation'")
    expect(ROUTE).toContain("from '@/lib/compliance-allocation'")
    expect(ROUTE).toContain('allocate({')
    expect(ROUTE).not.toMatch(/>=\s*5\b|===\s*5\b/)
  })

  it('and the pack email no longer copies the office', () => {
    // Fabio: "We do not need info to be CC'd on everything in that tab."
    expect(ROUTE).toContain('copyTheOffice: false')
  })

  it('and who got it is written on the deal, once', () => {
    expect(ROUTE).toContain('compliance_pack_user_id: packChosenId')
    // Re-stamping the date would move a deal into a later day and free a slot
    // in one that has already happened.
    expect(ROUTE).toMatch(/if \(!mine\?\.compliance_pack_user_id\)/)
  })
})
