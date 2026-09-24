// THE QUERY THAT WENT OUT WRONG EVERY TIME, AND SAID NOTHING.
//
// Fabio's console on staging, 24 Sep 2026:
//
//   Failed to load resource: the server responded with a status of 400
//   .../deals?select=...&fact_find_data=:applicants=cs.{[object Object]}
//
// `.contains()` given an ARRAY builds a Postgres array literal and puts every
// element through String(). An object becomes "[object Object]". A jsonb column
// needs the value as JSON TEXT.
//
// It was written on 23 September in two places and failed silently for a day,
// because both callers swallow their errors on purpose - this only draws a
// helpful line beside a deal name and must never interrupt anybody. So the only
// sign was a red line in a console nobody had open.
//
// This test builds the REAL query with the REAL client and reads the URL, so it
// fails the moment the filter stops being the thing Postgres wants.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { applicantIsClient } from './same-clients'

const db = createClient('https://example.supabase.co', 'anon-key')
const urlFor = (value: any) =>
  decodeURIComponent((db.from('deals').select('id')
    .contains('fact_find_data->applicants', value) as any).url.search).replace(/\+/g, ' ')

describe('finding a client inside the applicants', () => {
  it('asks Postgres for the JSON, not for the words "object Object"', () => {
    const url = urlFor(applicantIsClient('abc'))
    expect(url).toContain('cs.[{"clientId":"abc"}]')
    expect(url).not.toContain('object Object')
  })

  it('the old way really did produce that - this is not a theory', () => {
    const url = urlFor([{ clientId: 'abc' }])
    expect(url).toContain('[object Object]')
  })

  it('is a JSON string, because an array is what broke it', () => {
    expect(typeof applicantIsClient('abc')).toBe('string')
    expect(JSON.parse(applicantIsClient('abc'))).toEqual([{ clientId: 'abc' }])
  })
})

describe('nobody writes that filter by hand any more', () => {
  const files = ['components/useOtherDeals.ts', 'app/(app)/clients/[id]/page.tsx']
  for (const f of files) {
    it(`${f} builds it through the one function`, () => {
      const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8')
      expect(src).toContain('applicantIsClient')
      expect(src, 'an array is handed straight to contains() again')
        .not.toMatch(/contains\([^)]*,\s*\[\s*\{/)
    })
  }
})
