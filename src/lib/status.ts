import type { OrderStatus } from '@/domain/models';

export type { OrderStatus };
export type OrderStatusFilter = OrderStatus | 'NOT_CLOSED';

export const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'OPEN', label: 'Aberto' },
  { value: 'IN_PREPARATION', label: 'Em Preparo' },
  { value: 'DELIVERING', label: 'Entregando' },
  { value: 'CLOSED', label: 'Fechado' },
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  OPEN: '#dc2626', IN_PREPARATION: '#d97706', DELIVERING: '#2563eb', CLOSED: '#6b7280',
};

const STATUS_LABELS: Record<OrderStatus | 'NOT_CLOSED', string> = {
  OPEN: 'Aberto', IN_PREPARATION: 'Em Preparo', DELIVERING: 'Entregando', CLOSED: 'Fechado', NOT_CLOSED: 'Não Fechados',
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

export function getStatusLabel(status: string): string {
  const canonical = String(status ?? '').trim().toUpperCase();
  if (canonical === 'NOT_CLOSED') return 'Não Fechados';
  return canonical in STATUS_LABELS ? STATUS_LABELS[canonical as OrderStatus] : status;
}
