import { For, Show } from "solid-js"

import { useTranslation } from "@/i18n/solid"
import type { PaperWidthPreset } from "@/lib/printPreferences"
import { formatCents } from "@/lib/money"

/** A line of the receipt. Money in integer cents, like the /v1. */
export interface ReceiptLineItem {
  name: string
  quantity: number
  unitPriceCents: number
}

export interface ReceiptData {
  title: string
  customerName: string
  dateLabel: string
  items: ReceiptLineItem[]
  totalCents: number
  totalLabel: string
  paymentLabel?: string
  locale?: string
}

interface ReceiptPrintViewProps {
  data: ReceiptData
  width: PaperWidthPreset
}

/** The printed receipt (orders and sales). Styled by the .receipt rules of index.css. */
export function ReceiptPrintView(props: ReceiptPrintViewProps) {
  const { t } = useTranslation("printer")
  return (
    <div class={`receipt receipt--${props.width}`}>
      <div class="receipt__brand">TOZZO BURGER</div>
      <div class="receipt__title">{props.data.title}</div>
      <div class="receipt__meta">{props.data.customerName}</div>
      <div class="receipt__meta">{props.data.dateLabel}</div>
      <hr class="receipt__rule" />
      <For each={props.data.items}>
        {(item) => (
          <div class="receipt__item">
            <span class="receipt__item-name">
              {item.quantity}x {item.name}
            </span>
            <span class="receipt__item-price">
              {formatCents(item.quantity * item.unitPriceCents, props.data.locale)}
            </span>
          </div>
        )}
      </For>
      <hr class="receipt__rule" />
      <div class="receipt__total">
        <span>{props.data.totalLabel}</span>
        <span>{formatCents(props.data.totalCents, props.data.locale)}</span>
      </div>
      <Show when={props.data.paymentLabel}>
        {(label) => <div class="receipt__meta">{t("receiptPaymentMethod", { method: label() })}</div>}
      </Show>
    </div>
  )
}
