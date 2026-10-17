// Check the emitted module graph, including shared dependencies: a dynamic
// import alone does not prevent Rolldown placing a shared helper in ECharts.
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const assets = path.join(dist, 'assets')
const files = readdirSync(assets).filter(name => name.endsWith('.js'))
const code = name => readFileSync(path.join(assets, name), 'utf8')
const entry = readFileSync(path.join(dist, 'index.html'), 'utf8').match(/src="\/assets\/([^"]+\.js)"/)[1]
const closure = (name, seen = new Set()) => {
  if (seen.has(name)) return seen
  seen.add(name)
  const imports = code(name).matchAll(/(?:^|[;}\s])import\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+\.js)["']/g)
  for (const [, dependency] of imports) closure(dependency, seen)
  return seen
}
const roots = [entry, ...['LoginPage', 'DashboardLayout', 'OrdersPage'].map(prefix => {
  const file = files.find(name => name.startsWith(`${prefix}-`))
  assert(file, `Missing built route: ${prefix}`)
  return file
}), ...files.filter(name => code(name).includes('sonner-spinner'))]
for (const root of roots) {
  const leaked = [...closure(root)].filter(name => /^echarts(?:-runtime)?-/.test(name))
  assert.deepEqual(leaked, [], `ECharts must not be a static dependency of ${root}`)
}
console.log('Report chunks OK: ECharts stays out of entry, login, toaster and dashboard/orders')
