# Fase 2 — Auth: senha + 2FA + verificação de email (Front) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard web troca de token único pra access+refresh, cadastro/login lidam com verificação de email e 2FA, e ganha telas de esqueci-senha/reset/confirmar-email + setup de 2FA nas Configurações.

**Architecture:** Interceptor axios existente ganha retry automático de refresh no primeiro 401 (com mutex pra não disparar 2 refreshes em paralelo). Telas novas seguem o padrão visual já usado em `LoginPage.tsx`/`SettingsPage.tsx` (mesmos componentes `Card`/`Input`/`Button`, mesmo `Alert` já usado como paywall banner na Fase 2/tiers).

**Tech Stack:** Vite + React 18 + TS + Tailwind + Radix + `react-router` + `axios` + `bun:test`.

**Spec:** `TozzoBurger/docs/superpowers/specs/2026-08-31-fase-2-auth-senha-2fa-email-design.md`

**Depende de:** o plano da API (`api/api-tozzo.uk/docs/superpowers/plans/2026-08-31-fase-2-auth-senha-2fa-email-api.md`) — em especial a Task 7, que troca a resposta de `login`/`register` de `{ token }` pra `{ accessToken, refreshToken }` / `{ code: 'AUTH_EMAIL_VERIFICATION_REQUIRED' }` / `{ code: 'TOTP_REQUIRED', challengeToken }`.

## Global Constraints

- `localStorage` guarda 2 chaves agora: `tozzo_access_token` e `tozzo_refresh_token` (trocado de `tozzo_token` único — migração de storage, ver Task 1).
- Só 1 tentativa de refresh por request original (`_retry` flag no config do axios) — evita loop infinito se o refresh também falhar.
- Múltiplos 401 simultâneos (ex: 3 requests em paralelo) devem compartilhar a mesma chamada de refresh em voo, não disparar 3 refreshes — usar uma promise compartilhada (mutex simples em módulo).

---

## Task 1: `services/api.ts` — access+refresh token e retry automático

**Files:**
- Modify: `src/services/api.ts` (inteiro)
- Test: `src/services/api.test.ts` (criar se não existir, senão estender)

**Interfaces:**
- Produces: `setSession({accessToken, refreshToken})`, `clearSession()`, `getAccessToken()/getRefreshToken()` — usados pela Task 2 (`AuthContext`).

- [ ] **Step 1: Escrever o teste**

```ts
// src/services/api.test.ts
import { beforeEach, describe, expect, test, vi } from "bun:test";
import MockAdapter from "axios-mock-adapter"; // se nao existir no projeto, usar o mesmo padrao de mock de axios ja usado em outros testes do repo (replaceProperty em api.get/post) em vez de instalar dependencia nova
import api, { setSession, clearSession, getAccessToken, getRefreshToken } from "./api";

describe("session storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("setSession grava as 2 chaves", () => {
    setSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    expect(getAccessToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  test("clearSession remove as 2 chaves", () => {
    setSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    clearSession();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
```

Nota: se o projeto já tiver um padrão estabelecido pra mockar chamadas de rede em teste de interceptor axios (verificar `src/services/`/`src/test/` antes de escrever), seguir esse padrão pro teste de retry do Step 6 abaixo em vez do que estiver sugerido aqui — não introduzir uma lib de mock nova (`axios-mock-adapter`) se o repo já resolve isso de outro jeito.

- [ ] **Step 2: Rodar (deve falhar — funções não existem)**

Run: `bun test src/services/api.test.ts`
Expected: FAIL

- [ ] **Step 3: Reescrever `src/services/api.ts`**

