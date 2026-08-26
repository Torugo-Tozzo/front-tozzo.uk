/**
 * DTOs for the current HTTP wire contract.
 *
 * These types deliberately keep the legacy Portuguese keys at the adapter
 * boundary. Components and services should consume the English models from
 * models.ts instead of importing these types.
 */
export type WireId = number | string;

export type LegacyUserRole = 'DONO' | 'GERENTE' | 'FUNCIONARIO' | 'CLIENTE';
export type LegacyEstablishmentStatus = 'ATIVO' | 'PENDENTE_PAGAMENTO' | 'SUSPENSO';
export type LegacyOrderStatus = 'ABERTO' | 'EM_PREPARO' | 'ENTREGANDO' | 'FECHADO' | 'NAO_FECHADOS';

export interface LegacyEstablishmentDto {
  id: WireId;
  nomeFantasia?: string | null;
  status?: LegacyEstablishmentStatus | string;
}

export interface LegacyUserDto {
  id: WireId;
  nome?: string | null;
  email?: string | null;
  role?: LegacyUserRole | string;
  estabelecimento?: LegacyEstablishmentDto | null;
  estabelecimentoId?: WireId | null;
}

export interface LegacyProductTypeDto {
  id: WireId;
  descricao?: string | null;
  cor?: string | null;
  ativo?: boolean | number | null;
  editavel?: boolean | null;
}

export interface LegacyProductDto {
  id: WireId;
  nome?: string | null;
  preco?: number | string | null;
  ingredientes?: string | null;
  tipoProdutoId?: WireId | null;
  tipoProduto?: LegacyProductTypeDto | null;
  origemProdutoId?: WireId | null;
}

export interface LegacyOrderItemDto {
  id?: WireId;
  produtoId?: WireId;
  quantidade?: number | string;
  precoHistorico?: number | string | null;
  preco?: number | string | null;
  produto?: LegacyProductDto | null;
}

export interface LegacyOrderDto {
  id: WireId;
  cliente?: string | null;
  total?: number | string;
  status?: LegacyOrderStatus | string;
  dataCriacao?: string | null;
  updatedAt?: string | null;
  vendedor?: LegacyUserDto | null;
  itens?: LegacyOrderItemDto[] | null;
}

export interface LegacySaleItemDto {
  id?: WireId;
  produtoId?: WireId;
  quantidade?: number | string;
  precoHistorico?: number | string | null;
  preco?: number | string | null;
  produto?: LegacyProductDto | null;
}

export interface LegacySaleDto {
  id: WireId;
  cliente?: string | null;
  total?: number | string;
  horario?: string | null;
  vendedor?: LegacyUserDto | null;
  itens?: LegacySaleItemDto[] | null;
  excluida?: boolean | null;
}

export interface LegacyCredentialsDto {
  email: string;
  senha: string;
}

export interface LegacyUserRequestDto {
  nome: string;
  email: string;
  senha?: string;
  role: LegacyUserRole;
}

export interface LegacyProductRequestDto {
  nome: string;
  preco: number;
  ingredientes?: string;
  tipoProdutoId: WireId;
}

export interface LegacyOrderItemRequestDto {
  produtoId: WireId;
  quantidade: number;
  precoHistorico?: number;
}

export interface LegacyOrderRequestDto {
  cliente: string;
  itens: LegacyOrderItemRequestDto[];
}

export interface LegacySaleRequestDto {
  cliente: string;
  itens: LegacyOrderItemRequestDto[];
}
