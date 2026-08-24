import type { UserRole } from '@/domain/models';

export type WireContext =
  | 'auth'
  | 'user'
  | 'establishment'
  | 'product'
  | 'productType'
  | 'order'
  | 'sale'
  | 'chart'
  | undefined;

const fieldToLegacy: Record<string, string> = {
  tradeName: 'nomeFantasia',
  name: 'nome',
  phone: 'telefone',
  establishmentId: 'estabelecimentoId',
  establishment: 'estabelecimento',
  establishmentName: 'nomeEstabelecimento',
  description: 'descricao',
  isActive: 'ativo',
  isEditable: 'editavel',
  color: 'cor',
  productTypeId: 'tipoProdutoId',
  productType: 'tipoProduto',
  sourceProductId: 'origemProdutoId',
  product: 'produto',
  price: 'preco',
  ingredients: 'ingredientes',
  customerName: 'cliente',
  isCancelled: 'excluida',
  sellerId: 'usuarioVendedorId',
  seller: 'vendedor',
  orderId: 'pedidoId',
  saleId: 'vendaId',
  productId: 'produtoId',
  quantity: 'quantidade',
  unitPrice: 'precoHistorico',
  unitPriceAtSale: 'precoHistorico',
  unitPriceAtOrder: 'precoHistorico',
  createdBy: 'criadoPor',
  createdByName: 'criado_por_nome',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  members: 'membros',
  products: 'produtos',
  productTypes: 'tiposProduto',
  types: 'tipos',
  orders: 'pedidos',
  sales: 'vendas',
  orderItems: 'itensPedido',
  saleItems: 'itensVenda',
  items: 'itens',
  openingAt: 'dataAbertura',
  openedAt: 'dataCriacao',
  soldAt: 'horario',
  startAt: 'dataInicial',
  endAt: 'dataFinal',
  quantitySold: 'quantidadeVendida',
  totalRevenue: 'totalFaturado',
  totalUnitsSold: 'totalUnidadesVendidas',
  totalSales: 'totalNumeroVendas',
  closing: 'fechamento',
  reportFormat: 'tipo',
  eventType: 'tipo',
  password: 'senha',
  code: 'codigo',
  message: 'mensagem',
  detail: 'detalhe',
  statusUrl: 'status_url',
  downloadUrl: 'download_url',
  taskId: 'task_id',
};

const legacyToField: Record<string, string> = Object.fromEntries(
  Object.entries(fieldToLegacy).map(([key, value]) => [value, key]),
);

const legacyRoles: Record<string, UserRole> = {
  DONO: 'OWNER',
  OWNER: 'OWNER',
  GERENTE: 'MANAGER',
  MANAGER: 'MANAGER',
  FUNCIONARIO: 'EMPLOYEE',
  EMPLOYEE: 'EMPLOYEE',
  CLIENTE: 'CUSTOMER',
  CUSTOMER: 'CUSTOMER',
};

const canonicalRoles: Record<UserRole, string> = {
  OWNER: 'DONO',
  MANAGER: 'GERENTE',
  EMPLOYEE: 'FUNCIONARIO',
  CUSTOMER: 'CLIENTE',
};

const legacyStatuses: Record<string, string> = {
  ACTIVE: 'ATIVO',
  PENDING_PAYMENT: 'PENDENTE_PAGAMENTO',
  SUSPENDED: 'SUSPENSO',
  OPEN: 'ABERTO',
  IN_PREPARATION: 'EM_PREPARO',
  DELIVERING: 'ENTREGANDO',
  CLOSED: 'FECHADO',
  NOT_CLOSED: 'NAO_FECHADOS',
};

const canonicalStatuses: Record<string, string> = {
  ATIVO: 'ACTIVE',
  ACTIVE: 'ACTIVE',
  PENDENTE_PAGAMENTO: 'PENDING_PAYMENT',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  SUSPENSO: 'SUSPENDED',
  SUSPENDED: 'SUSPENDED',
  ABERTO: 'OPEN',
  OPEN: 'OPEN',
  EM_PREPARO: 'IN_PREPARATION',
  IN_PREPARATION: 'IN_PREPARATION',
  ENTREGANDO: 'DELIVERING',
  DELIVERING: 'DELIVERING',
  FECHADO: 'CLOSED',
  CLOSED: 'CLOSED',
  NAO_FECHADOS: 'NOT_CLOSED',
  NOT_CLOSED: 'NOT_CLOSED',
};

const secretKeys = new Set(['senha', 'password', 'senhaHash', 'passwordHash']);