```ts
import axios from 'axios';
import { fromLegacyWire, resolveWireContext, toLegacyWire } from '@/lib/legacyWire';

const ACCESS_TOKEN_KEY = 'tozzo_access_token';
const REFRESH_TOKEN_KEY = 'tozzo_refresh_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

export function serializeRequestData(url: string | undefined, value: unknown): unknown {
  return toLegacyWire(value, resolveWireContext(url));
}

export function normalizeResponseData(url: string | undefined, value: unknown): unknown {
  return fromLegacyWire(value, resolveWireContext(url));
}

export function setSession({ accessToken, refreshToken }: { accessToken: string; refreshToken: string }): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const response = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
    const { accessToken, refreshToken: newRefreshToken } = response.data as { accessToken: string; refreshToken: string };
    setSession({ accessToken, refreshToken: newRefreshToken });
    return accessToken;
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData) && !(config.data instanceof Blob)) {
    config.data = serializeRequestData(config.url, config.data);
  }
  if (config.params && typeof config.params === 'object') {
    config.params = serializeRequestData(config.url, config.params);
  }
  return config;
});

const AUTH_ENDPOINTS_WITHOUT_RETRY = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/2fa/verify-login'];

api.interceptors.response.use(
  (response) => {
    response.data = normalizeResponseData(response.config.url, response.data);
    return response;
  },
  async (error) => {
    if (error.response?.data) {
      error.response.data = fromLegacyWire(error.response.data);
    }

    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const url = originalRequest?.url ?? '';
    const isExemptFromRetry = AUTH_ENDPOINTS_WITHOUT_RETRY.some((path) => url.includes(path));

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isExemptFromRetry) {
      originalRequest._retry = true;

      if (!refreshInFlight) {
        refreshInFlight = refreshAccessToken().finally(() => { refreshInFlight = null; });
      }
      const newAccessToken = await refreshInFlight;

      if (newAccessToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      }

      clearSession();
      window.dispatchEvent(new Event('auth:logout'));
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (error.response && error.response.status === 401) {
      // 401 num endpoint isento de retry (ex: refresh falhou de vez) — desloga direto.
      clearSession();
      window.dispatchEvent(new Event('auth:logout'));
      window.location.href = '/login';
    }
    // 402 continua sem deslogar — o frontend trata pra redirecionar pra /plan.
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
  const response = await api.post('/auth/sse-token');
  return response.data.token;
}

export default api;
```

- [ ] **Step 4: Rodar o teste do Step 1**

Run: `bun test src/services/api.test.ts`
Expected: PASS

- [ ] **Step 5: Buscar todo uso de `localStorage.getItem('tozzo_token')`/`localStorage.setItem('tozzo_token'...)`/`localStorage.removeItem('tozzo_token')` no repo e trocar pelas funções novas**

Run: `grep -rn "tozzo_token" src/` (ou Grep tool) — cada ocorrência fora de `api.ts` (esperado: `AuthContext.tsx`, possivelmente algum teste) precisa trocar pra `getAccessToken()`/`setSession()`/`clearSession()` — feito nas Tasks 2 e 3, não aqui; só mapear aqui pra não esquecer nenhuma.

- [ ] **Step 6: Escrever o teste de retry do interceptor**

Adicionar em `src/services/api.test.ts` (usar o padrão de mock de rede que o repo já usa — `replaceProperty` em métodos do `axios`/`api`, ou o helper equivalente já presente em `src/test/`):

```ts
test("401 dispara refresh e repete a chamada original com o token novo", async () => {
  setSession({ accessToken: "expired", refreshToken: "refresh-1" });

  let callCount = 0;
  const getMock = vi.fn().mockImplementation(() => {
    callCount += 1;
    if (callCount === 1) {
      return Promise.reject({ response: { status: 401, data: {} }, config: { url: "/produtos", headers: {} } });
    }
    return Promise.resolve({ data: [] });
  });
  const postMock = vi.fn().mockResolvedValue({ data: { accessToken: "fresh", refreshToken: "refresh-2" } });

  replaceProperty(api, "get", getMock);
  // refreshAccessToken usa axios.post direto (nao a instancia `api`), entao o mock desse POST precisa mirar no axios global — ajustar conforme o helper de mock disponivel no repo.

  await api.get("/produtos");
  expect(getAccessToken()).toBe("fresh");
});
```

Adaptar esse teste ao mecanismo de mock real do axios já usado no projeto (a implementação exata do refresh chama `axios.post` — não `api.post` — pra evitar recursão no próprio interceptor; o teste precisa mockar essa chamada globalmente, não só a instância `api`).

- [ ] **Step 7: Rodar o teste**

