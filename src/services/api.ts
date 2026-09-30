import axios from 'axios';
import { fromLegacyWire, resolveWireContext, toLegacyWire } from '@/lib/legacyWire';
import { authClient } from '@/lib/authClient';
import type { ServiceOffering, ServiceOrder } from '@/domain/services';

function isNativeServiceEndpoint(url: string | undefined): boolean {
  const pathname = (url ?? '').split('?')[0] ?? '';
  return /(?:^|\/)servicos(?:\/|$)/.test(pathname) || /(?:^|\/)ordens-servico(?:\/|$)/.test(pathname);
}

function hasServiceSaleLine(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const body = value as { items?: unknown; itens?: unknown };
  const items = Array.isArray(body.items) ? body.items : body.itens;
  return Array.isArray(items) && items.some((item) => !!item && typeof item === 'object' && ('serviceId' in item || 'serviceOfferingId' in item));
}

declare module 'axios' {
  interface AxiosRequestConfig {
    // 401 esperado (ex: /usuarios/me no 1o login GoTrue, antes do complete-signup) —
    // quem chamou trata; o interceptor não desloga nem redireciona.
    skipAuthRedirect?: boolean;
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001'),
});

export function serializeRequestData(url: string | undefined, value: unknown): unknown {
  if (isNativeServiceEndpoint(url) || (url?.includes('/vendas') && hasServiceSaleLine(value))) return value;
  if (url?.includes('/cozinha/') || url?.includes('/entregas/') || url?.startsWith('/calendar')) return value;
  return toLegacyWire(value, resolveWireContext(url));
}

export function normalizeResponseData(url: string | undefined, value: unknown): unknown {
  if (isNativeServiceEndpoint(url)) return value;
  if (url?.includes('/cozinha/') || url?.includes('/entregas/') || url?.startsWith('/calendar')) return value;
  return fromLegacyWire(value, resolveWireContext(url));
}

api.interceptors.request.use(async (config) => {
  const { data } = await authClient.getSession();
  if (data.session?.access_token) {
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData) && !(config.data instanceof Blob)) {
    config.data = serializeRequestData(config.url, config.data);
  }
  if (config.params && typeof config.params === 'object') {
    config.params = serializeRequestData(config.url, config.params);
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    response.data = normalizeResponseData(response.config.url, response.data);
    return response;
  },
  (error) => {
    if (error.response?.data && !isNativeServiceEndpoint(error.config?.url)) {
      error.response.data = fromLegacyWire(error.response.data);
    }
    if (error.response && error.response.status === 401 && !error.config?.skipAuthRedirect) {
      // auth-js tenta refresh automático antes deste ponto.
      void authClient.signOut();
      window.location.href = '/login';
    }
    // Se receber 402 (Payment Required), não faz logout, mas permite que o frontend trate
    // para redirecionar para a página de pagamento.
    return Promise.reject(error);
  }
);

export function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const directCode = (error as { code?: unknown }).code;
  if (typeof directCode === 'string' && directCode.length > 0) return directCode;
  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data;
  if (!data || typeof data !== 'object') return undefined;
  const code = (data as { code?: unknown }).code;
  return typeof code === 'string' && code.length > 0 ? code : undefined;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data;
  if (data && typeof data === 'object') {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

export interface ServiceOfferingInput {
  name: string;
  description?: string | null;
  referencePrice?: number | null;
}
export type ServiceOrderInput = Pick<ServiceOrder, 'customerName' | 'description'> & Partial<Pick<ServiceOrder, 'dueAt' | 'responsibleId'>>;
export type ServiceOrderQuoteInput = {
  productId?: string | number;
  serviceOfferingId?: string | number;
  quantity: number;
  unitPrice?: number;
};
export interface ServiceListQuery { page?: number; limit?: number; search?: string; active?: boolean | 'all' }
export interface ServiceOrderListQuery { page?: number; limit?: number; search?: string; status?: ServiceOrder['status']; dueBefore?: string }
export interface PagedResponse<T> { data: T[]; total: number }

export const servicesApi = {
  async list(query: ServiceListQuery = {}): Promise<PagedResponse<ServiceOffering>> {
    const response = await api.get<ServiceOffering[]>('/servicos', { params: query });
    return { data: response.data, total: Number(response.headers['x-total-count'] ?? response.data.length) };
  },
  async get(id: string | number): Promise<ServiceOffering> { return (await api.get<ServiceOffering>(`/servicos/${id}`)).data; },
  async create(input: ServiceOfferingInput): Promise<ServiceOffering> { return (await api.post<ServiceOffering>('/servicos', input)).data; },
  async update(id: string | number, input: Partial<ServiceOfferingInput> & { isActive?: boolean }): Promise<ServiceOffering> { return (await api.patch<ServiceOffering>(`/servicos/${id}`, input)).data; },
  async listOrders(query: ServiceOrderListQuery = {}): Promise<PagedResponse<ServiceOrder>> {
    const response = await api.get<ServiceOrder[]>('/ordens-servico', { params: query });
    return { data: response.data, total: Number(response.headers['x-total-count'] ?? response.data.length) };
  },
  async getOrder(id: string | number): Promise<ServiceOrder> { return (await api.get<ServiceOrder>(`/ordens-servico/${id}`)).data; },
  async createOrder(input: ServiceOrderInput): Promise<ServiceOrder> { return (await api.post<ServiceOrder>('/ordens-servico', input)).data; },
  async updateOrder(id: string | number, input: Partial<ServiceOrderInput> & { expectedUpdatedAt: string }): Promise<ServiceOrder> { return (await api.patch<ServiceOrder>(`/ordens-servico/${id}`, input)).data; },
  async replaceQuote(id: string | number, expectedUpdatedAt: string, items: ServiceOrderQuoteInput[]): Promise<ServiceOrder> { return (await api.put<ServiceOrder>(`/ordens-servico/${id}/orcamento`, { expectedUpdatedAt, items })).data; },
  async action(id: string | number, action: 'aprovar' | 'iniciar' | 'fechar' | 'cancelar' | 'reabrir', expectedUpdatedAt?: string) {
    return (await api.post<{ order: ServiceOrder; sale?: { id: string | number; total: number }; retried?: boolean }>(`/ordens-servico/${id}/${action}`, expectedUpdatedAt ? { expectedUpdatedAt } : {})).data;
  },
};

export async function getSseToken(): Promise<string> {
  const response = await api.post('/auth/sse-token')
  return response.data.token
}

export default api;
