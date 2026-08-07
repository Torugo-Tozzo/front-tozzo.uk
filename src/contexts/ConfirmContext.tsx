import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface ConfirmOptions {
  title?: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm precisa estar dentro de ConfirmProvider")
  return ctx
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    const normalized: ConfirmOptions = typeof options === "string" ? { description: options } : options
    return new Promise<boolean>((resolve) => {
      setPending({ options: normalized, resolve })
    })
  }, [])

  const settle = (result: boolean) => {
    pending?.resolve(result)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!pending} onOpenChange={(open) => { if (!open) settle(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.options.title ?? "Tem certeza?"}</DialogTitle>
            <DialogDescription>{pending?.options.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settle(false)}>
              {pending?.options.cancelLabel ?? "Cancelar"}
            </Button>
            <Button
              variant={pending?.options.destructive ? "destructive" : "default"}
              onClick={() => settle(true)}
            >
              {pending?.options.confirmLabel ?? "Sim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
