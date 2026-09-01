import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { authClient } from '@/lib/authClient'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true)
    const { error } = await authClient.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    setIsLoading(false)
    if (error) {
      toast.error(t('resetPasswordFailed'))
      return
    }
    setSent(true)
  }
  return <div className="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]"><Card className="w-full max-w-md"><CardHeader><CardTitle>{t('forgotPasswordTitle')}</CardTitle></CardHeader>{sent ? <CardContent>{t('forgotPasswordEmailSent')}</CardContent> : <form onSubmit={handleSubmit}><CardContent className="space-y-2"><Label htmlFor="forgot-email">{t('email')}</Label><Input id="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></CardContent><CardFooter><Button className="w-full" type="submit" disabled={isLoading}>{t('sendResetLink')}</Button></CardFooter></form>}</Card></div>
}