Run: `bun test src/services/api.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/services/api.ts src/services/api.test.ts
git commit -m "feat(auth): switch to access+refresh token with automatic retry on 401"
```

---

## Task 2: `AuthContext.tsx` — sessão de 2 tokens

**Files:**
- Modify: `src/contexts/AuthContext.tsx` (inteiro)
- Test: `src/contexts/AuthContext.test.tsx` (estender, já existe segundo o inventário do repo)

**Interfaces:**
- Consumes: `setSession`/`clearSession`/`getAccessToken` (Task 1).
- Produces: `login(accessToken: string, refreshToken: string): Promise<void>` (assinatura muda de 1 pra 2 parâmetros — **breaking change pra Task 3**), `logout()` (agora também chama `POST /auth/logout`).

- [ ] **Step 1: Ler o teste existente (`AuthContext.test.tsx`) antes de mudar, pra saber o que já está coberto e não duplicar**

- [ ] **Step 2: Estender/ajustar os testes existentes pra nova assinatura de `login`**

Qualquer teste que hoje chame `login('some-token')` precisa virar `login('access-token', 'refresh-token')`. Adicionar:

```tsx
test("login grava access e refresh token", async () => {
  // usar o harness de teste ja existente no arquivo
  await login("access-1", "refresh-1");
  expect(getAccessToken()).toBe("access-1");
  expect(getRefreshToken()).toBe("refresh-1");
});

test("logout chama POST /auth/logout e limpa a sessao", async () => {
  const postMock = vi.fn().mockResolvedValue({ data: { message: "ok" } });
  replaceProperty(api, "post", postMock);
  await login("access-1", "refresh-1");

  logout();

  expect(postMock).toHaveBeenCalledWith("/auth/logout", { refreshToken: "refresh-1" });
  expect(getAccessToken()).toBeNull();
});
```

- [ ] **Step 3: Rodar (deve falhar)**

Run: `bun test src/contexts/AuthContext.test.tsx`
Expected: FAIL

- [ ] **Step 4: Reescrever `AuthContext.tsx`**

Trocar `localStorage.getItem('tozzo_token')` (linhas 24, 91) por `getAccessToken()` (import de `@/services/api`).

Trocar a assinatura de `login` (linha 9, 109-115):

```ts
import api, { setSession, clearSession, getAccessToken } from '../services/api';
// ...
interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  refreshUserProfile: () => Promise<void>;
}
// ...
const login = async (accessToken: string, refreshToken: string) => {
  setSession({ accessToken, refreshToken });
  setIsAuthenticated(true);
  setIsLoading(true);
  await refreshUserProfile();
  setIsLoading(false);
};

const logout = () => {
  const refreshToken = localStorage.getItem('tozzo_refresh_token');
  if (refreshToken) {
    api.post('/auth/logout', { refreshToken }).catch((err) => console.warn('Failed to revoke refresh token', err));
  }
  clearSession();
  setIsAuthenticated(false);
  setUser(null);
  window.location.href = '/login';
};
```

`refreshUserProfile` (linha 22-87) usa `token.split('.')` pra decodificar o JWT — trocar `localStorage.getItem('tozzo_token')` (linha 24) por `getAccessToken()`, sem mais mudança (o formato do access token JWT não mudou, só ficou mais curto de duração).

`useEffect` de inicialização (linha 89-97) — trocar `localStorage.getItem('tozzo_token')` (linha 91) por `getAccessToken()`.

- [ ] **Step 5: Rodar o teste**

Run: `bun test src/contexts/AuthContext.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/contexts/AuthContext.tsx src/contexts/AuthContext.test.tsx
git commit -m "feat(auth): AuthContext handles access+refresh token pair and revokes on logout"
```

---

## Task 3: `LoginPage.tsx` — verificação de email + 2FA no fluxo de login/cadastro

**Files:**
- Modify: `src/pages/LoginPage.tsx` (inteiro)
- Test: `src/pages/LoginPage.test.tsx` (estender, já existe)

**Interfaces:**
- Consumes: `login(accessToken, refreshToken)` (Task 2).

- [ ] **Step 1: Estender o teste**

