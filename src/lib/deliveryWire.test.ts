import { expect, test } from 'bun:test'
import { fromLegacyWire, toLegacyWire } from './legacyWire'
import { normalizeResponseData, serializeRequestData } from '@/services/api'

test('delivery staff role and order address survive legacy wire conversion', () => {
  expect(fromLegacyWire({ role: 'ENTREGADOR' }, 'user')).toEqual({ role: 'DRIVER' })
  expect(toLegacyWire({ role: 'DRIVER' }, 'user')).toEqual({ role: 'ENTREGADOR' })
  expect(serializeRequestData('/pedidos', { isDelivery: true, deliveryAddress: 'Rua A' })).toEqual({ isDelivery: true, deliveryAddress: 'Rua A' })
  expect(normalizeResponseData('/pedidos', { isDelivery: true, deliveryAddress: 'Rua A', status: 'ENTREGANDO' })).toEqual({ isDelivery: true, deliveryAddress: 'Rua A', status: 'DELIVERING' })
})

test('delivery board uses canonical request and response fields', () => {
  const payload = { action: 'START', expectedUpdatedAt: '2026-09-23T00:00:00.000Z' }
  expect(serializeRequestData('/entregas/pedidos/1', payload)).toEqual(payload)
  expect(normalizeResponseData('/entregas/pedidos', { orders: [{ stage: 'WAITING' }] })).toEqual({ orders: [{ stage: 'WAITING' }] })
})
