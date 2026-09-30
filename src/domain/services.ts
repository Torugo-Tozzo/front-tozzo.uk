import type { WireId } from './dtos'

export type ServiceOrderStatus = 'ABERTA' | 'ORCADA' | 'APROVADA' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'CANCELADA'

export interface ServiceOffering {
  id: WireId;
  establishmentId: WireId;
  name: string;
  description: string | null;
  referencePrice: number | null;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceOrderItem {
  id?: WireId;
  productId: WireId | null;
  serviceOfferingId: WireId | null;
  description: string;
  quantity: number;
  unitPrice: number;
  updatedAt?: string;
}

export interface ServiceOrderEvent {
  id: WireId;
  fromStatus: ServiceOrderStatus | null;
  toStatus: ServiceOrderStatus;
  action: string;
  createdAt: string;
  userId: WireId | null;
}

export interface ServiceOrder {
  id: WireId;
  establishmentId: WireId;
  customerName: string;
  description: string;
  status: ServiceOrderStatus;
  dueAt: string | null;
  responsibleId: WireId | null;
  completedAt: string | null;
  updatedAt: string;
  items: ServiceOrderItem[];
  events?: ServiceOrderEvent[];
  total?: number;
  sale?: { id: WireId; total: number; isCancelled?: boolean } | null;
}

export interface SaleServiceItem {
  id?: WireId;
  serviceOfferingId: WireId | null;
  description: string;
  quantity: number;
  unitPriceAtSale: number;
}

export type SaleLineInput =
  | { productId: WireId; quantity: number }
  | { serviceId: WireId; quantity: number; unitPriceAtSale: number }

export function serviceOrderTotal(items: readonly ServiceOrderItem[]): number {
  return items.reduce((total, item) => {
    if (Boolean(item.productId) === Boolean(item.serviceOfferingId)) throw new Error('Each quote line must reference exactly one product or service')
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) throw new Error('Invalid quote line')
    return total + Math.round(item.unitPrice * 100) * item.quantity / 100
  }, 0)
}

export function saleLinesFromServiceOrder(items: readonly ServiceOrderItem[]): SaleLineInput[] {
  serviceOrderTotal(items)
  return items.map((item) => item.productId !== null
    ? { productId: item.productId, quantity: item.quantity }
    : { serviceId: item.serviceOfferingId!, quantity: item.quantity, unitPriceAtSale: item.unitPrice })
}
