#!/usr/bin/env node
/**
 * Reads the metric domains from the analytics MCP repo and writes them to
 * src/api/mock/domains.generated.json for the mock backend.
 *
 * A domain is a folder under semantic/metrics/ containing _domain.yaml.
 * It is "loaded by the agent" when listed in metrics_dirs of the agent config.
 * The real backend's GET /domains should apply the same rules.
 *
 * Usage:
 *   npm run sync:domains
 *   MCP_REPO_PATH=/path/to/bapps-edp-analytics-mcp npm run sync:domains
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repo = resolve(process.env.MCP_REPO_PATH ?? join(root, '..', 'bapps-edp-analytics-mcp'))
const agentConfig = process.env.MCP_AGENT_CONFIG ?? 'agents/roller_analyst.yaml'
const metricsRoot = join(repo, 'semantic', 'metrics')
const output = join(root, 'src', 'api', 'mock', 'domains.generated.json')

if (!existsSync(metricsRoot)) {
  console.error(`No metrics folder at ${metricsRoot}. Set MCP_REPO_PATH to the analytics MCP repo.`)
  process.exit(1)
}

/** Folder names listed under `metrics_dirs:` in the agent config. */
function loadedDomainKeys() {
  const lines = readFileSync(join(repo, agentConfig), 'utf8').split('\n')
  const start = lines.findIndex((line) => /^metrics_dirs:\s*$/.test(line))
  if (start < 0) return new Set()
  const keys = new Set()
  for (const line of lines.slice(start + 1)) {
    const item = line.match(/^\s+-\s+(\S+)\s*$/)
    if (!item) break
    keys.add(item[1].replace(/\/+$/, '').split('/').pop())
  }
  return keys
}

/** Label from the header comment: "# Domain config — Customer Success". */
function domainLabel(key, domainYaml) {
  const header = domainYaml.match(/^#\s*Domain config\s*[—-]\s*(.+)$/m)?.[1]
  // Drop qualifiers such as "Sales / Pipeline metrics" or "Finance / Billing (Chargebee)".
  const label = header?.split('/')[0].trim()
  return (
    label ||
    key
      .split('_')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ')
  )
}

const loaded = loadedDomainKeys()
const domains = readdirSync(metricsRoot, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && existsSync(join(metricsRoot, entry.name, '_domain.yaml')),
  )
  .map((entry) => {
    const dir = join(metricsRoot, entry.name)
    const metricCount = readdirSync(dir).filter(
      (f) => /\.ya?ml$/.test(f) && !f.startsWith('_'),
    ).length
    return {
      key: entry.name,
      label: domainLabel(entry.name, readFileSync(join(dir, '_domain.yaml'), 'utf8')),
      metricCount,
      loadedByAgent: loaded.has(entry.name),
    }
  })
  .sort((a, b) => a.key.localeCompare(b.key))

writeFileSync(output, `${JSON.stringify(domains, null, 2)}\n`)
console.log(`Wrote ${domains.length} domains to ${output}`)
for (const d of domains) {
  console.log(
    `  ${d.key.padEnd(20)} ${String(d.metricCount).padStart(3)} metrics  ${d.loadedByAgent ? '' : '(not in metrics_dirs)'}`,
  )
}