export function resolveWireContext(url?: string): WireContext {
  if (!url) return undefined;
  if (url.includes('/auth/register') || url.includes('/auth/login')) return 'auth';
  if (url.includes('/usuarios')) return 'user';
  if (url.includes('/estabelecimentos')) return 'establishment';
  if (url.includes('/tipos')) return 'productType';
  if (url.includes('/produtos')) return 'product';
  if (url.includes('/graficos')) return 'chart';
  if (url.includes('/pedidos')) return 'order';
  if (url.includes('/vendas')) return 'sale';
  return undefined;
}

function contextFor(parent: WireContext, key: string): WireContext {
  if (key === 'order' || key === 'orders' || key === 'pedido' || key === 'pedidos' || key === 'orderItems' || key === 'itensPedido') return 'order';
  if (key === 'sale' || key === 'sales' || key === 'venda' || key === 'vendas' || key === 'saleItems' || key === 'itensVenda') return 'sale';
  if (key === 'products' || key === 'product') return 'product';
  if (key === 'types' || key === 'productTypes' || key === 'productType') return 'productType';
  if (key === 'establishment') return 'establishment';
  if (key === 'seller' || key === 'user') return 'user';
  if (key === 'closing' || key === 'reportFormat') return 'chart';
  return parent;
}

function keyToCanonical(key: string, context: WireContext): string {
  if (key === 'horario') return context === 'order' ? 'openedAt' : 'soldAt';
  if (key === 'dataCriacao') return 'openedAt';
  if (key === 'dataAbertura') return 'openingAt';
  if (key === 'dataInicial') return 'startAt';
  if (key === 'dataFinal') return 'endAt';
  if (key === 'precoHistorico') return context === 'sale' ? 'unitPriceAtSale' : 'unitPriceAtOrder';
  if (key === 'criado_por') return 'createdBy';
  if (key === 'tipo' && context === 'chart') return 'reportFormat';
  return legacyToField[key] ?? key;
}

function keyToLegacy(key: string, context: WireContext): string {
  if (key === 'establishmentName' && context === 'auth') return 'nomeFantasia';
  if (key === 'soldAt') return 'horario';
  if (key === 'openedAt') return context === 'order' ? 'dataCriacao' : 'horario';
  return fieldToLegacy[key] ?? key;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deserialize(value: unknown, context?: WireContext): unknown {
  if (Array.isArray(value)) return value.map((item) => deserialize(item, context));
  if (!isPlainRecord(value)) return value;

  const result: Record<string, unknown> = {};
  const entries = Object.entries(value);
  // Process legacy keys first so a response that contains both versions uses
  // the canonical field as the source of truth instead of depending on JSON
  // property order.
  const orderedEntries = entries.sort(([left], [right]) => {
    const leftIsCanonical = keyToCanonical(left, context) === left;
    const rightIsCanonical = keyToCanonical(right, context) === right;
    return Number(leftIsCanonical) - Number(rightIsCanonical);
  });

  for (const [key, entry] of orderedEntries) {
    if (secretKeys.has(key)) continue;
    const canonical = keyToCanonical(key, context);
    if (canonical === 'role') {
      result[canonical] = legacyRoles[String(entry ?? '').trim().toUpperCase()] ?? 'EMPLOYEE';
    } else if (canonical === 'status' && typeof entry === 'string') {
      result[canonical] = canonicalStatuses[entry.trim().toUpperCase()] ?? entry;
    } else {
      result[canonical] = deserialize(entry, contextFor(context, canonical));
    }
  }
  return result;
}

function serialize(value: unknown, context?: WireContext): unknown {
  if (Array.isArray(value)) return value.map((item) => serialize(item, context));
  if (!isPlainRecord(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'passwordHash') continue;
    const legacy = keyToLegacy(key, context);
    if (key === 'role') {
      const role = legacyRoles[String(entry ?? '').trim().toUpperCase()];
      result[legacy] = canonicalRoles[role ?? 'EMPLOYEE'];
    } else if (key === 'status' && typeof entry === 'string') {
      result[legacy] = legacyStatuses[entry.trim().toUpperCase()] ?? entry;
    } else {
      result[legacy] = serialize(entry, contextFor(context, key));
    }
  }
  return result;
}

export function fromLegacyWire<T>(value: T, context?: WireContext): T {
  return deserialize(value, context) as T;
}

export function toLegacyWire<T>(value: T, context?: WireContext): T {
  return serialize(value, context) as T;
}

export function normalizeRole(value: unknown): UserRole {
  return legacyRoles[String(value ?? '').trim().toUpperCase()] ?? 'EMPLOYEE';
}

export function normalizeStatus(value: unknown): string {
  return canonicalStatuses[String(value ?? '').trim().toUpperCase()] ?? String(value ?? '');
}

export function normalizeRealtimeEventType(value: unknown): 'orders' | 'sales' | undefined {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'PEDIDOS' || normalized === 'ORDERS') return 'orders';
  if (normalized === 'VENDAS' || normalized === 'SALES') return 'sales';
  return undefined;
}
