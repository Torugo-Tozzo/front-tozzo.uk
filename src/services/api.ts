import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tozzo_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('tozzo_token');
      window.dispatchEvent(new Event('auth:logout'));
      window.location.href = '/login';
    }
    // Se receber 402 (Payment Required), não faz logout, mas permite que o frontend trate
    // para redirecionar para a página de pagamento.
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: any, fallback: string): string {
  const msg = error?.response?.data?.message;
  return msg ? String(msg) : fallback;
}

export default api;
