import { describe, expect, it } from 'bun:test'
import { saleLinesFromServiceOrder, serviceOrderTotal, type ServiceOrder } from './services'

const order: ServiceOrder = {
  id: 'order-1', establishmentId: 'est-1', customerName: 'Ana', description: 'Repair', status: 'ORCADA',
  dueAt: null, responsibleId: null, completedAt: null, updatedAt: '2026-09-01T12:00:00.000Z',
  items: [
    { id: 'line-1', productId: 'p1', serviceOfferingId: null, description: 'Part', quantity: 2, unitPrice: 10 },
    { id: 'line-2', productId: null, serviceOfferingId: 's1', description: 'Repair', quantity: 1, unitPrice: 25 },
  ], events: [],
}

describe('service contracts', () => {
  it('calculates quote totals and converts snapshots to a mixed sale request', () => {
    expect(serviceOrderTotal(order.items)).toBe(45)
    expect(saleLinesFromServiceOrder(order.items)).toEqual([
      { productId: 'p1', quantity: 2 },
      { serviceId: 's1', quantity: 1, unitPriceAtSale: 25 },
    ])
  })
  it('accepts historical and one-off service lines without catalog references', () => {
    expect(serviceOrderTotal([{ productId: null, serviceOfferingId: null, kind: 'SERVICE', details: 'Full scope', description: 'Labor', quantity: 2, unitPrice: 12.45 }])).toBe(24.9)
  })
  it('keeps detached services out of catalog-based direct sale requests', () => {
    expect(() => saleLinesFromServiceOrder([{ productId: null, serviceOfferingId: null, kind: 'SERVICE', description: 'Historical labor', quantity: 1, unitPrice: 25 }])).toThrow('Close the service order')
  })
  it('rejects ambiguous or unnamed quote lines', () => {
    expect(() => serviceOrderTotal([{ productId: null, serviceOfferingId: null, description: 'Invalid', quantity: 1, unitPrice: 5 }])).toThrow()
    expect(() => serviceOrderTotal([{ productId: 'p1', serviceOfferingId: 's1', description: 'Invalid', quantity: 1, unitPrice: 5 }])).toThrow()
  })
})
