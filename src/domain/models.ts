export type EstablishmentStatus = 'ACTIVE' | 'PENDING_PAYMENT' | 'SUSPENDED';
export type UserRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'CUSTOMER';
export type OrderItemStatus = 'REQUESTED' | 'IN_PREPARATION' | 'DELIVERED';

export interface Establishment {
  id: number | string;
  tradeName: string;
  status: EstablishmentStatus;
}

export interface User {
  id: number | string;
  name: string;
  email: string;
  role?: UserRole;
  establishment?: Establishment;
  establishmentId?: number | string | null;
  establishmentName?: string | null;
}

export interface ProductType {
  id: number | string;
  description: string;
  color?: string;
  isActive?: boolean;
}

export interface Product {
  id: number | string;
  name: string;
  price: number;
  productTypeId?: number | null;
  ingredients?: string | null;
  sourceProductId?: number | string | null;
  productType?: ProductType | null;
}

export interface OrderItem {
  id?: number | string;
  productId: number | string;
  quantity: number;
  status: OrderItemStatus;
  unitPriceAtOrder?: number | null;
  product?: Product | null;
}

export interface Order {
  id: number | string;
  customerName?: string | null;
  total: number;
  isOpen: boolean;
  openedAt?: string | null;
  updatedAt?: string | null;
  createdBy?: number | string | null;
  createdByName?: string | null;
  seller?: User | null;
  items?: OrderItem[];
  deletedAt?: string | null;
}

export interface SaleItem {
  id?: number | string;
  productId: number | string;
  quantity: number;
  unitPriceAtSale?: number | null;
  product?: Product | null;
}

export interface Sale {
  id: number | string;
  customerName?: string | null;
  total: number;
  soldAt: string;
  isCancelled?: boolean;
  createdBy?: number | string | null;
  createdByName?: string | null;
  seller?: User | null;
  items?: SaleItem[];
  deletedAt?: string | null;
}

export interface PageInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface Paged<T> {
  data: T[];
  total: number;
  pagination?: PageInfo;
}
