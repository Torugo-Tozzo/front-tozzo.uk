import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SUPPORTED_LOCALES = ['en', 'pt-BR', 'es', 'fr', 'zh', 'hi', 'ar']
export const NAMESPACES = [
  'common',
  'auth',
  'navigation',
  'orders',
  'sales',
  'products',
  'employees',
  'charts',
  'settings',
  'sync',
  'printer',
  'status',
  'errors',
  'catalog',
]
export const DEFAULT_LOCALE = 'en'

function isLeaf(value) {
  return value === null || typeof value !== 'object'
}

export function flattenLeaves(value, prefix = '', leaves = {}) {
  if (isLeaf(value)) {
    if (prefix) leaves[prefix] = value
    return leaves
  }

  for (const key of Object.keys(value).sort()) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    flattenLeaves(value[key], nextPrefix, leaves)
  }

  return leaves
}

export function extractPlaceholders(value) {
  const placeholders = new Set()
  const text = String(value ?? '')
  const pattern = /{{\s*([^{}]+?)\s*}}/g
  for (const match of text.matchAll(pattern)) placeholders.add(match[1].trim())
  return [...placeholders].sort()
}

function flattenBundle(bundle) {
  const leaves = new Map()
  for (const namespace of Object.keys(bundle).sort()) {
    const namespaceLeaves = flattenLeaves(bundle[namespace])
    for (const [key, value] of Object.entries(namespaceLeaves)) {
      leaves.set(`${namespace}.${key}`, { namespace, key, value })
    }
  }
  return leaves
}

export function checkBundles(resources, { baseLocale = DEFAULT_LOCALE } = {}) {
  if (!resources || typeof resources !== 'object' || !resources[baseLocale]) {
    throw new Error(`Missing base locale: ${baseLocale}`)
  }

  const baseLeaves = flattenBundle(resources[baseLocale])
  const issues = []

  for (const locale of Object.keys(resources).sort()) {
    if (locale === baseLocale) continue
    const localeLeaves = flattenBundle(resources[locale])
    const allKeys = new Set([...baseLeaves.keys(), ...localeLeaves.keys()])

    for (const fullKey of [...allKeys].sort()) {
      const baseLeaf = baseLeaves.get(fullKey)
      const localeLeaf = localeLeaves.get(fullKey)
      const leaf = baseLeaf ?? localeLeaf

      if (!localeLeaf) {
        issues.push({
          type: 'missing-key',
          locale,
          namespace: leaf.namespace,
          key: leaf.key,
        })
        continue
      }

      if (!baseLeaf) {
        issues.push({
          type: 'extra-key',
          locale,
          namespace: leaf.namespace,
          key: leaf.key,
        })
        continue
      }

      const expected = extractPlaceholders(baseLeaf.value)
      const received = extractPlaceholders(localeLeaf.value)
      if (JSON.stringify(expected) !== JSON.stringify(received)) {
        issues.push({
          type: 'placeholder-mismatch',
          locale,
          namespace: leaf.namespace,
          key: leaf.key,
          expected,
          received,
        })
      }
    }
  }

  return issues
}

export function formatIssues(issues) {
  return issues
    .map((issue) => {
      const location = `${issue.locale}/${issue.namespace}/${issue.key}`
      if (issue.type === 'missing-key') return `${location}: missing key`
      if (issue.type === 'extra-key') return `${location}: extra key`
      return `${location}: placeholders expected [${issue.expected.join(', ')}], received [${issue.received.join(', ')}]`
    })
    .join('\n')
}

export function assertBundlesComplete(resources, options) {
  const issues = checkBundles(resources, options)
  if (issues.length > 0) throw new Error(formatIssues(issues))
  return resources
}

export async function loadBundles(rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  const bundles = {}
  for (const locale of SUPPORTED_LOCALES) {
    const filename = path.join(rootDir, 'src', 'i18n', 'locales', `${locale}.json`)
    bundles[locale] = JSON.parse(await readFile(filename, 'utf8'))
  }
  return bundles
}

export async function main() {
  const resources = await loadBundles()
  const issues = checkBundles(resources)
  if (issues.length > 0) {
    console.error(formatIssues(issues))
    return 1
  }

  console.log(`i18n bundles OK: ${SUPPORTED_LOCALES.length} locales, ${NAMESPACES.length} namespaces`)
  return 0
}

const currentFile = path.resolve(fileURLToPath(import.meta.url))
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (currentFile === invokedFile) {
  main().then((exitCode) => {
    process.exitCode = exitCode
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
