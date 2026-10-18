import { apiErrorOf } from '@/api/errors'
import { getErrorTranslationKey, type ErrorContext } from './error-keys'
import { useTranslation } from './solid'

/** The message of a failed /v1 call, picked by its `code` (never by `detail`). */
export function useErrorMessage() {
  const { t: tAuth } = useTranslation('auth')
  const { t: tErrors } = useTranslation('errors')
  return (context: ErrorContext, error: unknown): string => {
    const translation = getErrorTranslationKey(context, apiErrorOf(error).code)
    return translation.namespace === 'auth' ? tAuth(translation.key) : tErrors(translation.key)
  }
}
