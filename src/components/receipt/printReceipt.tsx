import { createRoot } from 'react-dom/client'
import { getStoredPaperWidth, type PaperWidthPreset } from '@/lib/printPreferences'
import { ReceiptPrintView, type ReceiptData } from './ReceiptPrintView'

const PAGE_SIZE: Record<PaperWidthPreset, string> = {
  '44mm': '44mm auto',
  '58mm': '58mm auto',
  '76mm': '76mm auto',
  '80mm': '80mm auto',
  '110mm': '110mm auto',
  a4: 'A4',
}

export function printReceipt(data: ReceiptData): void {
  const width = getStoredPaperWidth()

  const container = document.createElement('div')
  container.id = 'receipt-print-root'
  container.className = `receipt receipt--${width}`
  document.body.appendChild(container)

  const pageStyle = document.createElement('style')
  pageStyle.textContent = `@page { size: ${PAGE_SIZE[width]}; margin: 0; }`
  document.head.appendChild(pageStyle)

  const root = createRoot(container)
  root.render(<ReceiptPrintView data={data} width={width} />)

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    window.removeEventListener('afterprint', cleanup)
    root.unmount()
    container.remove()
    pageStyle.remove()
  }

  window.addEventListener('afterprint', cleanup)
  // Safety net for browsers that never fire afterprint (rare, but seen on
  // some print-to-PDF flows) — do not leave the hidden root mounted forever.
  setTimeout(cleanup, 60_000)

  requestAnimationFrame(() => window.print())
}

export type { ReceiptData, ReceiptLineItem } from './ReceiptPrintView'
