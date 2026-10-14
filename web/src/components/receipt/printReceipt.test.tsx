import { afterEach, describe, expect, it, vi } from 'vitest'

import { persistPaperWidth } from '@/lib/printPreferences'
import { printReceipt } from './printReceipt'

describe('printReceipt', () => {
  afterEach(() => {
    document.getElementById('receipt-print-root')?.remove()
    document.body.style.pointerEvents = ''
  })

  it('mounts the receipt root, calls window.print, and cleans up on afterprint', async () => {
    persistPaperWidth('58mm')
    const printSpy = vi.fn()
    window.print = printSpy

    printReceipt({
      title: 'Sale #1',
      customerName: 'Jane Doe',
      dateLabel: '2026-08-26 10:00',
      items: [{ name: 'Burger', quantity: 2, unitPriceCents: 1000 }],
      totalCents: 2000,
      totalLabel: 'Total',
      paymentLabel: 'Payment method: Pix',
      locale: 'en',
    })

    await new Promise((resolve) => requestAnimationFrame(resolve))

    const root = document.getElementById('receipt-print-root')
    expect(root).not.toBeNull()
    expect(root?.querySelector('.receipt--58mm')).not.toBeNull()
    // The receipt prints the cents as money, and the payment line as given.
    expect(root?.querySelector('.receipt__item')?.textContent).toBe('2x BurgerR$20.00')
    expect(root?.querySelector('.receipt__total')?.textContent).toBe('TotalR$20.00')
    expect(root?.textContent).toContain('Payment method: Pix')
    expect(document.head.textContent).toContain('@page { size: 58mm auto; margin: 0; }')
    expect(printSpy).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('afterprint'))
    expect(document.getElementById('receipt-print-root')).toBeNull()
    expect(document.head.textContent).not.toContain('@page { size: 58mm auto')
  })

  it('does not inject the names as HTML', async () => {
    window.print = vi.fn()
    printReceipt({
      title: 'Order #1',
      customerName: '<img src=x onerror="alert(1)">',
      dateLabel: 'now',
      items: [{ name: '<b>Burger</b>', quantity: 1, unitPriceCents: 100 }],
      totalCents: 100,
      totalLabel: 'Total',
    })
    const root = document.getElementById('receipt-print-root')!
    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelector('b')).toBeNull()
    expect(root.textContent).toContain('<b>Burger</b>')
    window.dispatchEvent(new Event('afterprint'))
  })
})
