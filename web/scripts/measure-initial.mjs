// Gzip size of the JS a route needs before it renders: the entry chunk plus
// every chunk it imports statically (what index.html modulepreloads), and,
// optionally, the lazy chunks named on the command line with their own static
// imports (e.g. `node scripts/measure-initial.mjs LoginPage MainLayout pt-BR`).
// Run after `bun run build`.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const assets = path.resolve(import.meta.dirname, '../dist/assets')
const html = readFileSync(path.resolve(assets, '../index.html'), 'utf8')
const entry = html.match(/src="\/assets\/([^"]+\.js)"/)[1]
const files = readdirSync(assets).filter((name) => name.endsWith('.js'))

const staticImports = (name) => {
  const code = readFileSync(path.join(assets, name), 'utf8')
  // Static `import … from "./x.js"` and bare `import "./x.js"`; not import().
  const found = [...code.matchAll(/(?:^|[;}\s])import\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+\.js)["']/g)].map((match) => match[1])
  return [...new Set(found)]
}

const closure = (roots) => {
  const seen = new Set()
  const visit = (name) => {
    if (seen.has(name)) return
    seen.add(name)
    for (const next of staticImports(name)) visit(next)
  }
  roots.forEach(visit)
  return seen
}

const gzip = (name) => gzipSync(readFileSync(path.join(assets, name)), { level: 9 }).length
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`
const report = (label, names) => {
  const sizes = [...names].map((name) => [name, gzip(name)]).sort((a, b) => b[1] - a[1])
  const total = sizes.reduce((sum, [, size]) => sum + size, 0)
  console.log(`${label}: ${kb(total)} gzip`)
  for (const [name, size] of sizes) console.log(`  ${kb(size).padStart(9)}  ${name}`)
  return total
}

const initial = closure([entry])
report('initial (entry + static imports)', initial)

const extra = process.argv.slice(2)
if (extra.length) {
  const roots = extra.map((prefix) => {
    const match = files.find((name) => name.startsWith(`${prefix}-`))
    if (!match) throw new Error(`no chunk for ${prefix}`)
    return match
  })
  const route = closure([entry, ...roots])
  report(`with ${extra.join(', ')}`, route)
}
