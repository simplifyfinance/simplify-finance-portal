// THE FILE WRITES ITSELF.
//
// 29 Oct 2026. Catherine, Operations Manager, item 6: keep a record of our
// conversations with clients. Fabio: "think of an idea where the file notes is
// automatically updated with our emails sent to client this for compliance".
//
// THE LOG ALREADY EXISTED AND I ALMOST BUILT A SECOND ONE. public.deal_notes
// has been append-only, dated and signed since September, and the box on the
// right of every deal - File update - has always been it. What was missing was
// not a place to put things. It was entries: the only three things that ever
// wrote to it were a send-back, a move-back and a tab unlock.
//
// Fabio caught that before a line was written: "I still want to make sure we're
// not double handling the file update box to the file notes." This file is so
// a second log cannot appear later.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const BC = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
const LO = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
const PROCEED = readFileSync('lib/proceed-flow.ts', 'utf8')
const ANSWERS = readFileSync('lib/answers-flow.ts', 'utf8')
const FILE = readFileSync('components/DealFile.tsx', 'utf8')
const SERVER = readFileSync('lib/file-note.ts', 'utf8')
const TEXT = readFileSync('lib/email-as-text.ts', 'utf8')

const codeOnly = (src: string) =>
  src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

describe('there is one log, and it is the one that was already there', () => {
  it('everything writes to deal_notes', () => {
    expect(FILE).toContain("from('deal_notes')")
    expect(SERVER).toContain("from('deal_notes')")
  })

  it('AND NOBODY INVENTED A SECOND TABLE', () => {
    for (const [name, src] of [['the BC', BC], ['the LO', LO], ['proceed', PROCEED],
                               ['answers', ANSWERS], ['the server helper', SERVER]] as const) {
      for (const invented of ['file_notes', 'deal_file_notes', 'contact_log', 'deal_activity']) {
        expect(codeOnly(src), `${name} writes to a second log called ${invented}`)
          .not.toContain(invented)
      }
    }
  })

  it('the box keeps its name and its promise', () => {
    // Fabio named these on 22 Oct and lib/three-boxes-in-order.test.ts holds
    // the names. This one holds the sentence under the heading.
    expect(FILE).toContain('🕐 File update')
    expect(FILE).toContain('The log. Nothing here can be typed over, and the portal writes to it as well.')
  })
})

describe('an email going out writes a line', () => {
  it('the borrowing capacity does', () => {
    expect(BC).toContain('addSystemNote(deal.id,')
    expect(BC).toContain('Borrowing capacity emailed to')
  })

  it('the lending options does', () => {
    expect(LO).toContain('addSystemNote(deal.id,')
    expect(LO).toContain('Lending options emailed to')
  })

  it('and it carries the wording, not the web page', () => {
    // Fabio: "I don't like the idea of storage. So is there a way to make the
    // HTML just wording, structured word?"
    for (const [name, src] of [['the BC', BC], ['the LO', LO]] as const) {
      expect(src, `${name} does not record what was sent`).toContain('sentEmailAsText({')
      expect(codeOnly(src), `${name} is putting raw HTML in the file note`)
        .not.toMatch(/addSystemNote\([^)]*emailHtml\s*\)/)
    }
  })

  it('AFTER the write that matters, and never in its way', () => {
    // A log that can stop a client being emailed is a worse problem than a
    // missing line.
    for (const [name, src] of [['the BC', BC], ['the LO', LO]] as const) {
      const at = src.indexOf('addSystemNote(deal.id,')
      const save = src.indexOf('.update(updates).eq(')
      expect(save, `${name} has no save to be after`).toBeGreaterThan(-1)
      expect(at, `${name} writes the note before the deal is saved`).toBeGreaterThan(save)
      const block = src.slice(at - 400, at)
      expect(block, `${name} does not swallow a failed note`).toContain('try {')
    }
  })
})

describe('what the client did writes a line too', () => {
  it('pressing Proceed, and whether they pressed it or we recorded it', () => {
    // Not the same fact, and a reviewer will want to know which.
    expect(PROCEED).toContain('Client agreed to proceed on the borrowing capacity')
    expect(PROCEED).toContain('Client agreed to proceed on the lending options')
    expect(PROCEED).toContain('Recorded by')
    expect(PROCEED).toContain('from the email.')
  })

  it('on BOTH branches, not just the one that was tested', () => {
    // Written once and called twice. The borrowing capacity branch and the
    // lending options branch are separate blocks a hundred and ten lines
    // apart, which is exactly how one of them gets a fix and the other does
    // not - see the LO send that was never given the BC's await.
    expect(PROCEED).toContain("const noteTheyAgreed = async (what: 'BC' | 'LO')")
    expect((PROCEED.match(/await noteTheyAgreed\(/g) || []).length).toBe(2)
    expect(PROCEED).toContain("await noteTheyAgreed('BC')")
    expect(PROCEED).toContain("await noteTheyAgreed('LO')")
  })

  it('and answering the questions on the client page', () => {
    expect(ANSWERS).toContain('through the client link.')
    expect(ANSWERS).toContain('fileNote(')
  })
})

describe('a file note can never break the thing it is recording', () => {
  it('the server helper swallows everything', () => {
    expect(SERVER).toContain('catch')
    expect(SERVER).toContain('Promise<void>')
    expect(SERVER, 'fileNote throws, so a client button press can fail on a log line')
      .not.toContain('throw')
  })

  it('and it writes with the key that does not need a login', () => {
    // A client pressing Proceed has no session. This is the same lesson as
    // lib/the-client-pages-work-logged-out.test.ts, one table along.
    expect(SERVER).toContain('createSupabaseAdmin()')
  })
})

describe('the wording, not the web page', () => {
  it('is built from the email that was actually sent', () => {
    // Not rebuilt from the deal's own figures. That would be a second copy of
    // what the email says and the two would drift the first time one of the
    // twenty-two templates changed.
    expect(TEXT).toContain('export function emailAsText')
    expect(TEXT).toContain('export function sentEmailAsText')
  })

  it('and the hour is Melbourne, not the server', () => {
    // The server is in UTC. An email sent at 11:31 in the morning went into the
    // file as 12:31am the day before.
    expect(TEXT).toContain("timeZone: 'Australia/Melbourne'")
  })

  it('the rail can open it, folded away by default', () => {
    expect(FILE).toContain('Show what was sent')
    expect(FILE).toContain('n.detail && <SentWording')
  })
})
