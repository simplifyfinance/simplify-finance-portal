import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { STRAIGHT_THROUGH, TOO_BIG_FULL_STOP, mb } from './send-a-document-to-be-read'

// THE READING ROOM IS EMPTIED.
//
// 22 Nov 2026. Belle, uploading the unsigned and signed loan documents on a
// refinance, got this on both drop zones:
//
//     Unexpected token 'R', "Request En"... is not valid JSON
//
// "Request En" is "Request Entity Too Large". Vercel refuses a request body
// over 4.5 MB and answers in plain text; the screen called res.json() on it
// and showed the parser's complaint. The PDF was sent as base64, a third
// bigger than the file, so the real ceiling was about 3.3 MB of PDF - well
// under a signed loan document pack.
//
// Fabio chose to route a big file around Vercel: the browser puts it in the
// reading-room bucket and the reader picks it up. That bends a promise he made
// on 17 Nov 2026 - "we dont need to store the documents after reading" - so
// this file is the thing that holds the new version of it:
//
//     A DOCUMENT MAY PASS THROUGH THE READING ROOM. IT MAY NOT STAY THERE.
//
// Four separate things have to be true for that to hold, and all four are
// checked below.

const ROOM   = readFileSync('lib/the-reading-room.ts', 'utf8')
const SENDER = readFileSync('lib/send-a-document-to-be-read.ts', 'utf8')
const SQL    = readFileSync('docs/the-reading-room.sql', 'utf8')

const READERS = [
  'app/api/read-loan-contract/route.ts',
  'app/api/read-settlement-document/route.ts',
  'app/api/extract-fact-find/route.ts',
  'app/api/read-payslip/route.ts',
]

const DROPS = [
  'components/TheContracts.tsx',
  'components/TheOtherDocuments.tsx',
  'components/PayslipIncome.tsx',
  'app/(app)/deals/[id]/FactFindForm.tsx',
]

describe('1. the reader deletes what it read', () => {
  // THE WHOLE PROMISE IS THIS ONE WORD. A delete on the happy path only is a
  // delete that does not happen on the document that failed to read - which is
  // exactly the document somebody would most want gone.
  it('in a finally, so a document that could not be read goes too', () => {
    const take = ROOM.slice(ROOM.indexOf('export async function takeFromTheReadingRoom'))
    expect(take).toContain('} finally {')
    const fin = take.slice(take.indexOf('} finally {'))
    expect(fin, 'the delete is not inside the finally').toContain(".remove([clean])")
  })

  it('and it is the file it was given, not a guess', () => {
    expect(ROOM).toContain("from('reading-room').download(clean)")
  })
})

describe('2. a path from a browser is not trusted', () => {
  // The service role client is not bound by row level security, so a path of
  // "../deal-documents/something" would be a contract reader handing back a
  // client's filed documents. The shape is checked before anything is opened.
  it('the shape is checked first', () => {
    expect(ROOM).toContain('const SAFE =')
    const take = ROOM.slice(ROOM.indexOf('export async function takeFromTheReadingRoom'))
    expect(take.indexOf('SAFE.test'), 'checked after the download')
      .toBeLessThan(take.indexOf('.download('))
  })

  it('and the check refuses the ways out of the folder', () => {
    const SAFE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i
    const uid = '11111111-2222-3333-4444-555555555555'
    const name = '66666666-7777-8888-9999-000000000000'
    expect(SAFE.test(`${uid}/${name}.pdf`)).toBe(true)
    for (const bad of [
      `../deal-documents/${name}.pdf`,
      `${uid}/../../x.pdf`,
      `${uid}/${name}.pdf/../y.pdf`,
      `${uid}/${name}.exe`,
      '',
    ]) expect(SAFE.test(bad), `${bad} got through`).toBe(false)
  })
})

