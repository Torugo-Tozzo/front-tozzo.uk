export type ErrorContext =
  | "login"
  | "registration"
  | "payment"
  | "loadOrders"
  | "saveOrder"
  | "deleteOrder"
  | "closeOrder"
  | "changeOrderItemStatus"
  | "loadSales"
  | "createSale"
  | "saleDetails"
  | "cancelSale"
  | "loadProducts"
  | "loadProductTypes"
  | "loadEmployees"
  | "createProduct"
  | "updateProduct"
  | "deleteProduct"
  | "createType"
  | "updateType"
  | "updateTypeStatus"
  | "createEmployee"
  | "updateEmployee"
  | "deleteEmployee"
  | "deleteAccount"
  | "passwordReset"
  | "emailVerification"
  | "emailChange"
  | "uploadImage"

type ErrorKey =
  | "generic"
  | "payment"
  | "loadOrders"
  | "saveOrder"
  | "deleteOrder"
  | "closeOrder"
  | "changeOrderItemStatus"
  | "loadSales"
  | "createSale"
  | "saleDetails"
  | "cancelSale"
  | "loadProducts"
  | "loadEmployees"
  | "createProduct"
  | "productLimitReached"
  | "updateProduct"
  | "deleteProduct"
  | "createType"
  | "updateType"
  | "updateTypeStatus"
  | "createEmployee"
  | "updateEmployee"
  | "deleteEmployee"
  | "uploadImage"
  | "uploadUnavailable"
  | "uploadInvalid"
export type ErrorTranslation =
  | {
      namespace: "auth"
      key:
        | "loginFailure"
        | "registerFailure"
        | "emailNotConfirmed"
        | "emailAlreadyRegistered"
        | "weakPassword"
        | "authRateLimited"
        | "invalidCredentials"
        | "invalidEmail"
        | "samePassword"
        | "resetPasswordFailed"
        | "confirmationLinkExpired"
        | "confirmEmailChangeInvalid"
        | "emailChangeInUse"
    }
  | { namespace: "errors"; key: ErrorKey }

const fallbackByContext: Record<ErrorContext, ErrorTranslation> = {
  login: { namespace: "auth", key: "loginFailure" },
  registration: { namespace: "auth", key: "registerFailure" },
  payment: { namespace: "errors", key: "payment" },
  loadOrders: { namespace: "errors", key: "loadOrders" },
  saveOrder: { namespace: "errors", key: "saveOrder" },
  deleteOrder: { namespace: "errors", key: "deleteOrder" },
  closeOrder: { namespace: "errors", key: "closeOrder" },
  changeOrderItemStatus: { namespace: "errors", key: "changeOrderItemStatus" },
  loadSales: { namespace: "errors", key: "loadSales" },
  createSale: { namespace: "errors", key: "createSale" },
  saleDetails: { namespace: "errors", key: "saleDetails" },
  cancelSale: { namespace: "errors", key: "cancelSale" },
  loadProducts: { namespace: "errors", key: "loadProducts" },
  loadProductTypes: { namespace: "errors", key: "loadProducts" },
  loadEmployees: { namespace: "errors", key: "loadEmployees" },
  createProduct: { namespace: "errors", key: "createProduct" },
  updateProduct: { namespace: "errors", key: "updateProduct" },
  deleteProduct: { namespace: "errors", key: "deleteProduct" },
  createType: { namespace: "errors", key: "createType" },
  updateType: { namespace: "errors", key: "updateType" },
  updateTypeStatus: { namespace: "errors", key: "updateTypeStatus" },
  createEmployee: { namespace: "errors", key: "createEmployee" },
  updateEmployee: { namespace: "errors", key: "updateEmployee" },
  deleteEmployee: { namespace: "errors", key: "deleteEmployee" },
  deleteAccount: { namespace: "errors", key: "generic" },
  passwordReset: { namespace: "auth", key: "resetPasswordFailed" },
  emailVerification: { namespace: "errors", key: "generic" },
  emailChange: { namespace: "errors", key: "generic" },
  uploadImage: { namespace: "errors", key: "uploadImage" },
}

