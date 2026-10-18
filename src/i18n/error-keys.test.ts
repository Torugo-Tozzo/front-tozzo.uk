import { describe, expect, test } from "vitest"

import { getErrorTranslationKey } from "./error-keys"

describe("structured API error outcomes", () => {
  test("maps known auth and payment codes to existing localized keys", () => {
    expect(getErrorTranslationKey("login", "INVALID_CREDENTIALS")).toEqual({ namespace: "auth", key: "invalidCredentials" })
    expect(getErrorTranslationKey("registration", "INTERNAL_ERROR")).toEqual({ namespace: "errors", key: "generic" })
    expect(getErrorTranslationKey("payment", "BILLING_CHECKOUT_FAILED")).toEqual({ namespace: "errors", key: "payment" })
  })

  test("uses the localized flow fallback when an API code is missing or unknown", () => {
    expect(getErrorTranslationKey("login")).toEqual({ namespace: "auth", key: "loginFailure" })
    expect(getErrorTranslationKey("registration", "AUTH_UNKNOWN")).toEqual({ namespace: "auth", key: "registerFailure" })
    expect(getErrorTranslationKey("payment", "PAYMENT_UNKNOWN")).toEqual({ namespace: "errors", key: "payment" })
  })

  test("gives signup/login outcomes their own messages instead of the generic failure", () => {
    expect(getErrorTranslationKey("login", "EMAIL_NOT_VERIFIED")).toEqual({ namespace: "auth", key: "emailNotConfirmed" })
    expect(getErrorTranslationKey("registration", "EMAIL_IN_USE")).toEqual({ namespace: "auth", key: "emailAlreadyRegistered" })
    expect(getErrorTranslationKey("registration", "PASSWORD_INVALID")).toEqual({ namespace: "auth", key: "weakPassword" })
    expect(getErrorTranslationKey("registration", "TERMS_NOT_ACCEPTED")).toEqual({ namespace: "auth", key: "registerFailure" })
  })

  test("covers invalid email, rate limit and password reset outcomes", () => {
    expect(getErrorTranslationKey("registration", "VALIDATION_FAILED")).toEqual({ namespace: "auth", key: "registerFailure" })
    expect(getErrorTranslationKey("login", "VALIDATION_FAILED")).toEqual({ namespace: "auth", key: "invalidEmail" })
    expect(getErrorTranslationKey("registration", "RATE_LIMITED")).toEqual({ namespace: "auth", key: "authRateLimited" })
    expect(getErrorTranslationKey("login", "RATE_LIMITED")).toEqual({ namespace: "auth", key: "authRateLimited" })
    expect(getErrorTranslationKey("passwordReset", "PASSWORD_INVALID")).toEqual({ namespace: "auth", key: "weakPassword" })
    expect(getErrorTranslationKey("passwordReset", "TOKEN_INVALID")).toEqual({ namespace: "auth", key: "resetPasswordFailed" })
  })

  test("supports operation-specific dashboard outcomes without reading server text", () => {
    expect(getErrorTranslationKey("saveOrder", "ORDER_LIMIT_REACHED")).toEqual({ namespace: "errors", key: "saveOrder" })
    expect(getErrorTranslationKey("deleteOrder", "ORDER_NOT_FOUND")).toEqual({ namespace: "errors", key: "deleteOrder" })
    expect(getErrorTranslationKey("createSale", "ORDER_NOT_FOUND")).toEqual({ namespace: "errors", key: "createSale" })
    expect(getErrorTranslationKey("cancelSale", "SALE_NOT_FOUND")).toEqual({ namespace: "errors", key: "cancelSale" })
    expect(getErrorTranslationKey("changeOrderItemStatus", "ORDER_ITEM_NOT_FOUND")).toEqual({ namespace: "errors", key: "changeOrderItemStatus" })
    expect(getErrorTranslationKey("changeOrderItemStatus", "ORDER_ITEM_STATUS_INVALID")).toEqual({ namespace: "errors", key: "changeOrderItemStatus" })
  })

  test("maps PRODUCT_LIMIT_REACHED to createProduct", () => {
    expect(getErrorTranslationKey("createProduct", "PRODUCT_LIMIT_REACHED")).toEqual({ namespace: "errors", key: "productLimitReached" })
  })
})

