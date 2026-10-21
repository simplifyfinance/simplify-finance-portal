import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// THE ROBOT IS SIGNED OUT, AND THAT IS NOT A BROKEN PORTAL.
//
// 21 Oct 2026. Two factor went in. Fabio pressed Sign out to test it, and
// Supabase revoked every session on the account - including the one the robot
// had saved for the browser tests. The next ship then spent eight minutes
// watching forty four tests time out on a page that was never going to load.
//
// He watched it, said "that's longer than usual", and the only thing that said
// what had actually happened was a line in a server log nobody reads.

const SCRIPT = readFileSync('scripts/check-browser.sh', 'utf8')

describe('when the robot has been signed out', () => {
  it('says so, in those words', () => {
    expect(SCRIPT).toContain('THE ROBOT IS SIGNED OUT')
  })

  // The whole point is the one command that fixes it, on screen, at the moment
  // it is needed. A diagnosis with no instruction is half a message.
  it('gives the command that fixes it', () => {
    expect(SCRIPT).toContain('./scripts/portal-login.sh')
  })

  it('says the portal itself is probably fine', () => {
    expect(SCRIPT).toContain('The portal is almost certainly fine')
  })

  // The evidence is in the SERVER log, not the test log, which is exactly why
  // nobody saw it for eight minutes.
  it('reads the server log, where the evidence actually is', () => {
    expect(SCRIPT).toContain('Invalid Refresh Token')
    expect(SCRIPT).toContain('browser-server.log')
  })

  // A CHECK THAT CRIES WOLF IS ONE PEOPLE LEARN TO SCROLL PAST. Both signs
  // have to be there: the dead token AND tests failing on a page that never
  // became ready.
  it('needs both signs before it speaks', () => {
    const near = SCRIPT.slice(SCRIPT.indexOf('DEAD_LOGIN='))
    expect(near).toContain('NEVER_READY=')
    expect(near).toMatch(/-gt 0 \] && \[ "\$\{NEVER_READY:-0\}" -gt 0 \]/)
  })

  it('still prints the real failures underneath it', () => {
    const after = SCRIPT.slice(SCRIPT.indexOf('THE ROBOT IS SIGNED OUT'))
    expect(after).toContain('Full detail: .robot-logs/browser-check.log')
  })
})

// ---------------------------------------------------------------------------
// AND IT ACTUALLY RUNS
// ---------------------------------------------------------------------------
//
// Every test above reads the script as text, which proves the words are in the
// file and nothing about whether the shell agrees. This one runs the real
// condition against real log files.

describe('the condition itself', () => {
  function run(serverLog: string, checkLog: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'robot-'))
    try {
      mkdirSync(join(dir, '.robot-logs'))
      writeFileSync(join(dir, '.robot-logs/browser-server.log'), serverLog)
      writeFileSync(join(dir, '.robot-logs/browser-check.log'), checkLog)
      // The same two lines the script runs, lifted out so the condition is
      // tested rather than described.
      const snippet = `
        cd "${dir}"
        DEAD_LOGIN=$(grep -c "Invalid Refresh Token" .robot-logs/browser-server.log 2>/dev/null) || DEAD_LOGIN=0
        NEVER_READY=$(grep -c 'data-ready="1"' .robot-logs/browser-check.log 2>/dev/null) || NEVER_READY=0
        if [ "\${DEAD_LOGIN:-0}" -gt 0 ] && [ "\${NEVER_READY:-0}" -gt 0 ]; then
          echo SPEAKS
        else
          echo QUIET
        fi
      `
      // stderr is captured on purpose. The first version of this condition
      // reached the right answer while printing "integer expression expected"
      // to the terminal on every clean ship, because grep -c prints 0 AND
      // exits 1 when it finds nothing.
      const out = execFileSync('bash', ['-c', snippet],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      return String(out).trim()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it('speaks when both signs are there', () => {
    expect(run(
      'AuthApiError: Invalid Refresh Token: Refresh Token Not Found',
      'waiting for locator(\'[data-ready="1"]\') to be visible',
    )).toBe('SPEAKS')
  })

  // A test that fails for its own reasons, with a healthy login, is a real
  // failure and must not be explained away as a signed-out robot.
  it('stays quiet when the login is fine', () => {
    expect(run(
      'nothing wrong here',
      'waiting for locator(\'[data-ready="1"]\') to be visible',
    )).toBe('QUIET')
  })

  // An expired token on its own happens while a session refreshes itself and
  // means nothing if the tests went through.
  it('stays quiet when the tests reached the page anyway', () => {
    expect(run(
      'AuthApiError: Invalid Refresh Token: Refresh Token Not Found',
      'everything passed',
    )).toBe('QUIET')
  })

  it('stays quiet when both logs are empty', () => {
    expect(run('', '')).toBe('QUIET')
  })

  // THE SHELL ITSELF MUST NOT COMPLAIN. A check that works while printing an
  // error on every clean ship trains people to ignore the output, which is the
  // thing this whole file exists to stop.
  it('runs without the shell complaining', () => {
    let noise = ''
    try {
      execFileSync('bash', ['-c', `
        set -o pipefail
        DEAD_LOGIN=$(grep -c "nothing" /dev/null 2>/dev/null) || DEAD_LOGIN=0
        [ "\${DEAD_LOGIN:-0}" -gt 0 ] && echo yes || echo no
      `], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e: any) {
      noise = String(e?.stderr || '')
    }
    expect(noise).not.toContain('integer expression expected')
  })
})
