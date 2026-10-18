// Optional asset generation, using the existing pinned Playwright/Chromium.
// Does not run during the app build and never overwrites the original JPEG.
import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

const original = new URL('../public/images/landing/01.jpg', import.meta.url)
const jpeg = await readFile(original)
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const variants = await page.evaluate(async source => {
    const image = new Image()
    image.src = source
    await image.decode()
    return [960, 1440].map(width => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = Math.round(width * image.naturalHeight / image.naturalWidth)
      const context = canvas.getContext('2d')
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      return { width, height: canvas.height, data: canvas.toDataURL('image/webp', 0.95) }
    })
  }, `data:image/jpeg;base64,${jpeg.toString('base64')}`)
  for (const variant of variants) {
    const name = `01-${variant.width}.webp`
    const bytes = Buffer.from(variant.data.split(',')[1], 'base64')
    await writeFile(new URL(`../public/images/landing/${name}`, import.meta.url), bytes)
    console.log(`${name}: ${variant.width}×${variant.height}, ${bytes.length} bytes`)
  }
} finally {
  await browser.close()
}
