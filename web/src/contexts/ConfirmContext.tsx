import { createContext, createSignal, useContext, type JSX } from "solid-js"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/solid"

export interface ConfirmOptions {
  title?: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>()

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider")
  return ctx
}

export function ConfirmProvider(props: { children?: JSX.Element }) {
  const [pending, setPending] = createSignal<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)
  const { t } = useTranslation("common")

  const confirm: ConfirmFn = (options) => {
    const normalized: ConfirmOptions = typeof options === "string" ? { description: options } : options
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
      <Dialog open={!!pending()} onOpenChange={(open) => { if (!open) settle(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending()?.options.title ?? t("confirmQuestion")}</DialogTitle>
            <DialogDescription>{pending()?.options.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settle(false)}>
              {pending()?.options.cancelLabel ?? t("cancel")}
            </Button>
            <Button
              variant={pending()?.options.destructive ? "destructive" : "default"}
              onClick={() => settle(true)}
            >
              {pending()?.options.confirmLabel ?? t("yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