describe("email link outcomes (S2)", () => {
  test("an expired confirmation link and an email already taken get their own messages", () => {
    expect(getErrorTranslationKey("emailVerification", "TOKEN_INVALID")).toEqual({ namespace: "auth", key: "confirmationLinkExpired" })
    expect(getErrorTranslationKey("emailVerification", "RATE_LIMITED")).toEqual({ namespace: "auth", key: "authRateLimited" })
    expect(getErrorTranslationKey("emailVerification", "INTERNAL_ERROR")).toEqual({ namespace: "errors", key: "generic" })
    expect(getErrorTranslationKey("emailChange", "TOKEN_INVALID")).toEqual({ namespace: "auth", key: "confirmEmailChangeInvalid" })
    expect(getErrorTranslationKey("emailChange", "EMAIL_IN_USE")).toEqual({ namespace: "auth", key: "emailChangeInUse" })
    expect(getErrorTranslationKey("passwordReset", "PASSWORD_UNCHANGED")).toEqual({ namespace: "auth", key: "samePassword" })
    expect(getErrorTranslationKey("login", "GOOGLE_TOKEN_INVALID")).toEqual({ namespace: "auth", key: "loginFailure" })
  })

  test("explains an image upload the environment cannot take yet", () => {
    expect(getErrorTranslationKey("uploadImage", "NOT_READY")).toEqual({ namespace: "errors", key: "uploadUnavailable" })
    expect(getErrorTranslationKey("uploadImage", "UPLOAD_INVALID")).toEqual({ namespace: "errors", key: "uploadInvalid" })
    expect(getErrorTranslationKey("uploadImage", "UPLOAD_PUT_FAILED")).toEqual({ namespace: "errors", key: "uploadImage" })
  })
})

describe("order conflicts (S4)", () => {
  test("a closed order, an order out for delivery and a delivery not started get their own messages", () => {
    expect(getErrorTranslationKey("deleteOrder", "ORDER_NOT_OPEN")).toEqual({ namespace: "errors", key: "orderNotOpen" })
    expect(getErrorTranslationKey("deleteOrder", "ORDER_DELIVERING")).toEqual({ namespace: "errors", key: "orderDelivering" })
    expect(getErrorTranslationKey("saveOrder", "ORDER_NOT_OPEN")).toEqual({ namespace: "errors", key: "orderNotOpen" })
    expect(getErrorTranslationKey("saveOrder", "ORDER_DELIVERING")).toEqual({ namespace: "errors", key: "orderDelivering" })
    expect(getErrorTranslationKey("closeOrder", "ORDER_ALREADY_CLOSED")).toEqual({ namespace: "errors", key: "orderNotOpen" })
    expect(getErrorTranslationKey("closeOrder", "ORDER_CONFLICT")).toEqual({ namespace: "errors", key: "orderNotOpen" })
    expect(getErrorTranslationKey("closeOrder", "DELIVERY_NOT_STARTED")).toEqual({ namespace: "errors", key: "deliveryNotStarted" })
    expect(getErrorTranslationKey("changeOrderItemStatus", "ORDER_DELIVERING")).toEqual({ namespace: "errors", key: "orderDelivering" })
    expect(getErrorTranslationKey("closeOrder", "INTERNAL_ERROR")).toEqual({ namespace: "errors", key: "closeOrder" })
    expect(getErrorTranslationKey("saveOrder", "ORDER_CONFLICT")).toEqual({ namespace: "errors", key: "orderChanged" })
    expect(getErrorTranslationKey("saveOrder", "ORDER_VERSION_INVALID")).toEqual({ namespace: "errors", key: "saveOrder" })
  })
})