```tsx
test("cadastro nao loga automaticamente, mostra mensagem de confirmar email", async () => {
  const postMock = vi.fn().mockResolvedValue({ data: { code: "AUTH_EMAIL_VERIFICATION_REQUIRED", message: "..." } });
  replaceProperty(api, "post", postMock);
  renderPage();

  // preencher o formulario de cadastro e submeter (seguir o padrao ja usado no teste existente pra handleRegister)
  // ...
  await waitFor(() => expect(screen.getByText(/confirm.*email|confira seu email/i)).toBeTruthy());
});

test("login com email nao verificado mostra mensagem com opcao de reenviar", async () => {
  const postMock = vi.fn().mockRejectedValue({ response: { status: 403, data: { code: "EMAIL_NOT_VERIFIED" } } });
  replaceProperty(api, "post", postMock);
  renderPage();
  // preencher e submeter login
  await waitFor(() => expect(screen.getByText(/confirm.*email|confira seu email/i)).toBeTruthy());
});

test("login com 2FA ativo mostra prompt de codigo e completa apos confirmar", async () => {
  const postMock = vi.fn()
    .mockResolvedValueOnce({ data: { code: "TOTP_REQUIRED", challengeToken: "challenge-1" } })
    .mockResolvedValueOnce({ data: { user: { id: 1 }, accessToken: "a1", refreshToken: "r1" } });
  replaceProperty(api, "post", postMock);
  renderPage();
  // preencher e submeter login -> aparece campo de codigo -> preencher -> submeter
  await waitFor(() => expect(postMock).toHaveBeenNthCalledWith(2, "/auth/2fa/verify-login", { challengeToken: "challenge-1", code: expect.any(String) }));
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `bun test src/pages/LoginPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar os novos estados/branches**

Adicionar estado: `const [pendingChallengeToken, setPendingChallengeToken] = useState<string | null>(null)`, `const [totpCode, setTotpCode] = useState("")`, `const [awaitingEmailVerification, setAwaitingEmailVerification] = useState(false)`.

`handleLogin` (linha 59-86):

```ts
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)
  try {
    const response = await api.post("/auth/login", { email: loginEmail, password: loginPassword })

    if (response.data.code === "TOTP_REQUIRED") {
      setPendingChallengeToken(response.data.challengeToken)
      return
    }

    await login(response.data.accessToken, response.data.refreshToken)
    navigate("/dashboard")
  } catch (error: any) {
    if (error.response?.status === 402) {
      const { accessToken, refreshToken } = error.response.data ?? {}
      if (accessToken && refreshToken) {
        await login(accessToken, refreshToken)
        navigate("/plan")
        return
      }
    }
    if (getErrorCode(error) === "EMAIL_NOT_VERIFIED") {
      setAwaitingEmailVerification(true)
      return
    }
    console.error("Login failed", error)
    toast.error(translateError("login", error))
  } finally {
    setIsLoading(false)
  }
}

const handleTotpSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!pendingChallengeToken) return
  setIsLoading(true)
  try {
    const response = await api.post("/auth/2fa/verify-login", { challengeToken: pendingChallengeToken, code: totpCode })
    await login(response.data.accessToken, response.data.refreshToken)
    navigate("/dashboard")
  } catch (error) {
    toast.error(tAuth("totpInvalidCode"))
  } finally {
    setIsLoading(false)
  }
}

const handleResendVerification = async () => {
  try {
    await api.post("/auth/resend-verification", { email: loginEmail })
    toast.success(tAuth("verificationResent"))
  } catch (error) {
    toast.error(translateError("login", error))
  }
}
```

`handleRegister` (linha 88-119) — troca o branch de sucesso:

```ts
const response = await api.post("/auth/register", payload)

if (response.data.code === "AUTH_EMAIL_VERIFICATION_REQUIRED") {
  toast.success(tAuth("registrationSuccessCheckEmail"))
  setAwaitingEmailVerification(true)
} else {
  toast.success(tAuth("registrationSuccess"))
}
```

(o branch antigo `if (response.data.token) { await login(...) }` deixa de existir — cadastro nunca mais loga direto, sempre exige verificação primeiro.)

