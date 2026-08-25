export type ErrorContext =
  | "login"
  | "registration"
  | "payment"
  | "loadOrders"
  | "saveOrder"
  | "deleteOrder"
  | "closeOrder"
  | "changeOrderStatus"
  | "loadSales"
  | "createSale"
  | "saleDetails"
  | "cancelSale"
  | "loadProducts"
  | "loadProductTypes"

type ErrorKey =
  | "generic"
  | "payment"
  | "loadOrders"
  | "saveOrder"
  | "deleteOrder"
  | "closeOrder"
  | "changeOrderStatus"
  | "loadSales"
  | "createSale"
  | "saleDetails"
  | "cancelSale"
  | "loadProducts"
export type ErrorTranslation =
  | { namespace: "auth"; key: "loginFailure" | "registerFailure" }
  | { namespace: "errors"; key: ErrorKey }

const fallbackByContext: Record<ErrorContext, ErrorTranslation> = {
  login: { namespace: "auth", key: "loginFailure" },
  registration: { namespace: "auth", key: "registerFailure" },
  payment: { namespace: "errors", key: "payment" },
  loadOrders: { namespace: "errors", key: "loadOrders" },
  saveOrder: { namespace: "errors", key: "saveOrder" },
  deleteOrder: { namespace: "errors", key: "deleteOrder" },
  closeOrder: { namespace: "errors", key: "closeOrder" },
  changeOrderStatus: { namespace: "errors", key: "changeOrderStatus" },
  loadSales: { namespace: "errors", key: "loadSales" },
  createSale: { namespace: "errors", key: "createSale" },
  saleDetails: { namespace: "errors", key: "saleDetails" },
  cancelSale: { namespace: "errors", key: "cancelSale" },
  loadProducts: { namespace: "errors", key: "loadProducts" },
  loadProductTypes: { namespace: "errors", key: "loadProducts" },
}

const errorKeyByContext: Partial<Record<ErrorContext, Record<string, ErrorTranslation>>> = {
  login: {
    AUTH_INVALID_CREDENTIALS: { namespace: "auth", key: "loginFailure" },
    AUTH_INTERNAL_ERROR: { namespace: "errors", key: "generic" },
  },
  registration: {
    AUTH_ACTIVE_LIMIT_REACHED: { namespace: "auth", key: "registerFailure" },
    AUTH_EMAIL_ALREADY_EXISTS: { namespace: "auth", key: "registerFailure" },
    AUTH_INVALID_INPUT: { namespace: "auth", key: "registerFailure" },
    AUTH_PASSWORD_TOO_SHORT: { namespace: "auth", key: "registerFailure" },
    AUTH_PENDING_LIMIT_REACHED: { namespace: "auth", key: "registerFailure" },
    AUTH_INTERNAL_ERROR: { namespace: "errors", key: "generic" },
  },
  payment: {
    PAYMENT_CHECKOUT_CREATE_FAILED: { namespace: "errors", key: "payment" },
    PAYMENT_INVALID_USER: { namespace: "errors", key: "payment" },
    AUTH_INTERNAL_ERROR: { namespace: "errors", key: "generic" },
  },
  saveOrder: {
    ORDER_LIMIT_REACHED: { namespace: "errors", key: "saveOrder" },
    ORDER_NOT_FOUND: { namespace: "errors", key: "saveOrder" },
    PRODUCT_NOT_FOUND: { namespace: "errors", key: "saveOrder" },
  },
  deleteOrder: {
    ORDER_NOT_FOUND: { namespace: "errors", key: "deleteOrder" },
    ORDER_NOT_OPEN: { namespace: "errors", key: "deleteOrder" },
  },
  closeOrder: {
    ORDER_NOT_FOUND: { namespace: "errors", key: "closeOrder" },
    ORDER_ALREADY_CLOSED: { namespace: "errors", key: "closeOrder" },
    ORDER_CONFLICT: { namespace: "errors", key: "closeOrder" },
  },
  changeOrderStatus: {
    INVALID_ORDER_STATUS: { namespace: "errors", key: "changeOrderStatus" },
    ORDER_STATUS_FORBIDDEN: { namespace: "errors", key: "changeOrderStatus" },
    ORDER_STATUS_REQUIRED: { namespace: "errors", key: "changeOrderStatus" },
    ORDER_NOT_FOUND: { namespace: "errors", key: "changeOrderStatus" },
    ORDER_ALREADY_CLOSED: { namespace: "errors", key: "changeOrderStatus" },
    ORDER_CONFLICT: { namespace: "errors", key: "changeOrderStatus" },
  },
  createSale: {
    ORDER_NOT_FOUND: { namespace: "errors", key: "createSale" },
    ORDER_NOT_OPEN: { namespace: "errors", key: "createSale" },
  },
  saleDetails: {
    SALE_NOT_FOUND: { namespace: "errors", key: "saleDetails" },
  },
  cancelSale: {
    SALE_NOT_FOUND: { namespace: "errors", key: "cancelSale" },
  },
}

export function getErrorTranslationKey(context: ErrorContext, code?: string): ErrorTranslation {
  const translation = code ? errorKeyByContext[context]?.[code] : undefined
  return translation ?? fallbackByContext[context]
}
