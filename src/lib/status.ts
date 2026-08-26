import type { OrderStatus } from '@/domain/models';
export { getStatusLabel } from '@/i18n/labels'

export type { OrderStatus };
export type OrderStatusFilter = OrderStatus | 'NOT_CLOSED';

export const STATUS_OPTIONS: { value: OrderStatus; labelKey: string }[] = [
  { value: 'OPEN', labelKey: 'status.open' },
  { value: 'IN_PREPARATION', labelKey: 'status.inPreparation' },
  { value: 'DELIVERING', labelKey: 'status.delivering' },
  { value: 'CLOSED', labelKey: 'status.closed' },
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  OPEN: '#dc2626', IN_PREPARATION: '#d97706', DELIVERING: '#2563eb', CLOSED: '#6b7280',
};

export function normalizeOrderStatus(value: string): OrderStatus {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized === 'OPEN' || normalized === 'IN_PREPARATION' || normalized === 'DELIVERING' || normalized === 'CLOSED'
    ? normalized
    : 'CLOSED';
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[normalizeOrderStatus(status)];
}
