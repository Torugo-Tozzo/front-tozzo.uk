export type ErrorContext = "login" | "registration" | "payment"
export type ErrorTranslation =
  | { namespace: "auth"; key: "loginFailure" | "registerFailure" }
  | { namespace: "errors"; key: "generic" | "payment" }

const fallbackByContext: Record<ErrorContext, ErrorTranslation> = {
  login: { namespace: "auth", key: "loginFailure" },
  registration: { namespace: "auth", key: "registerFailure" },
  payment: { namespace: "errors", key: "payment" },
}

const errorKeyByContext: Record<ErrorContext, Record<string, ErrorTranslation>> = {
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
}

export function getErrorTranslationKey(context: ErrorContext, code?: string): ErrorTranslation {
  const translation = code ? errorKeyByContext[context][code] : undefined
  return translation ?? fallbackByContext[context]
}
