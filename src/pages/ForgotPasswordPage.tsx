import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { authClient } from '@/lib/authClient'
import { normalizeEmail } from '@/lib/authValidation'
import { getErrorTranslationKey } from '@/i18n/error-keys'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const { t: tErrors } = useTranslation('errors')
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true)
    const normalized = normalizeEmail(email)
    const { error } = await authClient.resetPasswordForEmail(normalized, { redirectTo: `${window.location.origin}/reset-password` })
    setIsLoading(false)
    if (error) {
      const translation = getErrorTranslationKey('passwordReset', error.code)
      toast.error(translation.namespace === 'auth' ? t(translation.key) : tErrors(translation.key))
      return
    }
    // O GoTrue responde sucesso mesmo pra email sem conta (anti-enumeração) —
    // a mensagem não pode afirmar que a conta existe.
    setSentTo(normalized)
  }
  return <div className="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]"><Card className="w-full max-w-md"><CardHeader><CardTitle>{t('forgotPasswordTitle')}</CardTitle></CardHeader>{sentTo ? <CardContent className="space-y-4"><p>{t('forgotPasswordEmailSent', { email: sentTo })}</p><a href="/login" className="text-sm underline">{t('backToLogin')}</a></CardContent> : <form onSubmit={handleSubmit}><CardContent className="space-y-2"><Label htmlFor="forgot-email">{t('email')}</Label><Input id="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /><p className="text-xs text-muted-foreground">{t('forgotPasswordHint')}</p></CardContent><CardFooter><Button className="w-full" type="submit" disabled={isLoading}>{t('sendResetLink')}</Button></CardFooter></form>}</Card></div>
}
