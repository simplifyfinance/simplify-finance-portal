import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { COPY_BLOCKS, DEFAULT_COPY, DEFAULT_DISCLAIMER, blockText, isDefaultText,
         copyToStore, reviewEmailHtml } from './portfolio-review-email'
import { SETTINGS_PANES } from './settings-panes'

// THE WORDING IS HIS, SO HE CAN CHANGE IT.
//
// 19 Oct 2026 Fabio agreed every line of the opportunity email, three rewrites
// deep on the opener alone and four on the gearing paragraph. Then the only
// way to change a word of it was to ask me. The email has accepted an override
// since the day it shipped - ReviewFigures reads settings.portfolio_review_copy
// - and nothing ever wrote one.

describe('what can be reworded, and what cannot', () => {
  it('offers every editable block the email has, and no others', () => {
    const keys = COPY_BLOCKS.map(b => b.key).sort()
    expect(keys).toEqual(Object.keys(DEFAULT_COPY).sort())
  })

  // THE RULE THE EMAIL WAS BUILT ON. A template that can hold a figure is a
  // template that sends one wrong figure to 656 people.
  it('holds no figure anywhere in the defaults', () => {
    for (const b of COPY_BLOCKS) {
      const text = blockText({}, b)
      expect(text, `${b.key} carries a dollar figure`).not.toMatch(/\$\s?[\d,]/)
    }
  })

  // The licence line and the estimates disclaimer are what makes this email
  // legal to send. They are not wording anybody rewords between reviews.
  it('leaves the compliance tail out of reach', () => {
    expect(COPY_BLOCKS.map(b => String(b.key))).not.toContain('disclaimer')
    expect(DEFAULT_DISCLAIMER).toContain('not an approval or offer of credit')
    const html = reviewEmailHtml({
      greeting: 'Ruth', equityAddress: '1 Example St', purchasePrice: '520000',
      stampDuty: '28000', loanAmount: '385000', loanNote: '', equityRelease: '130000',
      savings: '33000', buffer: '20000', brokerName: 'Fabio', calendlyUrl: '#',
      copy: { opening: 'Anything at all.' },
    } as any)
    expect(html).toContain('not an approval or offer of credit')
  })
})

describe('what gets stored', () => {
  const asForm = (over: Record<string, string> = {}) => {
    const f: Record<string, string> = {}
    for (const b of COPY_BLOCKS) f[b.key] = blockText({}, b)
    return { ...f, ...over }
  }

  // Saving all fourteen would freeze today's words into the database, so a
  // default improved in code later would never reach him - he would be reading
  // his own copy of the old wording and wondering why nothing changed.
  it('stores nothing at all when nothing was changed', () => {
    expect(copyToStore(asForm())).toEqual({})
  })

  it('stores only the block that was actually changed', () => {
    const out = copyToStore(asForm({ opening: 'A different opening line.' }))
    expect(out).toEqual({ opening: 'A different opening line.' })
  })

  // Clearing a box plainly means "go back to the default". A genuinely empty
  // block would print a gap in a client's email with nothing explaining it.
  it('treats an emptied box as back to the default, not as a blank paragraph', () => {
    expect(copyToStore(asForm({ opening: '   ' }))).toEqual({})
  })

  it('splits a list on lines and drops the blank ones', () => {
    const out = copyToStore(asForm({ whyNowBullets: 'One thing.\n\n  Two things.  \n' }))
    expect(out.whyNowBullets).toEqual(['One thing.', 'Two things.'])
  })

  it('reads a stored list back onto the screen one per line', () => {
    const b = COPY_BLOCKS.find(x => x.key === 'whyNowBullets')!
    expect(blockText({ whyNowBullets: ['A.', 'B.'] }, b)).toBe('A.\nB.')
    expect(isDefaultText('A.\nB.', b)).toBe(false)
  })

  it('falls back to the default for a block nobody has touched', () => {
    const b = COPY_BLOCKS.find(x => x.key === 'strategy')!
    expect(blockText({ opening: 'changed' }, b)).toBe(DEFAULT_COPY.strategy)
    expect(isDefaultText(blockText({}, b), b)).toBe(true)
  })

  // The saved wording has to actually reach the email, or this screen is a
  // box that swallows what he types.
  it('reaches the email that goes to the client', () => {
    const html = reviewEmailHtml({
      greeting: 'Ruth', equityAddress: '1 Example St', purchasePrice: '520000',
      stampDuty: '28000', loanAmount: '385000', loanNote: '', equityRelease: '130000',
      savings: '33000', buffer: '20000', brokerName: 'Fabio', calendlyUrl: '#',
      copy: copyToStore(asForm({ ctaLabel: 'BOOK A CALL WITH ME' })),
    } as any)
    expect(html).toContain('BOOK A CALL WITH ME')
    expect(html).not.toContain('BOOK MY PORTFOLIO REVIEW')
  })
})

describe('the screen is reachable', () => {
  // 30 Sep 2026: the rate notice page existed, worked, and was in no menu.
  it('is in the settings menu, not just at a URL', () => {
    expect(SETTINGS_PANES.some(p => p.key === 'review-email')).toBe(true)
  })

  it('is drawn on the settings page', () => {
    const page = readFileSync('app/(app)/settings/SettingsClient.tsx', 'utf8')
    expect(page).toContain("pane === 'review-email'")
    expect(page).toContain('<ReviewEmailCopy />')
  })

  // RLS refuses a write by returning no rows and no error.
  it('checks that the save actually saved', () => {
    const c = readFileSync('components/ReviewEmailCopy.tsx', 'utf8')
    expect(c).toContain("if (error || !data?.length)")
    expect(c).toContain('nothing was changed')
  })

  // Nobody's real figures belong on a settings page.
  it('previews with invented figures, never a real client', () => {
    const c = readFileSync('components/ReviewEmailCopy.tsx', 'utf8')
    expect(c).toContain('Example Ave')
    expect(c).not.toContain('portfolio_review_list')
  })
})
