import { describe, expect, it } from 'bun:test'
import {
  fromLegacyWire,
  normalizeRealtimeEventType,
  toLegacyWire,
} from './legacyWire'

describe('legacy wire adapter', () => {
  it('normalizes a legacy user without exposing password fields', () => {
    const result = fromLegacyWire<unknown>({
      id: 7,
      nome: 'Ana',
      role: 'DONO',
      senha: 'must-not-leak',
      estabelecimento: { id: 3, nomeFantasia: 'Bar da Ana', status: 'ATIVO' },
    })

    expect(result).toEqual({
      id: 7,
      name: 'Ana',
      role: 'OWNER',
      establishment: { id: 3, tradeName: 'Bar da Ana', status: 'ACTIVE' },
    })
  })

  it('normalizes chart, order, and sale collection DTOs', () => {
    expect(fromLegacyWire<unknown>({
      produtos: [{ nome: 'Pizza', quantidadeVendida: 2, totalFaturado: '25.50' }],
      fechamento: { totalUnidadesVendidas: 2, totalFaturado: 25.5, totalNumeroVendas: 1 },
    }, 'chart')).toEqual({
      products: [{ name: 'Pizza', quantitySold: 2, totalRevenue: '25.50' }],
      closing: { totalUnitsSold: 2, totalRevenue: 25.5, totalSales: 1 },
    })

    expect(fromLegacyWire<unknown>({
      pedidos: [{
        id: 1,
        cliente: 'Mesa 1',
        status: 'EM_PREPARO',
        itens: [{ produtoId: 9, quantidade: 2, precoHistorico: 8 }],
      }],
    }, 'order')).toEqual({
      orders: [{
        id: 1,
        customerName: 'Mesa 1',
        status: 'IN_PREPARATION',
        items: [{ productId: 9, quantity: 2, unitPriceAtOrder: 8 }],
      }],
    })

    expect(fromLegacyWire<unknown>({
      vendas: [{ id: 2, cliente: 'Balcão', horario: '2026-08-24T12:00:00Z' }],
    }, 'sale')).toEqual({
      sales: [{ id: 2, customerName: 'Balcão', soldAt: '2026-08-24T12:00:00Z' }],
    })
  })

  it('maps nested legacy produto fields for order and sale items', () => {
    expect(fromLegacyWire<unknown>({
      pedidos: [{
        id: 1,
        itens: [{
          produto: { id: 9, nome: 'Pizza', preco: 12.5 },
          quantidade: 2,
          precoHistorico: 10,
        }],
      }],
      vendas: [{
        id: 2,
        itens: [{
          produto: { id: 9, nome: 'Pizza', preco: 12.5 },
          quantidade: 1,
          precoHistorico: 12.5,
        }],
      }],
    })).toEqual({
      orders: [{
        id: 1,
        items: [{
          product: { id: 9, name: 'Pizza', price: 12.5 },
          quantity: 2,
          unitPriceAtOrder: 10,
        }],
      }],
      sales: [{
        id: 2,
        items: [{
          product: { id: 9, name: 'Pizza', price: 12.5 },
          quantity: 1,
          unitPriceAtSale: 12.5,
        }],
      }],
    })
  })

  it('serializes canonical requests while retaining the legacy contract', () => {
    expect(toLegacyWire<unknown>({
      name: 'Ana',
      password: 'secret',
      establishmentName: 'Bar da Ana',
      role: 'OWNER',
      status: 'PENDING_PAYMENT',
      createdBy: 'owner@example.com',
    }, 'auth')).toEqual({
      nome: 'Ana',
      senha: 'secret',
      nomeFantasia: 'Bar da Ana',
      role: 'DONO',
      status: 'PENDENTE_PAGAMENTO',
      criadoPor: 'owner@example.com',
    })

    expect(toLegacyWire<unknown>({
      customerName: 'Mesa 1',
      status: 'CLOSED',
      items: [{ productId: 9, quantity: 1, unitPrice: 8 }],
    }, 'order')).toEqual({
      cliente: 'Mesa 1',
      status: 'FECHADO',
      itens: [{ produtoId: 9, quantidade: 1, precoHistorico: 8 }],
    })
  })

  it('prefers canonical keys when a mixed response contains both versions', () => {
    expect(fromLegacyWire<unknown>({ nome: 'legacy', name: 'canonical' })).toEqual({ name: 'canonical' })
  })

  it('leaves binary response data untouched', () => {
    const blob = new Blob(['report'])
    expect(fromLegacyWire<unknown>(blob)).toBe(blob)
  })

  it('normalizes legacy and new realtime event names', () => {
    expect(normalizeRealtimeEventType('pedidos')).toBe('orders')
    expect(normalizeRealtimeEventType('sales')).toBe('sales')
    expect(normalizeRealtimeEventType('connected')).toBeUndefined()
  })
})
