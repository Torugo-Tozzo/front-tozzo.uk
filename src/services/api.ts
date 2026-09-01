import axios from 'axios';
import { fromLegacyWire, resolveWireContext, toLegacyWire } from '@/lib/legacyWire';
import { authClient } from '@/lib/authClient';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

export function serializeRequestData(url: string | undefined, value: unknown): unknown {
  return toLegacyWire(value, resolveWireContext(url));
}

export function normalizeResponseData(url: string | undefined, value: unknown): unknown {
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
    if (error.response?.data) {
      error.response.data = fromLegacyWire(error.response.data);
    }
    if (error.response && error.response.status === 401) {
      // auth-js tenta refresh automático antes deste ponto.
      void authClient.signOut();
      window.dispatchEvent(new Event('auth:logout'));
      window.location.href = '/login';
    }
    // Se receber 402 (Payment Required), não faz logout, mas permite que o frontend trate
    // para redirecionar para a página de pagamento.
    return Promise.reject(error);
  }
);

export function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
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

export async function getSseToken(): Promise<string> {
  const response = await api.post('/auth/sse-token')
  return response.data.token
}

export default api;
