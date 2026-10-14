import { Show, splitProps, type ComponentProps, type JSX } from "solid-js"
import { Dialog as DialogPrimitive } from "@kobalte/core/dialog"
import { X } from "lucide-solid"

import { cn } from "@/lib/utils"
import { useTranslation } from "@/i18n/solid"

// Radix's data-[state=open|closed] become Kobalte's data-[expanded] and data-[closed].
const Dialog = DialogPrimitive

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.CloseButton

function DialogOverlay(props: ComponentProps<typeof DialogPrimitive.Overlay<"div">>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <DialogPrimitive.Overlay
      class={cn(
        "fixed inset-0 z-50 bg-black/80  data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0",
        local.class
      )}
      {...others}
    />
  )
}

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content<"div">> & {
  showCloseButton?: boolean
}

// Radix's FocusScope focuses the first tabbable element and selects the text
// of an input (an edit dialog opens with the name selected); Kobalte only
// focuses. Same element, plus the selection, so the screen matches.
const TABBABLE = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

function focusFirst(content: HTMLElement | undefined) {
  const first = content?.querySelector<HTMLElement>(TABBABLE)
  if (!first) return false
  first.focus({ preventScroll: true })
  if (first instanceof HTMLInputElement && typeof first.select === "function") first.select()
  return true
}

function DialogContent(props: DialogContentProps) {
  const [local, others] = splitProps(props, ["class", "children", "showCloseButton", "onOpenAutoFocus", "ref"])
  const { t } = useTranslation("common")
  let content: HTMLElement | undefined

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        class={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%] sm:rounded-lg",
          local.class
        )}
        ref={(element: HTMLElement) => {
          content = element
          if (typeof local.ref === "function") (local.ref as (element: HTMLElement) => void)(element)
        }}
        onOpenAutoFocus={(event: Event) => {
          if (typeof local.onOpenAutoFocus === "function") local.onOpenAutoFocus(event)
          if (!event.defaultPrevented && focusFirst(content)) event.preventDefault()
        }}
        {...others}
      >
        {local.children}
        <Show when={local.showCloseButton ?? true}>
          {/* Kobalte's default aria-label ("Dismiss", English only) would hide the translated text. */}
          <DialogPrimitive.CloseButton aria-label={t("accessibility.close")} class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[expanded]:bg-accent data-[expanded]:text-muted-foreground">
            <X class="h-4 w-4" />
            <span class="sr-only">{t("accessibility.close")}</span>
          </DialogPrimitive.CloseButton>
        </Show>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <div
      class={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left",
        local.class
      )}
      {...others}
    />
  )
}

function DialogFooter(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <div
      class={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        local.class
      )}
      {...others}
    />
  )
}

function DialogTitle(props: ComponentProps<typeof DialogPrimitive.Title<"h2">>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <DialogPrimitive.Title
      class={cn(
        "text-lg font-semibold leading-none tracking-tight",
        local.class
      )}
      {...others}
    />
  )
}

function DialogDescription(props: ComponentProps<typeof DialogPrimitive.Description<"p">>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <DialogPrimitive.Description
      class={cn("text-sm text-muted-foreground", local.class)}
      {...others}
    />
  )
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