No JSX: quando `pendingChallengeToken` estiver setado, renderizar um form curto (label + `Input` numérico + botão) chamando `handleTotpSubmit` em vez do form de login/cadastro normal. Quando `awaitingEmailVerification` estiver `true`, renderizar uma mensagem com botão "reenviar" (`handleResendVerification`) no lugar dos 2 tabs.

- [ ] **Step 4: Adicionar as chaves de i18n novas (`auth.*`) em `en.json`/`pt-BR.json` + tradução nos outros 4**

```json
"totpTitle": "Two-factor code",
"totpDescription": "Enter the 6-digit code from your authenticator app.",
"totpInvalidCode": "Invalid code. Try again.",
"checkEmailTitle": "Confirm your email",
"checkEmailDescription": "We sent a confirmation link to your email. Click it to activate your account.",
"resendVerification": "Resend email",
"verificationResent": "Verification email resent.",
"registrationSuccessCheckEmail": "Account created. Check your email to confirm it before logging in."
```

Português:

```json
"totpTitle": "Código de dois fatores",
"totpDescription": "Digite o código de 6 dígitos do seu app autenticador.",
"totpInvalidCode": "Código inválido. Tente de novo.",
"checkEmailTitle": "Confirme seu email",
"checkEmailDescription": "Mandamos um link de confirmação pro seu email. Clique nele pra ativar sua conta.",
"resendVerification": "Reenviar email",
"verificationResent": "Email de verificação reenviado.",
"registrationSuccessCheckEmail": "Conta criada. Confira seu email pra confirmar antes de fazer login."
```

Registrar as entradas novas em `src/i18n/ui-inventory.test.ts` (mesmo procedimento já usado no plano de tiers — source:linha real do arquivo final).

- [ ] **Step 5: Rodar os testes**

