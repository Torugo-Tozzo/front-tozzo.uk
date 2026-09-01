# Fase 2 — Google Sign-In (Front) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão "Entrar com Google" na `LoginPage`, cobrindo login e cadastro (o backend decide qual dos dois acontece).

**Architecture:** `@react-oauth/google` (Google Identity Services) — `GoogleOAuthProvider` no topo do app, componente `GoogleLogin` na página, `onSuccess` manda o `credential` (ID token) pro `POST /auth/google` já existente e reaproveita o mesmo tratamento de resposta (`ok`/`TOTP_REQUIRED`) que o login por senha já tem.

**Tech Stack:** Vite + React 18 + TS + `@react-oauth/google` (novo) + `bun:test`.

**Spec:** `TozzoBurger/docs/superpowers/specs/2026-08-31-fase-2-google-signin-design.md`

**Depende de:** o plano de auth do front (`front-tozzo.uk/docs/superpowers/plans/2026-08-31-fase-2-auth-senha-2fa-email-front.md`) já executado — reaproveita o `login(accessToken, refreshToken)` e o prompt de 2FA já implementados lá.

## Global Constraints

- Pré-requisito externo: Client ID OAuth "Web application" criado no Google Cloud Console (origem autorizada = `https://tozzo.uk`, `https://dev.tozzo.uk`, `http://localhost:5173`), valor em `VITE_GOOGLE_CLIENT_ID` no `.env`.

---

## Task 1: Botão Google na `LoginPage`

**Files:**
- Modify: `src/App.tsx` (`GoogleOAuthProvider`), `src/pages/LoginPage.tsx`
- Test: `src/pages/LoginPage.test.tsx` (estender)

**Interfaces:**
- Consumes: `POST /auth/google`, `login(accessToken, refreshToken)` (já existente, plano de auth).

- [ ] **Step 1: Instalar a dependência**

Run: `bun add @react-oauth/google`

- [ ] **Step 2: Estender o teste de `LoginPage.test.tsx`**

```tsx
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: any) => children,
  GoogleLogin: ({ onSuccess }: any) => (
    <button onClick={() => onSuccess({ credential: 'fake-id-token' })}>Entrar com Google</button>
  ),
}));

test("Google Sign-In bem sucedido loga e navega pro dashboard", async () => {
  const postMock = vi.fn().mockResolvedValue({ data: { user: { id: 1 }, accessToken: "a1", refreshToken: "r1" } });
  replaceProperty(api, "post", postMock);
  renderPage();

  await userEvent.click(screen.getByText("Entrar com Google"));

  expect(postMock).toHaveBeenCalledWith("/auth/google", { idToken: "fake-id-token" });
});

test("Google Sign-In com TOTP_REQUIRED mostra o prompt de codigo", async () => {
  const postMock = vi.fn().mockResolvedValue({ data: { code: "TOTP_REQUIRED", challengeToken: "challenge-1" } });
  replaceProperty(api, "post", postMock);
  renderPage();

  await userEvent.click(screen.getByText("Entrar com Google"));

  await waitFor(() => expect(screen.getByText(/two-factor|dois fatores/i)).toBeTruthy());
});
```

Ajustar o texto/seletor do botão mockado pro texto real usado no Step 4 (chave de i18n `auth.continueWithGoogle`).

- [ ] **Step 3: Rodar (deve falhar)**

Run: `bun test src/pages/LoginPage.test.tsx`
Expected: FAIL

- [ ] **Step 4: Envolver o app com `GoogleOAuthProvider` em `App.tsx`**

```tsx
import { GoogleOAuthProvider } from '@react-oauth/google'
// ...
function RootLayout() {
  // ...
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        {/* ...resto sem mudança... */}
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
```

- [ ] **Step 5: Adicionar o botão em `LoginPage.tsx`**

Reaproveitar o estado `pendingChallengeToken` já criado pelo plano de auth (Task 3 do plano de auth). Adicionar handler:

```tsx
import { GoogleLogin } from '@react-oauth/google'

const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
  if (!credentialResponse.credential) return
  setIsLoading(true)
  try {
    const response = await api.post("/auth/google", { idToken: credentialResponse.credential })

    if (response.data.code === "TOTP_REQUIRED") {
      setPendingChallengeToken(response.data.challengeToken)
      return
    }

    await login(response.data.accessToken, response.data.refreshToken)
    navigate("/dashboard")
  } catch (error) {
    console.error("Google Sign-In failed", error)
    toast.error(translateError("login", error))
  } finally {
    setIsLoading(false)
  }
}
```

No JSX, dentro de cada `TabsContent` (login e cadastro), abaixo do `CardFooter` de cada form:

```tsx
<div className="px-6 pb-6">
  <div className="relative my-2">
    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{tAuth("or")}</span></div>
  </div>
  <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error(tAuth("googleSignInFailed"))} text="continue_with" width="100%" />
</div>
```

- [ ] **Step 6: Adicionar `VITE_GOOGLE_CLIENT_ID` em `.env.example`**

```
VITE_GOOGLE_CLIENT_ID=
```

- [ ] **Step 7: Adicionar as chaves de i18n (`auth.or`, `auth.googleSignInFailed`) — `en.json`/`pt-BR.json` + tradução nos outros 4**

Inglês: `"or": "Or"`, `"googleSignInFailed": "Google Sign-In failed. Try again."`
Português: `"or": "Ou"`, `"googleSignInFailed": "Falha no login com Google. Tente de novo."`

Registrar em `ui-inventory.test.ts` se forem chamadas literais `t()` (são, `tAuth("or")`/`tAuth("googleSignInFailed")`).

- [ ] **Step 8: Rodar os testes**

Run: `bun test src/pages/LoginPage.test.tsx src/i18n`
Expected: PASS

- [ ] **Step 9: Rodar a suíte inteira + `tsc` + build**

Run: `bun test && bunx tsc --noEmit && bun run build`
Expected: tudo verde.

- [ ] **Step 10: QA manual no navegador**

Rodar `bun run dev`, clicar em "Entrar com Google" de verdade (precisa do `VITE_GOOGLE_CLIENT_ID` real configurado), confirmar conta nova vira DONO de estabelecimento novo, conta com email já existente linka.

- [ ] **Step 11: Commit**

```bash
git add package.json bun.lock src/App.tsx src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx .env.example src/i18n/locales/*.json src/i18n/ui-inventory.test.ts
git commit -m "feat(auth): add Google Sign-In button to login/register page"
```

---

## Task 2: Revisão final + `plano.md`

- [ ] **Step 1: Atualizar `C:\RN\plano.md`**

Marcar que o plano de implementação do front (Google Sign-In) está pronto/executado — fecha os 3 sub-itens da Fase 2.
