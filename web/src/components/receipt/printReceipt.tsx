import { render } from "solid-js/web"

import { getStoredPaperWidth, type PaperWidthPreset } from "@/lib/printPreferences"
import { ReceiptPrintView, type ReceiptData } from "./ReceiptPrintView"

const PAGE_SIZE: Record<PaperWidthPreset, string> = {
  "44mm": "44mm auto",
  "58mm": "58mm auto",
  "76mm": "76mm auto",
  "80mm": "80mm auto",
  "110mm": "110mm auto",
  a4: "A4",
}

/**
 * Prints a receipt with the browser's dialog, like the React app: the receipt
 * is mounted in #receipt-print-root (hidden on screen; on paper, the only
 * thing shown, see index.css), the page size follows the paper width saved in
 * the settings, and everything is removed after printing.
 */
export function printReceipt(data: ReceiptData): void {
  const width = getStoredPaperWidth()

  const container = document.createElement("div")
  container.id = "receipt-print-root"
  document.body.appendChild(container)

  const pageStyle = document.createElement("style")
  pageStyle.textContent = `@page { size: ${PAGE_SIZE[width]}; margin: 0; }`
  document.head.appendChild(pageStyle)

  const dispose = render(() => <ReceiptPrintView data={data} width={width} />, container)

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    window.removeEventListener("afterprint", cleanup)
    clearTimeout(safetyNet)
    dispose()
    container.remove()
    pageStyle.remove()
  }

  window.addEventListener("afterprint", cleanup)
  // Safety net for browsers that never fire afterprint (rare, but seen on
  // some print-to-PDF flows): do not leave the hidden root mounted forever.
  const safetyNet = setTimeout(cleanup, 60_000)

  requestAnimationFrame(() => window.print())
}

export type { ReceiptData, ReceiptLineItem } from "./ReceiptPrintView"
