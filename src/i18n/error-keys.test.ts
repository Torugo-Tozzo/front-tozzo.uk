import { describe, expect, test } from "bun:test"

import { getErrorTranslationKey } from "./error-keys"

describe("structured API error outcomes", () => {
  test("maps known auth and payment codes to existing localized keys", () => {
    expect(getErrorTranslationKey("login", "AUTH_INVALID_CREDENTIALS")).toEqual({ namespace: "auth", key: "loginFailure" })
    expect(getErrorTranslationKey("registration", "AUTH_INTERNAL_ERROR")).toEqual({ namespace: "errors", key: "generic" })
    expect(getErrorTranslationKey("payment", "PAYMENT_CHECKOUT_CREATE_FAILED")).toEqual({ namespace: "errors", key: "payment" })
  })

  test("uses the localized flow fallback when an API code is missing or unknown", () => {
    expect(getErrorTranslationKey("login")).toEqual({ namespace: "auth", key: "loginFailure" })
    expect(getErrorTranslationKey("registration", "AUTH_UNKNOWN")).toEqual({ namespace: "auth", key: "registerFailure" })
    expect(getErrorTranslationKey("payment", "PAYMENT_UNKNOWN")).toEqual({ namespace: "errors", key: "payment" })
  })

  test("maps lowercase auth-js codes while retaining legacy mappings", () => {
    expect(getErrorTranslationKey("login", "invalid_credentials")).toEqual({ namespace: "auth", key: "loginFailure" })
    expect(getErrorTranslationKey("registration", "email_exists")).toEqual({ namespace: "auth", key: "registerFailure" })
    expect(getErrorTranslationKey("registration", "weak_password")).toEqual({ namespace: "auth", key: "registerFailure" })
    expect(getErrorTranslationKey("registration", "unexpected_failure")).toEqual({ namespace: "errors", key: "generic" })
  })

  test("supports operation-specific dashboard outcomes without reading server text", () => {
    expect(getErrorTranslationKey("saveOrder", "ORDER_LIMIT_REACHED")).toEqual({ namespace: "errors", key: "saveOrder" })
    expect(getErrorTranslationKey("deleteOrder", "ORDER_NOT_FOUND")).toEqual({ namespace: "errors", key: "deleteOrder" })
    expect(getErrorTranslationKey("createSale", "ORDER_NOT_FOUND")).toEqual({ namespace: "errors", key: "createSale" })
    expect(getErrorTranslationKey("cancelSale", "SALE_NOT_FOUND")).toEqual({ namespace: "errors", key: "cancelSale" })
    expect(getErrorTranslationKey("changeOrderItemStatus", "ORDER_ITEM_NOT_FOUND")).toEqual({ namespace: "errors", key: "changeOrderItemStatus" })
  })

  test("mapeia PRODUCT_LIMIT_REACHED pro createProduct", () => {
    expect(getErrorTranslationKey("createProduct", "PRODUCT_LIMIT_REACHED")).toEqual({ namespace: "errors", key: "productLimitReached" })
  })
})
