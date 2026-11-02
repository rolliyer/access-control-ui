import { normalizeEmail } from './validation'

/** Most people a bulk add accepts at once (matches the backend). */
export const MAX_BULK_EMAILS = 500

/**
 * Pulls emails out of pasted text or an uploaded .txt/.csv file. Accepts any
 * mix of commas, semicolons, spaces and new lines, quoted CSV cells and
 * "Name <email>" entries. Anything without an @ (a CSV header, a name) is
 * ignored. Returns lowercase emails, each once, in the order given.
 */
export function parseEmailList(text: string): string[] {
  const emails = text
    .split(/[\s,;]+/)
    .map((token) => token.replace(/^["'<(]+|["'>)]+$/g, ''))
    .filter((token) => token.includes('@'))
    .map(normalizeEmail)
  return [...new Set(emails)]
}
