import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { authClient } from '@/lib/authClient'
import { MIN_PASSWORD_LENGTH } from '@/lib/authValidation'
import { getErrorTranslationKey } from '@/i18n/error-keys'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

type LinkState = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const { t } = useTranslation('auth'); const { t: tErrors } = useTranslation('errors'); const navigate = useNavigate()
  const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [isLoading, setIsLoading] = useState(false)
  const [linkState, setLinkState] = useState<LinkState>('checking')

  useEffect(() => {
    // O link de recuperação chega com a sessão no hash (auth-js consome no init)
    // ou com error_code (expirado/já usado). Sem sessão, updateUser falharia com
    // um erro genérico — melhor dizer logo que o link não vale mais.
    const hasHashError = new URLSearchParams(window.location.hash.replace(/^#/, '')).has('error_code')
    let mounted = true
    void authClient.getSession().then(({ data }) => {
      if (!mounted) return
      setLinkState(!hasHashError && data.session ? 'ready' : 'invalid')
      if (hasHashError) window.history.replaceState(null, '', window.location.pathname)
    })
    return () => { mounted = false }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) { toast.error(t('passwordsDontMatch')); return }
    setIsLoading(true)
    const { error } = await authClient.updateUser({ password })
    setIsLoading(false)
    if (error) {
      const translation = getErrorTranslationKey('passwordReset', error.code)
      toast.error(translation.namespace === 'auth' ? t(translation.key) : tErrors(translation.key))
      return
    }
    toast.success(t('resetPasswordSuccess')); navigate('/login')
  }

  return <div className="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]"><Card className="w-full max-w-md"><CardHeader><CardTitle>{t('resetPasswordTitle')}</CardTitle></CardHeader>
    {linkState === 'invalid'
      ? <CardContent className="space-y-4"><p>{t('resetLinkInvalid')}</p><a href="/forgot-password" className="text-sm underline">{t('requestNewResetLink')}</a></CardContent>
      : <form onSubmit={handleSubmit}><CardContent className="space-y-2">
          <Label htmlFor="new-password">{t('newPassword')}</Label>
          <Input id="new-password" type="password" required minLength={MIN_PASSWORD_LENGTH} aria-describedby="new-password-hint" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p id="new-password-hint" className="text-xs text-muted-foreground">{t('passwordHint', { min: MIN_PASSWORD_LENGTH })}</p>
          <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
          <Input id="confirm-password" type="password" required minLength={MIN_PASSWORD_LENGTH} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </CardContent><CardFooter><Button className="w-full" type="submit" disabled={isLoading || linkState !== 'ready'}>{t('resetPassword')}</Button></CardFooter></form>}
  </Card></div>
}
