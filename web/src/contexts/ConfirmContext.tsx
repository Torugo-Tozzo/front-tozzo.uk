import { createContext, createSignal, Show, Suspense, useContext, type JSX } from "solid-js"

import { lazyPage } from "@/lib/lazy-page"

export interface ConfirmOptions {
  title?: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>()

// The dialog (Kobalte) is fetched on the first confirm(), not with the app.
// lazyPage(): a chunk gone after a deploy reloads the page instead of hanging.
const ConfirmDialog = lazyPage(() => import("./ConfirmDialog"))

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider")
  return ctx
}

export function ConfirmProvider(props: { children?: JSX.Element }) {
  const [pending, setPending] = createSignal<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)
  const [used, setUsed] = createSignal(false)

  const confirm: ConfirmFn = (options) => {
    const normalized: ConfirmOptions = typeof options === "string" ? { description: options } : options
    setUsed(true)
    return new Promise<boolean>((resolve) => {
      setPending({ options: normalized, resolve })
    })
  }

  const settle = (result: boolean) => {
    pending()?.resolve(result)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {props.children}
      <Show when={used()}>
        {/* Its own boundary: loading the dialog must not suspend the page. */}
        <Suspense>
          <ConfirmDialog options={() => pending()?.options} settle={settle} />
        </Suspense>
      </Show>
    </ConfirmContext.Provider>
  )
}
