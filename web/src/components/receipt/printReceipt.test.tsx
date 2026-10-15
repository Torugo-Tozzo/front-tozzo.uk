import { afterEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { persistPaperWidth } from '@/lib/printPreferences'
import { printReceipt } from './printReceipt'

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

// happy-dom has no window.print.
const stubPrint = () => {
  const print = vi.fn()
  window.print = print
  return print
}

describe('printReceipt', () => {
  afterEach(() => {
    window.dispatchEvent(new Event('afterprint'))
    document.getElementById('receipt-print-root')?.remove()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('mounts the receipt root, calls window.print, and cleans up on afterprint', async () => {
    persistPaperWidth('58mm')
    const printSpy = stubPrint()

    printReceipt({
      title: 'Sale #1',
      customerName: 'Jane Doe',
      dateLabel: '2026-08-26 10:00',
      items: [{ name: 'Burger', quantity: 2, unitPriceCents: 1000 }],
      totalCents: 2000,
      totalLabel: 'Total',
    })

    await nextFrame()

    const root = document.getElementById('receipt-print-root')
    expect(root).not.toBeNull()
    expect(root?.querySelector('.receipt--58mm')).not.toBeNull()
    expect(printSpy).toHaveBeenCalledTimes(1)
    expect([...document.head.querySelectorAll('style')].some((style) => style.textContent === '@page { size: 58mm auto; margin: 0; }')).toBe(true)

    window.dispatchEvent(new Event('afterprint'))
    expect(document.getElementById('receipt-print-root')).toBeNull()
    expect([...document.head.querySelectorAll('style')].some((style) => style.textContent?.startsWith('@page'))).toBe(false)
  })

  it('prints the lines and the total from cents, with the payment method when given', async () => {
    await i18n.changeLanguage('pt-BR')
    stubPrint()

    printReceipt({
      title: 'Pedido #ord-1',
      customerName: 'Mesa 4',
      dateLabel: '01/10/2026 12:00:00',
      items: [{ name: 'X-Burger', quantity: 2, unitPriceCents: 2490 }, { name: 'Suco', quantity: 1, unitPriceCents: 990 }],
      totalCents: 5970,
      totalLabel: 'Total',
      paymentLabel: 'Pix',
      locale: 'pt-BR',
    })

    const root = document.getElementById('receipt-print-root')!
    // Default width when none is stored.
    expect(root.querySelector('.receipt--80mm')).not.toBeNull()
    const text = (root.textContent ?? '').replace(/ /g, ' ')
    expect(text).toContain('TOZZO BURGER')
    expect(text).toContain('Pedido #ord-1')
    expect(text).toContain('Mesa 4')
    expect(text).toContain('2x X-Burger')
    expect(text).toContain('R$ 49,80')
    expect(text).toContain('R$ 59,70')
    expect(text).toContain('Forma de pagamento: Pix')
    await i18n.changeLanguage('en')
  })
})
