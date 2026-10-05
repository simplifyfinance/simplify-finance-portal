import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { isNewer, BUILD, CHECK_MS, VERSION_URL } from './new-version'

// A WRONG "YES" IS WORSE THAN A MISSED "NO".
//
// Telling somebody mid-deal to reload for nothing is the one way this feature
// can make the portal worse than it was. So every uncertain answer has to come
// back false, and these are the uncertain answers.
describe('is the version on screen out of date', () => {
  it('yes, when the deployed build is a different one', () => {
    expect(isNewer('abc123', 'def456')).toBe(true)
  })

  it('no, when it is the same build', () => {
    expect(isNewer('abc123', 'abc123')).toBe(false)
  })

  it('no, when the answer never came', () => {
    expect(isNewer('abc123', undefined)).toBe(false)
    expect(isNewer('abc123', null)).toBe(false)
  })

  it('no, when the answer was not a word', () => {
    expect(isNewer('abc123', { build: 'def' })).toBe(false)
    expect(isNewer('abc123', 42)).toBe(false)
  })

  it('no, when either side is blank', () => {
    expect(isNewer('abc123', '')).toBe(false)
    expect(isNewer('', 'def456')).toBe(false)
    expect(isNewer('abc123', '   ')).toBe(false)
  })

  it('no, on a laptop - nothing is deployed there', () => {
    expect(isNewer('dev', 'abc123')).toBe(false)
    expect(isNewer('abc123', 'dev')).toBe(false)
  })
})

describe('the parts that have to agree with each other', () => {
  it('the route that answers is the one the page asks', () => {
    expect(VERSION_URL).toBe('/api/version')
    const route = readFileSync('app/api/version/route.ts', 'utf8')
    expect(route).toContain("import { BUILD } from '@/lib/new-version'")
    expect(route).toContain('build: BUILD')
    // It must never be cached, or it would answer with yesterday's build.
    expect(route).toContain("export const dynamic = 'force-dynamic'")
    expect(route).toContain('no-store')
  })

  it('the build stamp is put there by the build, not typed in', () => {
    const cfg = readFileSync('next.config.ts', 'utf8')
    expect(cfg).toContain('NEXT_PUBLIC_BUILD_ID')
    expect(cfg).toContain('VERCEL_GIT_COMMIT_SHA')
  })

  it('it asks often enough to be useful and rarely enough to be free', () => {
    expect(CHECK_MS).toBeGreaterThanOrEqual(60_000)
    expect(CHECK_MS).toBeLessThanOrEqual(15 * 60_000)
  })

  it('on a laptop it is dev, so nothing is ever announced here', () => {
    expect(typeof BUILD).toBe('string')
  })
})

describe('the box in the sidebar', () => {
  const box = readFileSync('components/NewVersion.tsx', 'utf8')

  it('draws nothing until there is something to say', () => {
    expect(box).toContain('if (!ready) return null')
  })

  it('NEVER RELOADS BY ITSELF - somebody is always mid-sentence', () => {
    // The only reload in the file is the one inside the click handler.
    const reloads = box.match(/location\.reload\(\)/g) || []
    expect(reloads.length).toBe(1)
    expect(box).toContain('const reload = () => {')
  })

  it('takes the focus off what is being typed first, so the box saves', () => {
    expect(box).toContain('typing?.blur()')
    const i = box.indexOf('typing?.blur()')
    const j = box.indexOf('window.location.reload()')
    expect(i, 'the blur has to come before the reload, not after').toBeLessThan(j)
  })

  it('is in the sidebar, where Fabio put it', () => {
    const side = readFileSync('components/Sidebar.tsx', 'utf8')
    expect(side).toContain('<NewVersion />')
  })
})