Run: `bun test src/pages/LoginPage.test.tsx src/i18n`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx src/i18n/locales/*.json src/i18n/ui-inventory.test.ts
git commit -m "feat(auth): handle email verification and TOTP challenge in login/register flow"
```

---

## Task 4: Telas novas — esqueci-senha, reset, confirmar email

**Files:**
- Create: `src/pages/ForgotPasswordPage.tsx`, `src/pages/ResetPasswordPage.tsx`, `src/pages/VerifyEmailPage.tsx` (+ `.test.tsx` de cada)
- Modify: `src/App.tsx` (rotas, linhas 42-50), `src/pages/LoginPage.tsx` (link "esqueci minha senha")

**Interfaces:**
- Consumes: `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/verify-email`.

- [ ] **Step 1: Escrever os 3 testes (1 por página, seguindo o padrão de `LoginPage.test.tsx`)**

```tsx
// src/pages/ForgotPasswordPage.test.tsx (esqueleto — replicar o harness de LoginPage.test.tsx)
test("envia o pedido de reset e mostra mensagem de sucesso", async () => {
  const postMock = vi.fn().mockResolvedValue({ data: { message: "ok" } });
  replaceProperty(api, "post", postMock);
  renderPage();
  await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
  await userEvent.click(screen.getByRole("button", { name: /send|enviar/i }));
  expect(postMock).toHaveBeenCalledWith("/auth/forgot-password", { email: "user@example.com" });
  await waitFor(() => expect(screen.getByText(/check your email|confira seu email/i)).toBeTruthy());
});
```

```tsx
// src/pages/ResetPasswordPage.test.tsx
test("le o token da URL e troca a senha", async () => {
  const postMock = vi.fn().mockResolvedValue({ data: { message: "ok" } });
  replaceProperty(api, "post", postMock);
  render(<MemoryRouter initialEntries={["/reset-password?token=abc123"]}><I18nProvider><Routes><Route path="/reset-password" element={<ResetPasswordPage />} /></Routes></I18nProvider></MemoryRouter>);
  await userEvent.type(screen.getByLabelText(/new password|nova senha/i), "novaSenha123");
  await userEvent.click(screen.getByRole("button", { name: /reset|redefinir/i }));
  expect(postMock).toHaveBeenCalledWith("/auth/reset-password", { token: "abc123", password: "novaSenha123" });
});
```

```tsx
// src/pages/VerifyEmailPage.test.tsx
test("confirma o email automaticamente ao montar, usando o token da URL", async () => {
  const postMock = vi.fn().mockResolvedValue({ data: { message: "ok" } });
  replaceProperty(api, "post", postMock);
  render(<MemoryRouter initialEntries={["/verify-email?token=abc123"]}><I18nProvider><Routes><Route path="/verify-email" element={<VerifyEmailPage />} /></Routes></I18nProvider></MemoryRouter>);
  await waitFor(() => expect(postMock).toHaveBeenCalledWith("/auth/verify-email", { token: "abc123" }));
  await waitFor(() => expect(screen.getByText(/email confirmed|email confirmado/i)).toBeTruthy());
});
```

- [ ] **Step 2: Rodar (devem falhar — páginas não existem)**

Run: `bun test src/pages/ForgotPasswordPage.test.tsx src/pages/ResetPasswordPage.test.tsx src/pages/VerifyEmailPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar `ForgotPasswordPage.tsx`**

```tsx
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import api, { getErrorCode } from "@/services/api"
import { getErrorTranslationKey } from "@/i18n/error-keys"

export default function ForgotPasswordPage() {
  const { t: tAuth } = useTranslation("auth")
  const { t: tErrors } = useTranslation("errors")
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await api.post("/auth/forgot-password", { email })
      setSent(true)
    } catch (error) {
      const translation = getErrorTranslationKey("login", getErrorCode(error))
      // erro generico — endpoint sempre "succeeds" no servidor, so falha aqui em erro de rede/500
      console.error("forgot-password failed", error)
      setSent(true) // evita expor se o email existe ou nao mesmo num erro inesperado de rede
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{tAuth("forgotPasswordTitle")}</CardTitle>
            <CardDescription>{tAuth("forgotPasswordDescription")}</CardDescription>
          </CardHeader>
          {sent ? (
            <CardContent>
              <p>{tAuth("forgotPasswordSent")}</p>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">{tAuth("email")}</Label>
                  <Input id="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit" disabled={isLoading}>{tAuth("sendResetLink")}</Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implementar `ResetPasswordPage.tsx`**

```tsx
import { useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import api from "@/services/api"

export default function ResetPasswordPage() {
  const { t: tAuth } = useTranslation("auth")
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get("token") ?? ""
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await api.post("/auth/reset-password", { token, password })
      toast.success(tAuth("passwordResetSuccess"))
      navigate("/login")
    } catch (error) {
      toast.error(tAuth("passwordResetFailed"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{tAuth("resetPasswordTitle")}</CardTitle>
            <CardDescription>{tAuth("resetPasswordDescription")}</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{tAuth("newPassword")}</Label>
                <Input id="new-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" type="submit" disabled={isLoading || !token}>{tAuth("resetPasswordSubmit")}</Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Implementar `VerifyEmailPage.tsx`**

```tsx
import { useEffect, useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import api from "@/services/api"

export default function VerifyEmailPage() {
  const { t: tAuth } = useTranslation("auth")
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")

  useEffect(() => {
    if (!token) { setStatus("error"); return }
    api.post("/auth/verify-email", { token })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"))
  }, [token])

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{tAuth("verifyEmailTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {status === "loading" && <p>{tAuth("verifyEmailLoading")}</p>}
            {status === "success" && <p>{tAuth("verifyEmailSuccess")} <Link to="/login" className="underline">{tAuth("login")}</Link></p>}
            {status === "error" && <p>{tAuth("verifyEmailError")}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Registrar as 3 rotas em `App.tsx` (grupo público, linhas 42-50)**

```tsx
{ path: "/forgot-password", lazy: lazyPage(() => import('./pages/ForgotPasswordPage')) },
{ path: "/reset-password", lazy: lazyPage(() => import('./pages/ResetPasswordPage')) },
{ path: "/verify-email", lazy: lazyPage(() => import('./pages/VerifyEmailPage')) },
```

- [ ] **Step 7: Adicionar o link "esqueci minha senha" em `LoginPage.tsx`**

No form de login (depois do campo de senha, antes do `CardFooter`, linha ~170):

```tsx
<div className="text-right">
  <Link to="/forgot-password" className="text-sm underline text-muted-foreground">{tAuth("forgotPasswordLink")}</Link>
</div>
```

(adicionar `import { Link } from "react-router-dom"` se ainda não importado — o arquivo já usa `useNavigate` de `react-router-dom`.)

- [ ] **Step 8: Adicionar as chaves de i18n (`auth.*`) novas, `en.json`/`pt-BR.json` + tradução nos outros 4**

```json
"forgotPasswordTitle": "Forgot your password?",
"forgotPasswordDescription": "Enter your email and we'll send you a reset link.",
"forgotPasswordSent": "If an account with this email exists, a reset link was sent.",
"forgotPasswordLink": "Forgot your password?",
"sendResetLink": "Send link",
"resetPasswordTitle": "Reset your password",
"resetPasswordDescription": "Enter a new password for your account.",
"newPassword": "New password",
"resetPasswordSubmit": "Reset password",
"passwordResetSuccess": "Password updated. Log in with your new password.",
"passwordResetFailed": "This link is invalid or has expired.",
"verifyEmailTitle": "Confirming your email",
"verifyEmailLoading": "Confirming...",
"verifyEmailSuccess": "Email confirmed! You can now",
"verifyEmailError": "This link is invalid or has expired."
```

Português (mesmas chaves, texto real em pt-BR) + tradução nos outros 4 locales.

Registrar as entradas novas em `src/i18n/ui-inventory.test.ts`.

- [ ] **Step 9: Rodar os testes**

Run: `bun test src/pages/ForgotPasswordPage.test.tsx src/pages/ResetPasswordPage.test.tsx src/pages/VerifyEmailPage.test.tsx src/pages/LoginPage.test.tsx src/i18n`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/pages/ForgotPasswordPage.tsx src/pages/ResetPasswordPage.tsx src/pages/VerifyEmailPage.tsx src/pages/*.test.tsx src/App.tsx src/pages/LoginPage.tsx src/i18n/locales/*.json src/i18n/ui-inventory.test.ts
git commit -m "feat(auth): add forgot-password, reset-password and verify-email pages"
```

---

## Task 5: Setup de 2FA em `SettingsPage.tsx`

**Files:**
- Modify: `src/pages/dashboard/SettingsPage.tsx`
- Test: `src/pages/dashboard/SettingsPage.test.tsx` (estender)

**Interfaces:**
- Consumes: `POST /auth/2fa/setup`, `POST /auth/2fa/confirm`, `POST /auth/2fa/disable`.

- [ ] **Step 1: Estender o teste**

```tsx
test("DONO ve secao de seguranca e consegue ativar 2FA", async () => {
  const postMock = vi.fn()
    .mockResolvedValueOnce({ data: { secret: "SECRET123", otpauthUrl: "otpauth://totp/Tozzo.uk?secret=SECRET123" } })
    .mockResolvedValueOnce({ data: { message: "2FA enabled.", backupCodes: Array(10).fill("code") } });
  replaceProperty(api, "post", postMock);
  renderPage();

  await userEvent.click(screen.getByRole("button", { name: /enable 2fa|ativar 2fa/i }));
  await waitFor(() => expect(screen.getByText(/SECRET123/)).toBeTruthy());

  await userEvent.type(screen.getByLabelText(/code|codigo/i), "123456");
  await userEvent.click(screen.getByRole("button", { name: /confirm|confirmar/i }));

  await waitFor(() => expect(screen.getAllByText("code")).toHaveLength(10));
});

test("GERENTE nao ve secao de seguranca com 2FA", () => {
  mockUseAuth.mockReturnValue({ user: { role: "EMPLOYEE" } }); // FUNCIONARIO nunca ve
  renderPage();
  expect(screen.queryByText(/enable 2fa|ativar 2fa/i)).toBeNull();
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `bun test src/pages/dashboard/SettingsPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar a seção "Segurança"**

Adicionar estado: `const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null)`, `const [totpCode, setTotpCode] = useState("")`, `const [backupCodes, setBackupCodes] = useState<string[] | null>(null)`.

```tsx
const canUse2fa = user?.role === 'OWNER' || user?.role === 'MANAGER'

const handleStartTotpSetup = async () => {
  const response = await api.post('/auth/2fa/setup')
  setTotpSetup(response.data)
}

const handleConfirmTotpSetup = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!totpSetup) return
  try {
    const response = await api.post('/auth/2fa/confirm', { secret: totpSetup.secret, code: totpCode })
    setBackupCodes(response.data.backupCodes)
    toast.success(t('security.totpEnabled'))
  } catch (error) {
    toast.error(t('security.totpInvalidCode'))
  }
}
```

JSX (nova seção, antes do placeholder `moreComingSoon`, mesmo padrão visual das outras seções):

```tsx
{canUse2fa && (
  <div className="p-6 border rounded-lg bg-card space-y-3">
    <h2 className="text-xl font-semibold">{t('security.title')}</h2>
    {backupCodes ? (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t('security.backupCodesWarning')}</p>
        <ul className="font-mono text-sm space-y-1">
          {backupCodes.map((code) => <li key={code}>{code}</li>)}
        </ul>
      </div>
    ) : totpSetup ? (
      <form onSubmit={handleConfirmTotpSetup} className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('security.scanQrDescription')}</p>
        <p className="font-mono text-sm break-all">{totpSetup.secret}</p>
        <Input aria-label={t('security.codeLabel')} value={totpCode} onChange={(e) => setTotpCode(e.target.value)} />
        <Button type="submit">{t('security.confirmButton')}</Button>
      </form>
    ) : (
      <Button type="button" variant="outline" onClick={handleStartTotpSetup}>{t('security.enableButton')}</Button>
    )}
  </div>
)}
```

Nota: sem lib de QR code nova nesta task — mostra o secret em texto (o usuário digita manualmente no app autenticador). Gerar QR code visual de verdade fica pra um polish futuro se o usuário pedir; `otpauthUrl` já vem pronto da API pra isso quando for o caso.

- [ ] **Step 4: Adicionar as chaves de i18n (`settings.security.*`) — `en.json`/`pt-BR.json` + tradução nos outros 4**

```json
"security": {
  "title": "Security",
  "enableButton": "Enable 2FA",
  "scanQrDescription": "Add this code to your authenticator app, then enter the 6-digit code it generates.",
  "codeLabel": "Code",
  "confirmButton": "Confirm",
  "totpEnabled": "2FA enabled.",
  "totpInvalidCode": "Invalid code.",
  "backupCodesWarning": "Save these backup codes somewhere safe — each one can be used once if you lose access to your authenticator app."
}
```

Português:

```json
"security": {
  "title": "Segurança",
  "enableButton": "Ativar 2FA",
  "scanQrDescription": "Adicione este código no seu app autenticador, depois digite o código de 6 dígitos gerado.",
  "codeLabel": "Código",
  "confirmButton": "Confirmar",
  "totpEnabled": "2FA ativado.",
  "totpInvalidCode": "Código inválido.",
  "backupCodesWarning": "Guarde esses códigos de backup em lugar seguro — cada um vale uma única vez se você perder acesso ao app autenticador."
}
```

Registrar as entradas em `ui-inventory.test.ts`.

- [ ] **Step 5: Rodar os testes**

Run: `bun test src/pages/dashboard/SettingsPage.test.tsx src/i18n`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/dashboard/SettingsPage.tsx src/pages/dashboard/SettingsPage.test.tsx src/i18n/locales/*.json src/i18n/ui-inventory.test.ts
git commit -m "feat(security): add TOTP 2FA setup section for OWNER/MANAGER"
```

---

## Task 6: Revisão final da branch

- [ ] **Step 1: Rodar a suíte completa + `tsc` + build**

Run: `bun test && bunx tsc --noEmit && bun run build`
Expected: tudo verde.

- [ ] **Step 2: QA visual manual**

Fluxo completo no navegador: cadastro → email de verificação (conferir na caixa de entrada real ou nos logs do Brevo em dev) → clicar no link → login → (se 2FA ativo) prompt de código → dashboard. Esqueci-senha ponta a ponta. Ativar/desativar 2FA em Configurações.

- [ ] **Step 3: Atualizar `C:\RN\plano.md`**

Marcar que o plano de implementação do front (auth) está pronto/executado.
