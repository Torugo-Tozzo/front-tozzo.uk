import type { Accessor } from "solid-js"

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
import type { ConfirmOptions } from "./ConfirmContext"

// Loaded on the first confirm() (plan S2: keeps Kobalte's dialog out of the
// initial chunk). Once loaded it stays mounted, so closing still animates.
export default function ConfirmDialog(props: { options: Accessor<ConfirmOptions | undefined>; settle: (result: boolean) => void }) {
  const { t } = useTranslation("common")

  return (
    <Dialog open={!!props.options()} onOpenChange={(open) => { if (!open) props.settle(false) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.options()?.title ?? t("confirmQuestion")}</DialogTitle>
          <DialogDescription>{props.options()?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.settle(false)}>
            {props.options()?.cancelLabel ?? t("cancel")}
          </Button>
          <Button
            variant={props.options()?.destructive ? "destructive" : "default"}
            onClick={() => props.settle(true)}
          >
            {props.options()?.confirmLabel ?? t("yes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
