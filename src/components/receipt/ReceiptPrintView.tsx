import { formatCurrencyBRL } from '@/i18n/format'
import type { PaperWidthPreset } from '@/lib/printPreferences'

export interface ReceiptLineItem {
  name: string
  quantity: number
  unitPrice: number
}

export interface ReceiptData {
  title: string
  customerName: string
  dateLabel: string
  items: ReceiptLineItem[]
  total: number
  totalLabel: string
  locale?: string
}

interface ReceiptPrintViewProps {
  data: ReceiptData
  width: PaperWidthPreset
}

export function ReceiptPrintView({ data, width }: ReceiptPrintViewProps) {
  return (
    <div className={`receipt receipt--${width}`}>
      <div className="receipt__brand">TOZZO BURGER</div>
      <div className="receipt__title">{data.title}</div>
      <div className="receipt__meta">{data.customerName}</div>
      <div className="receipt__meta">{data.dateLabel}</div>
      <hr className="receipt__rule" />
      {data.items.map((item, index) => (
        <div className="receipt__item" key={index}>
          <span className="receipt__item-name">
            {item.quantity}x {item.name}
          </span>
          <span className="receipt__item-price">
            {formatCurrencyBRL(item.quantity * item.unitPrice, data.locale)}
          </span>
        </div>
      ))}
      <hr className="receipt__rule" />
      <div className="receipt__total">
        <span>{data.totalLabel}</span>
        <span>{formatCurrencyBRL(data.total, data.locale)}</span>
      </div>
    </div>
  )
}
