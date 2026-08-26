import { afterEach, describe, expect, mock, test } from 'bun:test'
import { persistPaperWidth } from '@/lib/printPreferences'
import { printReceipt } from './printReceipt'

describe('printReceipt', () => {
  afterEach(() => {
    document.getElementById('receipt-print-root')?.remove()
    document.body.style.pointerEvents = ''
  })

  test('mounts the receipt root, calls window.print, and cleans up on afterprint', async () => {
    persistPaperWidth('58mm')
    const printSpy = mock(() => {})
    window.print = printSpy as unknown as typeof window.print

    printReceipt({
      title: 'Sale #1',
      customerName: 'Jane Doe',
      dateLabel: '2026-08-26 10:00',
      items: [{ name: 'Burger', quantity: 2, unitPrice: 10 }],
      total: 20,
      totalLabel: 'Total',
    })

    await new Promise((resolve) => requestAnimationFrame(resolve))

    const root = document.getElementById('receipt-print-root')
    expect(root).not.toBeNull()
    expect(root?.querySelector('.receipt--58mm')).not.toBeNull()
    expect(printSpy).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('afterprint'))
    expect(document.getElementById('receipt-print-root')).toBeNull()
  })
})
