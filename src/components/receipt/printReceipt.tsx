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
 * Prints a receipt through the browser, like the React app: mounts it in a
 * root that the print CSS shows alone, sets the page size of the stored paper
 * width, calls window.print() and cleans up on afterprint.
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
