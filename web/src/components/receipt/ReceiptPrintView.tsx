import { For, Show } from "solid-js"

import type { PaperWidthPreset } from "@/lib/printPreferences"
import { formatCents } from "@/lib/money"

/** A receipt line. Money in integer cents, as the /v1 sends it. */
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
  /** The whole payment line, already translated ("Forma de pagamento: Pix"). */
  paymentLabel?: string
  locale?: string
}

interface ReceiptPrintViewProps {
  data: ReceiptData
  width: PaperWidthPreset
}

// Same markup and classes as the React receipt (src/index.css styles it).
// Text only: nothing here is injected as HTML.
export function ReceiptPrintView(props: ReceiptPrintViewProps) {
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
        <div class="receipt__meta">{props.data.paymentLabel}</div>
      </Show>
    </div>
  )
}
