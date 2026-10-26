import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE BOOK LIVES IN REPORTS AND NOWHERE ELSE.
//
// Fabio, 19 Oct 2026, with the import mapped and one press away from writing
// 656 rows: "This is just a reports tab. All I need is the name of the client,
// the property address, the loan amount, the LVR, the security address. I will
// then do everything outside the portal... and if it is an opportunity I will
// drag that client into a brand new deal card. I will upload the fact find to
// make sure we create the assets and liabilities position."
//
// The import was built the other way - 656 rows straight into `clients`, each
// carrying a position_properties built from the spreadsheet. Two faults, and
// the second is the one that matters:
//
//   1. The Clients page and both client pickers go from hundreds of rows to
//      over a thousand, for people who are not clients.
//
//   2. On anyone the portal ALREADY had, the update overwrote their
//      position_properties with values-at-settlement out of a ten year old CRM
//      export. That is the figure the client list exists to show, and a fact
//      find is the only thing that should ever write it.
//
// Neither is a thing a comment can prevent, so this is a test.

const importer = readFileSync('components/BookImport.tsx', 'utf8')

// Comments are not code - the email HTML gate learned that on 29 September
// when it failed a ship over an rgba() inside a comment explaining rgba().
const code = importer
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, ' '))

describe('the import never touches the clients table', () => {
  it('writes to no table but the review and its properties', () => {
    const tables = [...code.matchAll(/\.from\('([^']+)'\)/g)].map(m => m[1])
    expect([...new Set(tables)].sort()).toEqual(
      ['book_imports', 'portfolio_review_properties', 'portfolio_reviews'])
  })

  it('does not write a client row, an update or an insert', () => {
    expect(code, 'the book import is writing into clients again').not.toMatch(/from\('clients'\)/)
  })

  // THE ONE THAT COST A CLIENT'S REAL POSITION. A fact find writes this
  // column. A spreadsheet of settlement-date figures does not.
  it('never writes an asset position anywhere', () => {
    for (const field of ['position_properties', 'position_source', 'position_updated_at',
                         'position_liabilities', 'position_assets']) {
      expect(code, `the book import is writing ${field}`).not.toContain(field)
    }
    expect(code, 'positionProperties is still being built from the book')
      .not.toMatch(/positionProperties/)
  })

  it('leaves a review that is already on the list where it got to', () => {
    // The update after a second drop of the same file carries the book's own
    // fields and nothing else - not the status, not the figures, not the
    // dates somebody has been working to.
    const update = code.slice(code.indexOf("from('portfolio_reviews')\n            .update("))
    const first = update.slice(0, update.indexOf('.select('))
    // 26 Oct 2026: the reason and the note joined this list the day they were
    // built. They are typed by a person at the end of a conversation, which
    // makes them exactly the kind of thing a re-drop of the spreadsheet must
    // never quietly replace.
    for (const worked of ['status', 'figures_date', 'next_review_date', 'reviewed_at',
                          'outcome', 'linked_deal_id', 'email_sent_at', 'internal_notes',
                          'outcome_reason', 'outcome_note', 'closed_at']) {
      expect(first, `a re-import would overwrite ${worked}`).not.toContain(worked)
    }
  })

  it('keeps the valuations somebody looked up by hand', () => {
    // The properties are replaced on a re-import so a sold house can come off.
    // The hand-done columns are carried across, matched on the address -
    // losing an afternoon of valuations to a re-drop is not acceptable.
    for (const kept of ['estimated_current_value', 'valuation_source', 'valuation_date',
                        'usable_equity']) {
      expect(code, `${kept} is not carried across a re-import`).toContain(`kept.${kept}`)
    }
  })
})

describe('the list does not pretend a book row is a client', () => {
  const list = readFileSync('components/PortfolioReview.tsx', 'utf8')

  it('only links to a client page when there is a client', () => {
    expect(list, 'a book row would link to /clients/null')
      .not.toMatch(/href=\{`\/clients\/\$\{r\.client_id\}`\}/)
    expect(list).toContain('r.client_id ? `/clients/${r.client_id}` : null')
  })
})

describe('the schema lets a review stand on its own', () => {
  const sql = readFileSync('docs/portfolio-review-stands-alone.sql', 'utf8')

  it('drops the not null on every client_id the book would have filled', () => {
    for (const t of ['portfolio_reviews', 'portfolio_review_properties',
                     'portfolio_review_contacts']) {
      expect(sql, `${t}.client_id still demands a client`)
        .toMatch(new RegExp(`alter table public\\.${t}\\s+alter column client_id drop not null`))
    }
  })

  it('carries the name on the review instead', () => {
    for (const col of ['book_name', 'book_first_name', 'book_last_name', 'book_row_key']) {
      expect(sql).toContain(col)
    }
  })

  // An inner join is what would have made every book-only review invisible -
  // the whole list, empty, with nothing saying why.
  it('reads the client with a left join, so a review with none still shows', () => {
    expect(sql).toMatch(/left join public\.clients c on c\.id = r\.client_id/)
    expect(sql).not.toMatch(/\n *join public\.clients/)
  })

  it('makes a second import an update rather than 656 more rows', () => {
    expect(sql).toMatch(/create unique index if not exists portfolio_reviews_book_row_key_idx/)
  })
})
