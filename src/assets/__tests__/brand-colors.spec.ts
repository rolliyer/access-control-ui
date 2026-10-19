import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Keeps the UI on the Roller colour standards: every colour must come from
 * the tokens in assets/styles/tokens.css, never a hard-coded value.
 */
// Vitest runs from the project root (see vitest.config.ts `root`).
const SRC = resolve(process.cwd(), 'src')
const TOKENS = 'assets/styles/tokens.css'
/** The logo is artwork traced from the official icon, not UI colour. */
const ALLOWED = new Set([TOKENS, 'components/ui/RollerLogo.vue'])
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b(?![-\w])|\brgba?\(|\bhsla?\(/gi

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.(vue|css)$/.test(name) ? [path] : []
  })
}

describe('brand colours', () => {
  it('uses tokens instead of hard-coded colours', () => {
    const offenders = sourceFiles(SRC)
      .map((path) => relative(SRC, path))
      .filter((file) => !ALLOWED.has(file))
      .flatMap((file) =>
        readFileSync(join(SRC, file), 'utf8')
          .split('\n')
          .flatMap((line, i) =>
            line.match(COLOR_LITERAL) ? [`${file}:${i + 1}: ${line.trim()}`] : [],
          ),
      )
    expect(offenders).toEqual([])
  })

  it('only references tokens that are defined', () => {
    const defined = new Set(
      [...readFileSync(join(SRC, TOKENS), 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
    )
    const undefinedTokens = new Set(
      sourceFiles(SRC).flatMap((path) =>
        [...readFileSync(path, 'utf8').matchAll(/var\((--[a-z0-9-]+)/g)]
          .map((m) => m[1]!)
          .filter((token) => !defined.has(token)),
      ),
    )
    expect([...undefinedTokens]).toEqual([])
  })
})
