import { readFile, writeFile } from 'node:fs/promises'
import type { Page, TestInfo } from '@playwright/test'

export interface Region { x: number; y: number; width: number; height: number }
export interface RegionPair { name: string; actual: Region; expected: Region }
export interface RegionResult { name: string; pixels: number; different: number; ratio: number }

/**
 * Compares regions of a screenshot with regions of a baseline PNG, in the
 * browser (canvas), with pixelmatch's YIQ distance and Playwright's default
 * threshold (0.2). Used while a page's content is not ported yet: the shell
 * around <main> must already match the React baseline.
 */
export async function compareRegions(page: Page, actualPng: Buffer, expectedFile: string, pairs: RegionPair[], testInfo: TestInfo): Promise<RegionResult[]> {
  const expectedPng = await readFile(expectedFile)
  const results = await page.evaluate(async ({ actual, expected, pairs }) => {
    const load = async (base64: string) => {
      const image = new Image()
      image.src = `data:image/png;base64,${base64}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })!
      context.drawImage(image, 0, 0)
      return context
    }
    const actualContext = await load(actual)
    const expectedContext = await load(expected)
    const maxDelta = 35215 * 0.2 * 0.2
    const yiq = (r: number, g: number, b: number) => [
      r * 0.29889531 + g * 0.58662247 + b * 0.11448223,
      r * 0.59597799 - g * 0.2741761 - b * 0.32180189,
      r * 0.21147017 - g * 0.52261711 + b * 0.31114694,
    ]
    return pairs.map(({ name, actual: a, expected: e }) => {
      // Boxes come from fractional layout: clamp them to both images.
      const width = Math.min(a.width, e.width, actualContext.canvas.width - a.x, expectedContext.canvas.width - e.x)
      const height = Math.min(a.height, e.height, actualContext.canvas.height - a.y, expectedContext.canvas.height - e.y)
      if (width <= 0 || height <= 0) return { name, pixels: 0, different: 0, ratio: 0, diff: '' }
      const left = actualContext.getImageData(a.x, a.y, width, height).data
      const right = expectedContext.getImageData(e.x, e.y, width, height).data
      const diffCanvas = document.createElement('canvas')
      diffCanvas.width = width
      diffCanvas.height = height
      const diffContext = diffCanvas.getContext('2d')!
      const diffImage = diffContext.createImageData(width, height)
      let different = 0
      for (let index = 0; index < left.length; index += 4) {
        const [y1, i1, q1] = yiq(left[index], left[index + 1], left[index + 2])
        const [y2, i2, q2] = yiq(right[index], right[index + 1], right[index + 2])
        const delta = 0.5053 * (y1 - y2) ** 2 + 0.299 * (i1 - i2) ** 2 + 0.1957 * (q1 - q2) ** 2
        const hit = delta > maxDelta
        if (hit) different += 1
        diffImage.data[index] = hit ? 255 : right[index] * 0.3 + 178
        diffImage.data[index + 1] = hit ? 0 : right[index + 1] * 0.3 + 178
        diffImage.data[index + 2] = hit ? 0 : right[index + 2] * 0.3 + 178
        diffImage.data[index + 3] = 255
      }
      diffContext.putImageData(diffImage, 0, 0)
      const pixels = width * height
      return { name, pixels, different, ratio: different / pixels, diff: different ? diffCanvas.toDataURL('image/png') : '' }
    })
  }, { actual: actualPng.toString('base64'), expected: expectedPng.toString('base64'), pairs })

  // Kept on disk (test-results/) when something differs, like toHaveScreenshot does.
  if (results.some((result) => result.diff)) {
    await writeFile(testInfo.outputPath('actual.png'), actualPng)
    for (const result of results) {
      if (result.diff) await writeFile(testInfo.outputPath(`${result.name}-diff.png`), Buffer.from(result.diff.split(',')[1], 'base64'))
    }
  }
  return results.map(({ name, pixels, different, ratio }) => ({ name, pixels, different, ratio }))
}