// Keyed by the `code` of the /v1 problem+json (api-tozzo.uk
// internal/platform/httpx/codes.go). The messages are the React app's.
const errorKeyByContext: Partial<Record<ErrorContext, Record<string, ErrorTranslation>>> = {
  login: {
    INVALID_CREDENTIALS: { namespace: "auth", key: "invalidCredentials" },
    GOOGLE_TOKEN_INVALID: { namespace: "auth", key: "loginFailure" },
    EMAIL_NOT_VERIFIED: { namespace: "auth", key: "emailNotConfirmed" },
    VALIDATION_FAILED: { namespace: "auth", key: "invalidEmail" },
    RATE_LIMITED: { namespace: "auth", key: "authRateLimited" },
    INTERNAL_ERROR: { namespace: "errors", key: "generic" },
  },
  registration: {
    EMAIL_IN_USE: { namespace: "auth", key: "emailAlreadyRegistered" },
    PASSWORD_INVALID: { namespace: "auth", key: "weakPassword" },
    TERMS_NOT_ACCEPTED: { namespace: "auth", key: "registerFailure" },
    TOKEN_INVALID: { namespace: "auth", key: "registerFailure" },
    // Any field may be the invalid one (name, trade name, key...), not only the email.
    VALIDATION_FAILED: { namespace: "auth", key: "registerFailure" },
    RATE_LIMITED: { namespace: "auth", key: "authRateLimited" },
    INTERNAL_ERROR: { namespace: "errors", key: "generic" },
  },
  passwordReset: {
    PASSWORD_INVALID: { namespace: "auth", key: "weakPassword" },
    // 422 when the new password equals the current one (the React app's same_password).
    PASSWORD_UNCHANGED: { namespace: "auth", key: "samePassword" },
    VALIDATION_FAILED: { namespace: "auth", key: "invalidEmail" },
    RATE_LIMITED: { namespace: "auth", key: "authRateLimited" },
  },
  emailVerification: {
    TOKEN_INVALID: { namespace: "auth", key: "confirmationLinkExpired" },
    VALIDATION_FAILED: { namespace: "auth", key: "confirmationLinkExpired" },
    RATE_LIMITED: { namespace: "auth", key: "authRateLimited" },
  },
  emailChange: {
    TOKEN_INVALID: { namespace: "auth", key: "confirmEmailChangeInvalid" },
    VALIDATION_FAILED: { namespace: "auth", key: "confirmEmailChangeInvalid" },
    EMAIL_IN_USE: { namespace: "auth", key: "emailChangeInUse" },
    RATE_LIMITED: { namespace: "auth", key: "authRateLimited" },
  },
  payment: {
    BILLING_CHECKOUT_FAILED: { namespace: "errors", key: "payment" },
    BILLING_PLAN_INVALID: { namespace: "errors", key: "payment" },
    BILLING_INTERVAL_INVALID: { namespace: "errors", key: "payment" },
    BILLING_CUSTOMER_MISSING: { namespace: "errors", key: "payment" },
    INTERNAL_ERROR: { namespace: "errors", key: "generic" },
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
  changeOrderItemStatus: {
    ORDER_ITEM_STATUS_INVALID: { namespace: "errors", key: "changeOrderItemStatus" },
    ORDER_ITEM_STATUS_REQUIRED: { namespace: "errors", key: "changeOrderItemStatus" },
    ORDER_ITEM_NOT_FOUND: { namespace: "errors", key: "changeOrderItemStatus" },
    ORDER_NOT_FOUND: { namespace: "errors", key: "changeOrderItemStatus" },
    ROLE_FORBIDDEN: { namespace: "errors", key: "changeOrderItemStatus" },
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
  createProduct: {
    PRODUCT_LIMIT_REACHED: { namespace: "errors", key: "productLimitReached" },
  },
  uploadImage: {
    // 503 while the environment has no R2 bucket configured.
    NOT_READY: { namespace: "errors", key: "uploadUnavailable" },
    UPLOAD_INVALID: { namespace: "errors", key: "uploadInvalid" },
    UPLOAD_NOT_FOUND: { namespace: "errors", key: "uploadImage" },
  },
}

export function getErrorTranslationKey(context: ErrorContext, code?: string): ErrorTranslation {
  const translation = code ? errorKeyByContext[context]?.[code] : undefined
  return translation ?? fallbackByContext[context]
}
