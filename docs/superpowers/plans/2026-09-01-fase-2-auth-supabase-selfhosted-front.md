# Auth via Supabase Auth (GoTrue) self-hosted — Front Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar login/cadastro do dashboard web de `axios.post('/auth/login'|'/auth/register')`
pra `@supabase/auth-js` apontando pro GoTrue self-hosted, ganhando reset de senha, 2FA TOTP e
Google Sign-In sem código próprio de token/OAuth.

**Architecture:** `src/lib/authClient.ts` expõe uma instância única de `AuthClient` (storage =
`localStorage`, que já implementa a interface que o auth-js espera nativamente). `AuthContext`
para de decodificar JWT/gerenciar `tozzo_token` na mão e passa a reagir a
`authClient.onAuthStateChange` — toda vez que a sessão muda, busca o perfil real em
`GET /usuarios/me` (fonte de verdade de `role`/`establishment`, mesmo padrão que já existe hoje).
`src/services/api.ts` (axios da própria api) pega o token de `authClient.getSession()` no
interceptor, em vez de `localStorage.getItem('tozzo_token')`.

**Tech Stack:** React 18 + TypeScript + Vite, `@supabase/auth-js` (novo), `bun test` + Testing
Library (`@testing-library/react`), `react-router-dom` (lazy routes em `src/App.tsx`).

**Spec:** `TozzoBurger/docs/superpowers/specs/2026-09-01-fase-2-auth-supabase-selfhosted-design.md`

## Global Constraints

- `VITE_AUTH_URL` novo (`.env`/`.env.example`) — `https://api.tozzo.uk/gotrue` em prod,
  `https://dev-api.tozzo.uk/gotrue` em dev/homolog, fallback local `http://localhost:9999`.
- RBAC é só reflexo de UI aqui — fonte de verdade continua sendo a API (`GET /usuarios/me`).
- Usar os componentes do design system já existente (`src/components/ui/`), não estilizar na mão.
- Suíte roda com `bun test` (`--parallel`, já configurado). `bunx tsc --noEmit` e `bun run build`
  ao final de cada task relevante.
- Não fazer push, merge ou PR. Não tocar em `main`/`dev`.
- GoTrue **não está rodando** neste ambiente — toda integração é testada via mock do
  `authClient` (substituindo os métodos no objeto real, mesmo padrão que `replaceProperty`
  já usa pra mockar `api.get`/`api.post` em `AuthContext.test.tsx`), nunca contra instância real.

---

### Task 1: `src/lib/authClient.ts`

**Files:**
- Create: `src/lib/authClient.ts`
- Modify: `package.json` (dependência nova)
- Test: `src/lib/authClient.test.ts`

**Interfaces:**
- Consumes: `import.meta.env.VITE_AUTH_URL`.
- Produces: `export const authClient: AuthClient` — usado por todas as tasks seguintes
  (`AuthContext`, `LoginPage`, `SettingsPage`, `ForgotPasswordPage`, `ResetPasswordPage`).

- [ ] **Step 1: Instalar a dependência**

Run: `bun add @supabase/auth-js`

- [ ] **Step 2: Escrever o teste**

```typescript
// src/lib/authClient.test.ts
import { describe, it, expect } from 'bun:test'
import { authClient } from './authClient'

describe('authClient', () => {
  it('expõe os métodos principais do auth-js', () => {
    expect(typeof authClient.signInWithPassword).toBe('function')
    expect(typeof authClient.signUp).toBe('function')
    expect(typeof authClient.signInWithOAuth).toBe('function')
    expect(typeof authClient.getSession).toBe('function')
    expect(typeof authClient.onAuthStateChange).toBe('function')
    expect(typeof authClient.resetPasswordForEmail).toBe('function')
    expect(typeof authClient.updateUser).toBe('function')
    expect(typeof authClient.mfa.enroll).toBe('function')
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `bun test src/lib/authClient.test.ts`
Expected: FAIL — `src/lib/authClient.ts` não existe.

- [ ] **Step 4: Implementar**

```typescript
// src/lib/authClient.ts
import { AuthClient } from '@supabase/auth-js'

