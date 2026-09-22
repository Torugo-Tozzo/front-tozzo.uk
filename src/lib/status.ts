import type { OrderItemStatus } from '@/domain/models';

export { getStatusLabel } from '@/i18n/labels'
export type { OrderItemStatus } from '@/domain/models'

export const ORDER_ITEM_STATUS_OPTIONS: { value: OrderItemStatus; labelKey: string }[] = [
  { value: 'REQUESTED', labelKey: 'status.requested' },
  { value: 'IN_PREPARATION', labelKey: 'status.inPreparation' },
  { value: 'READY', labelKey: 'status.ready' },
  { value: 'DELIVERED', labelKey: 'status.delivered' },
]
