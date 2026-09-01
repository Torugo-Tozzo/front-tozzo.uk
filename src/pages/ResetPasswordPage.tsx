import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { authClient } from '@/lib/authClient'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

export default function ResetPasswordPage() {
  const { t } = useTranslation('auth'); const navigate = useNavigate(); const [password, setPassword] = useState(''); const [isLoading, setIsLoading] = useState(false)
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setIsLoading(true); const { error } = await authClient.updateUser({ password }); setIsLoading(false); if (error) { toast.error(t('resetPasswordFailed')); return }; toast.success(t('resetPasswordSuccess')); navigate('/login') }
  return <div className="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]"><Card className="w-full max-w-md"><CardHeader><CardTitle>{t('resetPasswordTitle')}</CardTitle></CardHeader><form onSubmit={handleSubmit}><CardContent className="space-y-2"><Label htmlFor="new-password">{t('newPassword')}</Label><Input id="new-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></CardContent><CardFooter><Button className="w-full" type="submit" disabled={isLoading}>{t('resetPassword')}</Button></CardFooter></form></Card></div>
}