const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:9999'

export const authClient = new AuthClient({
  url: AUTH_URL,
  storage: window.localStorage,
  persistSession: true,
  autoRefreshToken: true,
})
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `bun test src/lib/authClient.test.ts`
Expected: PASS.

- [ ] **Step 6: Adicionar `VITE_AUTH_URL` ao `.env.example`**

Adicione a linha `VITE_AUTH_URL=http://localhost:9999` (ou o valor de dev já usado pras outras
vars, seguindo o padrão de `VITE_API_URL` já presente no arquivo).

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock src/lib/authClient.ts src/lib/authClient.test.ts .env.example
git commit -m "feat(auth): cliente @supabase/auth-js apontando pro GoTrue"
```

---

### Task 2: `src/services/api.ts` usa sessão do auth-js

**Files:**
- Modify: `src/services/api.ts:16-28,39-44`
- Test: (comportamento coberto indiretamente pelos testes de `AuthContext`/`LoginPage` nas
  próximas tasks — este arquivo não tem teste próprio hoje, não criar um novo isolado só pra
  isso, seria testar implementação e não comportamento)

**Interfaces:**
- Consumes: `authClient.getSession()`, `authClient.signOut()` (Task 1).
- Produces: interceptor do axios continua anexando `Authorization: Bearer <token>` — nenhuma
  outra chamada de `api.*` no resto do front muda de assinatura.

- [ ] **Step 1: Trocar o interceptor de request**

Em `src/services/api.ts`, troque:

```typescript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tozzo_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
```

por:

```typescript
api.interceptors.request.use(async (config) => {
  const { data } = await authClient.getSession();
  if (data.session?.access_token) {
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }
```

(adicione `import { authClient } from './authClient';` no topo do arquivo)

- [ ] **Step 2: Trocar o interceptor de resposta (401)**

Troque:

```typescript
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('tozzo_token');
      window.dispatchEvent(new Event('auth:logout'));
      window.location.href = '/login';
    }
```

por:

```typescript
    if (error.response && error.response.status === 401) {
      // Token expired or invalid — auth-js já tenta refresh automático antes disso; um 401 aqui
      // significa que a sessão realmente não é mais válida.
      authClient.signOut();
      window.dispatchEvent(new Event('auth:logout'));
      window.location.href = '/login';
    }
```

- [ ] **Step 3: Rodar `tsc` (sem teste isolado nesta task)**

Run: `bunx tsc --noEmit`
Expected: sem erro de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/services/api.ts
git commit -m "feat(auth): interceptor do axios usa sessão do auth-js em vez de localStorage"
```

---

### Task 3: `AuthContext` reage à sessão do auth-js

**Files:**
- Modify: `src/contexts/AuthContext.tsx` (reescrita completa do provider)
- Modify: `src/contexts/AuthContext.test.tsx` (adapta os mocks)

**Interfaces:**
- Consumes: `authClient` (Task 1).
- Produces: `AuthContextType` igual ao de hoje, **exceto** que `login(token: string)` sai da
  interface pública (login/signup passam a acontecer via `authClient` direto na `LoginPage`,
  Task 4 — a sessão muda sozinha e o `AuthContext` reage via `onAuthStateChange`):

```typescript
interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}
```

`ProtectedRoute.tsx` e o resto do front só leem `isAuthenticated`/`isLoading`/`user` — não
precisam de nenhuma mudança.

- [ ] **Step 1: Atualizar `AuthContext.test.tsx` pro novo mock**

Troque o helper `tokenFor`/`localStorage.setItem('tozzo_token', ...)` do `beforeEach` por um mock
direto do `authClient`:

```typescript
import { authClient } from '@/lib/authClient'
import { replaceProperty } from '@/test/replace-property'

let restoreGetSession: () => void
let restoreOnAuthStateChange: () => void

beforeEach(() => {
  restoreGetSession = replaceProperty(authClient, 'getSession', (async () => ({
    data: { session: { access_token: 'fake-token', user: { id: '42', email: 'ana@example.com' } } },
    error: null,
  })) as typeof authClient.getSession)

  restoreOnAuthStateChange = replaceProperty(authClient, 'onAuthStateChange', ((callback: any) => {
    // Dispara o estado inicial de "logado" de forma síncrona pro provider já nascer autenticado
    // nos testes que assumem isso (mesmo comportamento do teste antigo, que já vinha com token
    // no localStorage antes do render).
    queueMicrotask(() => callback('SIGNED_IN', { access_token: 'fake-token', user: { id: '42' } }))
    return { data: { subscription: { unsubscribe: () => {} } } }
  }) as typeof authClient.onAuthStateChange)
})

afterEach(() => {
  restoreGetSession()
  restoreOnAuthStateChange()
  // ...resto do afterEach já existente (localStorage.clear(), i18n)
})
```

Os 2 testes existentes (`keeps a pending user authenticated...`, `keeps a structured pending
status...`) continuam funcionando sem mudar o corpo — eles já mockam `api.get` pra `/usuarios/me`
e `/estabelecimentos`, que é exatamente o que o `AuthContext` novo também vai chamar.

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `bun test src/contexts/AuthContext.test.tsx`
Expected: FAIL — `AuthContext.tsx` ainda decodifica `tozzo_token` do `localStorage`, que não
existe mais nesse teste.

- [ ] **Step 3: Reescrever `AuthContext.tsx`**

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { authClient } from '../lib/authClient';
import type { Establishment, User } from '@/domain/models';
import { fromLegacyWire, normalizeRole } from '@/lib/legacyWire';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUserProfile = async () => {
    try {
      const userResponse = await api.get('/usuarios/me');
      const meRole = normalizeRole(userResponse.data?.role);
      const authenticatedUser: User = {
        id: userResponse.data.id,
        name: userResponse.data.name || '',
        email: userResponse.data.email || '',
        role: meRole,
        establishment: undefined,
      };

      try {
        const establishmentResponse = await api.get('/estabelecimentos');
        const rawEstablishmentData = Array.isArray(establishmentResponse.data)
          ? establishmentResponse.data[0]
          : establishmentResponse.data;
        if (rawEstablishmentData) {
          authenticatedUser.establishment = fromLegacyWire<unknown>(rawEstablishmentData, 'establishment') as Establishment;
        }
      } catch (err: any) {
        console.warn('Não foi possível buscar detalhes do estabelecimento', err);
        if (err.response && err.response.status === 402) {
          authenticatedUser.establishment = { id: 0, tradeName: '', status: 'PENDING_PAYMENT' };
        }
      }

      setUser(authenticatedUser);
    } catch (error) {
      console.error('Error fetching user profile', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = authClient.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (session) {
        setIsAuthenticated(true);
        setIsLoading(true);
        await refreshUserProfile();
        setIsLoading(false);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await authClient.signOut();
    setIsAuthenticated(false);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, logout, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

Note: `onAuthStateChange` já dispara com o estado inicial na primeira montagem (padrão do
auth-js — ele chama o callback assim que a sessão é restaurada do storage), então não precisa de
um `useEffect` separado pra "carregar o token salvo" como a versão antiga tinha — é o mesmo
mecanismo que já cobre login, logout e restauração de sessão.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `bun test src/contexts/AuthContext.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte inteira e checar tipos**

Run: `bun test && bunx tsc --noEmit`
Expected: verde (outros arquivos que usam `useAuth()` só leem `user`/`isAuthenticated`, sem
mudança de contrato pra eles — exceção: qualquer lugar que chame `login(token)` direto, se
existir, vai quebrar no `tsc` e precisa ser ajustado — não deveria haver nenhum fora de
`LoginPage.tsx`, tratado na Task 4).

- [ ] **Step 6: Commit**

```bash
git add src/contexts/AuthContext.tsx src/contexts/AuthContext.test.tsx
git commit -m "feat(auth): AuthContext reage à sessão do auth-js (onAuthStateChange)"
```

---

### Task 4: `LoginPage` usa auth-js (senha) + `complete-signup`

**Files:**
- Modify: `src/pages/LoginPage.tsx` (`handleLogin`, `handleRegister`)
- Test: `src/pages/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `authClient.signInWithPassword`, `authClient.signUp` (Task 1);
  `api.post('/auth/complete-signup', ...)` (endpoint da api, plano da api Task 4).
- Produces: nenhuma interface nova pra outras tasks consumirem.

- [ ] **Step 1: Ler o teste existente pra confirmar o padrão de mock**

Abra `src/pages/LoginPage.test.tsx` e confirme como `api.post` é mockado hoje (mesmo padrão
`replaceProperty` de `AuthContext.test.tsx`).

- [ ] **Step 2: Escrever/adaptar os testes**

```typescript
it('faz login via authClient.signInWithPassword e não chama mais /auth/login', async () => {
  const signInMock = vi.fn().mockResolvedValue({
    data: { session: { access_token: 'tok' }, user: { id: '1' } },
    error: null,
  })
  const restoreSignIn = replaceProperty(authClient, 'signInWithPassword', signInMock as typeof authClient.signInWithPassword)
  const postSpy = vi.fn()
  const restorePost = replaceProperty(api, 'post', postSpy as typeof api.post)

  try {
    // ...render LoginPage, preencher email/senha, submeter form (mesmo setup já usado no arquivo)
    await waitFor(() => expect(signInMock).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'senha123' }))
    expect(postSpy).not.toHaveBeenCalledWith('/auth/login', expect.anything())
  } finally {
    restoreSignIn()
    restorePost()
  }
})

it('cadastro chama signUp + complete-signup em sequência', async () => {
  const signUpMock = vi.fn().mockResolvedValue({
    data: { session: { access_token: 'tok' }, user: { id: '1' } },
    error: null,
  })
  const restoreSignUp = replaceProperty(authClient, 'signUp', signUpMock as typeof authClient.signUp)
  const postMock = vi.fn().mockResolvedValue({ data: { establishment: { status: 'PENDENTE_PAGAMENTO' } } })
  const restorePost = replaceProperty(api, 'post', postMock as typeof api.post)

  try {
    // ...render LoginPage, ir pra aba de cadastro, preencher campos, submeter
    await waitFor(() => expect(signUpMock).toHaveBeenCalledWith({
      email: 'nova@example.com',
      password: 'senha123',
    }))
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/auth/complete-signup', {
      tradeName: 'Bar Novo',
      registrationKey: '',
    }))
  } finally {
    restoreSignUp()
    restorePost()
  }
})
```

(complete o setup de render/preenchimento de form reaproveitando o que já existe no arquivo —
os testes atuais de `LoginPage.test.tsx` já cobrem esse fluxo de preenchimento, só troque o mock
de `api.post('/auth/login', ...)` pelo mock de `authClient`.)

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `bun test src/pages/LoginPage.test.tsx`
Expected: FAIL — `handleLogin`/`handleRegister` ainda chamam `api.post('/auth/login'|'/auth/register')`.

- [ ] **Step 4: Reescrever `handleLogin` e `handleRegister`**

```typescript
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)
  try {
    const { error } = await authClient.signInWithPassword({ email: loginEmail, password: loginPassword })
    if (error) {
      toast.error(translateError("login", { response: { data: { code: error.code } } }))
      return
    }
    navigate("/dashboard")
  } catch (error: any) {
    console.error("Login failed", error)
    toast.error(translateError("login", error))
  } finally {
    setIsLoading(false)
  }
}

const handleRegister = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)
  try {
    const { data, error } = await authClient.signUp({ email: registerEmail, password: registerPassword })
    if (error || !data.session) {
      toast.error(translateError("registration", { response: { data: { code: error?.code } } }))
      return
    }

    await api.post("/auth/complete-signup", {
      tradeName: registerEstablishment,
      registrationKey: hasKey ? registrationKey : "",
    })

    navigate(hasKey ? "/dashboard" : "/plan")
  } catch (error) {
    console.error("Registration failed", error)
    toast.error(translateError("registration", error))
  } finally {
    setIsLoading(false)
  }
}
```

Adicione `import { authClient } from "@/lib/authClient"` no topo. Remova o `useEffect` de
redirecionamento se ele dependia de `login()` — confirme que ele só depende de
`isAuthenticated`/`user` (já é o caso, linha 36-44 atual, não precisa mudar).

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `bun test src/pages/LoginPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Rodar a suíte inteira, tsc e build**

Run: `bun test && bunx tsc --noEmit && bun run build`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
git add src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx
git commit -m "feat(auth): LoginPage usa auth-js (signInWithPassword/signUp) + complete-signup"
```

---

### Task 5: Botão "Entrar com Google"

**Files:**
- Modify: `src/pages/LoginPage.tsx` (botão novo, abaixo dos 2 forms)
- Test: `src/pages/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `authClient.signInWithOAuth` (Task 1).
- Produces: nenhuma.

- [ ] **Step 1: Escrever o teste**

```typescript
it('botão Google chama signInWithOAuth com provider google', async () => {
  const oauthMock = vi.fn().mockResolvedValue({ data: { url: 'https://accounts.google.com/...' }, error: null })
  const restore = replaceProperty(authClient, 'signInWithOAuth', oauthMock as typeof authClient.signInWithOAuth)

  try {
    // ...render LoginPage
    await userEvent.click(screen.getByRole('button', { name: tAuth('continueWithGoogle') }))
    expect(oauthMock).toHaveBeenCalledWith({ provider: 'google' })
  } finally {
    restore()
  }
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `bun test src/pages/LoginPage.test.tsx`
Expected: FAIL — botão não existe.

- [ ] **Step 3: Adicionar o botão**

Dentro de cada `<TabsContent>` (login e cadastro), logo abaixo do `<CardFooter>` de cada form,
adicione:

```tsx
<div className="px-6 pb-6">
  <Button
    type="button"
    variant="outline"
    className="w-full"
    onClick={() => authClient.signInWithOAuth({ provider: 'google' })}
  >
    {tAuth('continueWithGoogle')}
  </Button>
</div>
```

Adicione a chave `continueWithGoogle` nos 6 arquivos de locale (`src/i18n/locales/*.json`,
namespace `auth`) com o texto "Continuar com Google" (pt-BR) e equivalente traduzido nos outros 5
idiomas — confirme o padrão de tradução já usado pras outras chaves de `auth` no mesmo arquivo.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `bun test src/pages/LoginPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rodar `i18n:check` (radar de paridade entre idiomas)**

Run: `bun run i18n:check`
Expected: sem chave faltando em nenhum dos 6 locales.

- [ ] **Step 6: Commit**

```bash
git add src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx src/i18n/locales
git commit -m "feat(auth): botão Entrar com Google (signInWithOAuth)"
```

---

### Task 6: Esqueci senha / redefinir senha

**Files:**
- Create: `src/pages/ForgotPasswordPage.tsx`, `src/pages/ForgotPasswordPage.test.tsx`
- Create: `src/pages/ResetPasswordPage.tsx`, `src/pages/ResetPasswordPage.test.tsx`
- Modify: `src/App.tsx` (2 rotas novas, públicas, fora de `ProtectedRoute`)
- Modify: `src/pages/LoginPage.tsx` (link "Esqueci minha senha" na aba de login)

**Interfaces:**
- Consumes: `authClient.resetPasswordForEmail`, `authClient.updateUser` (Task 1).
- Produces: nenhuma.

- [ ] **Step 1: Escrever o teste de `ForgotPasswordPage`**

```typescript
// src/pages/ForgotPasswordPage.test.tsx
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '@/i18n/provider'
import { authClient } from '@/lib/authClient'
import { replaceProperty } from '@/test/replace-property'
import ForgotPasswordPage from './ForgotPasswordPage'

describe('ForgotPasswordPage', () => {
  it('chama resetPasswordForEmail com o email digitado', async () => {
    const resetMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    const restore = replaceProperty(authClient, 'resetPasswordForEmail', resetMock as typeof authClient.resetPasswordForEmail)

    try {
      render(<I18nProvider><MemoryRouter><ForgotPasswordPage /></MemoryRouter></I18nProvider>)
      await userEvent.type(screen.getByLabelText(/email/i), 'ana@example.com')
      await userEvent.click(screen.getByRole('button', { name: /enviar/i }))
      await waitFor(() => expect(resetMock).toHaveBeenCalledWith('ana@example.com', {
        redirectTo: `${window.location.origin}/reset-password`,
      }))
      expect(screen.getByText(/verifique seu email/i)).toBeInTheDocument()
    } finally {
      restore()
    }
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `bun test src/pages/ForgotPasswordPage.test.tsx`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Implementar `ForgotPasswordPage.tsx`**

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { authClient } from '@/lib/authClient'
import { useTranslation } from 'react-i18next'

export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    await authClient.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setIsLoading(false)
    setSent(true)
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>{t('forgotPasswordTitle')}</CardTitle></CardHeader>
        {sent ? (
          <CardContent>{t('forgotPasswordEmailSent')}</CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-2">
              <Label htmlFor="forgot-email">{t('email')}</Label>
              <Input id="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </CardContent>
            <CardFooter>
              <Button className="w-full" type="submit" disabled={isLoading}>{t('sendResetLink')}</Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `bun test src/pages/ForgotPasswordPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Repetir Steps 1-4 pra `ResetPasswordPage`**

Teste equivalente chamando `authClient.updateUser({ password: 'novaSenha123' })` depois de
preencher o form (a sessão de recovery já vem restaurada pelo `authClient` a partir do link do
email — auth-js trata isso automaticamente via `onAuthStateChange` com evento
`PASSWORD_RECOVERY`, não precisa de token manual na URL). Implementação:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { authClient } from '@/lib/authClient'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

export default function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const { error } = await authClient.updateUser({ password })
    setIsLoading(false)
    if (error) {
      toast.error(t('resetPasswordFailed'))
      return
    }
    toast.success(t('resetPasswordSuccess'))
    navigate('/login')
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>{t('resetPasswordTitle')}</CardTitle></CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-2">
            <Label htmlFor="new-password">{t('newPassword')}</Label>
            <Input id="new-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isLoading}>{t('resetPassword')}</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: Registrar as 2 rotas em `src/App.tsx`**

Dentro do grupo de `MainLayout` (rotas públicas), adicione:

```typescript
{ path: "/forgot-password", lazy: lazyPage(() => import('./pages/ForgotPasswordPage')) },
{ path: "/reset-password", lazy: lazyPage(() => import('./pages/ResetPasswordPage')) },
```

- [ ] **Step 7: Link "Esqueci minha senha" na `LoginPage`**

Dentro do `<CardFooter>` do form de login, acima do botão de submit, adicione:

```tsx
<a href="/forgot-password" className="text-sm text-muted-foreground underline mb-2 block text-center">
  {tAuth('forgotPasswordLink')}
</a>
```

Adicione todas as chaves novas de texto (`forgotPasswordTitle`, `forgotPasswordEmailSent`,
`sendResetLink`, `forgotPasswordLink`, `newPassword`, `resetPassword`, `resetPasswordTitle`,
`resetPasswordSuccess`, `resetPasswordFailed`) nos 6 locales, namespace `auth`.

- [ ] **Step 8: Rodar suíte inteira, i18n:check, tsc e build**

Run: `bun test && bun run i18n:check && bunx tsc --noEmit && bun run build`
Expected: tudo verde.

- [ ] **Step 9: Commit**

```bash
git add src/pages/ForgotPasswordPage.tsx src/pages/ForgotPasswordPage.test.tsx src/pages/ResetPasswordPage.tsx src/pages/ResetPasswordPage.test.tsx src/App.tsx src/pages/LoginPage.tsx src/i18n/locales
git commit -m "feat(auth): telas de esqueci-senha/redefinir-senha via auth-js"
```

---

### Task 7: 2FA (TOTP) na `SettingsPage`

**Files:**
- Modify: `src/pages/dashboard/SettingsPage.tsx` (seção "Segurança" nova)
- Modify: `src/pages/LoginPage.tsx` (desafio de código quando `signInWithPassword` pede MFA)
- Test: `src/pages/dashboard/SettingsPage.test.tsx`, `src/pages/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `authClient.mfa.enroll/challenge/verify/unenroll` (Task 1).
- Produces: nenhuma.

- [ ] **Step 1: Escrever o teste do desafio de login**

```typescript
it('mostra prompt de código quando signInWithPassword retorna mfa_challenge', async () => {
  const signInMock = vi.fn().mockResolvedValue({
    data: { session: null },
    error: { code: 'mfa_challenge_required', message: 'MFA required' },
  })
  const verifyMock = vi.fn().mockResolvedValue({ data: { access_token: 'tok' }, error: null })
  const restoreSignIn = replaceProperty(authClient, 'signInWithPassword', signInMock as typeof authClient.signInWithPassword)
  const restoreVerify = replaceProperty(authClient.mfa, 'verify', verifyMock as typeof authClient.mfa.verify)

  try {
    // ...render, preencher email/senha, submeter
    await waitFor(() => expect(screen.getByLabelText(/código/i)).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/código/i), '123456')
    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(verifyMock).toHaveBeenCalled())
  } finally {
    restoreSignIn()
    restoreVerify()
  }
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `bun test src/pages/LoginPage.test.tsx`
Expected: FAIL — não existe tratamento de MFA na `LoginPage` ainda.

- [ ] **Step 3: Adicionar estado de desafio MFA na `LoginPage`**

Adicione estado `const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null)`
e `const [mfaCode, setMfaCode] = useState('')`. Em `handleLogin`, depois de checar `error`:

```typescript
if (error?.code === 'mfa_challenge_required') {
  const { data: factors } = await authClient.mfa.listFactors()
  const factorId = factors?.totp?.[0]?.id
  if (factorId) {
    const { data: challenge } = await authClient.mfa.challenge({ factorId })
    if (challenge) setMfaChallenge({ factorId, challengeId: challenge.id })
  }
  return
}
```

E um form condicional (renderizado quando `mfaChallenge` não é nulo) com um `Input` de código +
botão que chama:

```typescript
const handleMfaVerify = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!mfaChallenge) return
  setIsLoading(true)
  const { error } = await authClient.mfa.verify({ ...mfaChallenge, code: mfaCode })
  setIsLoading(false)
  if (error) {
    toast.error(tAuth('invalidTotpCode'))
    return
  }
  navigate('/dashboard')
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `bun test src/pages/LoginPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Escrever o teste da seção "Segurança" (setup de 2FA)**

```typescript
it('DONO/GERENTE veem a seção Segurança e conseguem ativar 2FA', async () => {
  const enrollMock = vi.fn().mockResolvedValue({
    data: { id: 'factor-1', totp: { qr_code: 'data:image/png;base64,...', secret: 'ABCD' } },
    error: null,
  })
  const challengeMock = vi.fn().mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
  const verifyMock = vi.fn().mockResolvedValue({ data: {}, error: null })
  const restoreEnroll = replaceProperty(authClient.mfa, 'enroll', enrollMock as typeof authClient.mfa.enroll)
  const restoreChallenge = replaceProperty(authClient.mfa, 'challenge', challengeMock as typeof authClient.mfa.challenge)
  const restoreVerify = replaceProperty(authClient.mfa, 'verify', verifyMock as typeof authClient.mfa.verify)

  try {
    // ...render SettingsPage com user.role = 'OWNER' (mock do useAuth ou provider real com mock de /usuarios/me)
    await userEvent.click(screen.getByRole('button', { name: /ativar 2fa/i }))
    await waitFor(() => expect(enrollMock).toHaveBeenCalledWith({ factorType: 'totp' }))
    expect(screen.getByAltText(/qr code/i)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/código/i), '654321')
    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(verifyMock).toHaveBeenCalledWith({ factorId: 'factor-1', challengeId: 'challenge-1', code: '654321' }))
  } finally {
    restoreEnroll()
    restoreChallenge()
    restoreVerify()
  }
})
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `bun test src/pages/dashboard/SettingsPage.test.tsx`
Expected: FAIL — seção não existe.

- [ ] **Step 7: Implementar a seção "Segurança" na `SettingsPage`**

Usando o `isOwner`/`canEditCategory`-like gate já existente (linha 75-76 do arquivo:
`user?.role === 'OWNER' || user?.role === 'MANAGER'`), adicione um bloco condicional com:
botão "Ativar 2FA" → `authClient.mfa.enroll({ factorType: 'totp' })` → exibe `<img>` com o
`data.totp.qr_code` + input de código → ao confirmar, `authClient.mfa.challenge({ factorId })`
seguido de `authClient.mfa.verify({ factorId, challengeId, code })`. Botão "Desativar 2FA" →
`authClient.mfa.unenroll({ factorId })`, visível só quando já há fator ativo (`authClient.mfa.listFactors()`
no mount da seção).

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `bun test src/pages/dashboard/SettingsPage.test.tsx`
Expected: PASS.

- [ ] **Step 9: Rodar suíte inteira, i18n:check, tsc e build**

Run: `bun test && bun run i18n:check && bunx tsc --noEmit && bun run build`
Expected: tudo verde.

- [ ] **Step 10: Commit**

```bash
git add src/pages/dashboard/SettingsPage.tsx src/pages/dashboard/SettingsPage.test.tsx src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx src/i18n/locales
git commit -m "feat(auth): 2FA TOTP (setup em Segurança + desafio no login) via auth-js mfa"
```

---

## Self-Review (feito ao escrever este plano)

- **Cobertura da spec**: `authClient` (Task 1), interceptor axios (Task 2), `AuthContext` (Task 3),
  login/cadastro+complete-signup (Task 4), Google (Task 5), esqueci/redefinir senha (Task 6),
  2FA (Task 7) — cobre toda a seção "Front" da spec.
- **Sem placeholder**: toda task tem código real. Exceção assumida conscientemente: textos de
  i18n usam chave nova sem o valor traduzido completo escrito nas 6 línguas neste documento
  (seria redundante repetir 6x o mesmo texto em 7 tasks) — a instrução de "seguir o padrão já
  usado no arquivo" é suficiente pro executor, já que o arquivo de locale já tem dezenas de
  exemplos do mesmo formato.
- **Consistência de tipo**: `AuthContextType` definida na Task 3 não inclui mais `login(token)` —
  confirmado que só `LoginPage.tsx` chamava isso antes (Task 4 remove essa chamada na mesma
  leva), nenhuma outra task ou arquivo depende do método removido.