describe('3. nobody can read out of the bucket', () => {
  it('a person may put a file in their own folder and nothing else', () => {
    expect(SQL).toContain("bucket_id = 'reading-room'")
    expect(SQL).toContain('for insert to authenticated')
    expect(SQL).toContain("(storage.foldername(name))[1] = auth.uid()::text")
  })

  // A bucket you can read is a bucket somebody can be talked into reading out
  // of. There is deliberately no select policy and the SQL checks for one.
  it('and there is no policy that can read it', () => {
    expect(SQL).not.toContain('reading_room_read')
    expect(SQL).toContain('policies that can READ it')
  })

  it('the bucket is private', () => {
    expect(SQL).toContain("'reading-room', false")
  })
})

describe('4. and anything left behind is swept', () => {
  it('for the request that never reached the reader at all', () => {
    expect(SQL).toContain('sweep_the_reading_room')
    expect(SQL).toContain("interval '1 hour'")
  })

  it('which nobody signed in may run', () => {
    expect(SQL).toContain('revoke all on function public.sweep_the_reading_room() from anon, authenticated')
  })
})

// ---------------------------------------------------------------------------
// AND THE FAULT ITSELF DOES NOT COME BACK
// ---------------------------------------------------------------------------

describe('every reader takes the document the same way', () => {
  for (const path of READERS) {
    const SRC = readFileSync(path, 'utf8')
    it(`${path} reads it through documentFrom`, () => {
      expect(SRC).toContain('documentFrom(')
      expect(SRC, 'a body read straight off the request skips the reading room')
        .not.toContain('const { pdfBase64 } = await req.json()')
    })
    it(`${path} says so plainly when no document arrived`, () => {
      expect(SRC).toContain('ReadingRoomError')
    })
  }
})

describe('no drop zone reads an answer that may not be JSON', () => {
  // THE SECOND HALF OF WHAT BELLE SAW. A route that fails before our code runs
  // - a 413, a gateway timeout, a deploy mid-request - answers in text, and
  // res.json() turns that into "Unexpected token 'R'".
  for (const path of DROPS) {
    const SRC = readFileSync(path, 'utf8')
    it(`${path} goes through readAnswer`, () => {
      expect(SRC).toContain('readAnswer(res)')
      expect(SRC).toContain('sendToBeRead(file)')
    })
    it(`${path} no longer builds the base64 itself`, () => {
      expect(SRC, 'a second copy of the sending rule is a second thing to fix')
        .not.toContain('readAsDataURL(file)')
    })
  }
})

describe('what the sender does with a file of each size', () => {
  it('a small one still goes straight through, as it always has', () => {
    expect(STRAIGHT_THROUGH).toBe(3 * 1024 * 1024)
    const small = SENDER.slice(SENDER.indexOf('if (file.size <= STRAIGHT_THROUGH)'))
    expect(small.slice(0, 120)).toContain('pdfBase64')
  })

  it('the limit leaves room under Vercel once base64 has grown it', () => {
    // 4 bytes out for every 3 in, plus the JSON around it. This must stay
    // comfortably under 4.5 MB or the fault is simply back at a bigger number.
    expect((STRAIGHT_THROUGH * 4) / 3).toBeLessThan(4.4 * 1024 * 1024)
  })

  it('and a pack nobody should be sending is refused with its size said', () => {
    expect(TOO_BIG_FULL_STOP).toBeGreaterThan(STRAIGHT_THROUGH)
    expect(SENDER).toContain('is too big to read. Send the splits as separate files.')
  })

  it('a size is said in megabytes, not in bytes', () => {
    expect(mb(7_549_747)).toBe('7.2 MB')
    expect(mb(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})

describe('the answer a person reads when it goes wrong', () => {
  it('a 413 is said as a size, not as a parser error', () => {
    expect(SENDER).toContain('That file was too big to send')
    expect(SENDER).not.toContain('await res.json()')
  })

  it('a timeout says it was cut off', () => {
    expect(SENDER).toContain('took too long and was cut off')
  })

  it('and every one of them says nothing was recorded', () => {
    const whys = SENDER.match(/why: [`'][^`']+[`']/g) || []
    expect(whys.length).toBeGreaterThan(2)
    for (const w of whys) {
      expect(w, `${w} does not say whether anything was saved`)
        .toContain('Nothing has been recorded')
    }
  })
})
