import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorCode } from '@/services/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getErrorTranslationKey } from '@/i18n/error-keys';
import { formatCurrencyBRL } from '@/i18n/format';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function PlanSelectionPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');

  useEffect(() => {
    if (user?.establishment?.status === 'ACTIVE') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleCheckout = async (type: 'monthly' | 'annual') => {
    setLoading(true);
    try {
      const endpoint = type === 'monthly' 
        ? '/payments/stripe/mensal' 
        : '/payments/stripe/anual';

      const response = await api.post(endpoint);

      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        console.error('Resposta inesperada:', response.data);
        toast.error(tErrors('paymentUrl'));
      }
    } catch (error: any) {
      console.error("Erro no checkout:", error);
      const translation = getErrorTranslationKey('payment', getErrorCode(error));
      toast.error(tErrors(translation.namespace === 'errors' ? translation.key : 'payment'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-muted/40">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full space-y-8">
          <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-foreground">
            {t('plans.noPlanTitle')}
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-muted-foreground">
            {t('plans.noPlanDescription')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-8">
          {/* Monthly Plan */}
          <Card className="relative flex flex-col border-2 border-transparent hover:border-primary/50 transition-all">
            <CardHeader>
              <CardTitle className="text-2xl">{t('plans.monthly')}</CardTitle>
              <CardDescription>{t('plans.monthlyDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-4">
                <span className="text-4xl font-bold">{formatCurrencyBRL(6.9)}</span>
                <span className="text-gray-500 dark:text-muted-foreground">{t('plans.monthlyUnit')}</span>
              </div>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t('plans.features.fullAccess')}</li>
                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t('plans.features.prioritySupport')}</li>
                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t('plans.features.cancelAnytime')}</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => handleCheckout('monthly')}
                disabled={loading}
                className="w-full"
              >
                {loading ? t('processing') : t('plans.subscribeMonthly')}
              </Button>
            </CardFooter>
          </Card>

          {/* Annual Plan */}
          <Card className="relative flex flex-col border-2 border-green-500 shadow-lg scale-105 z-10">
            <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
              {t('plans.popular')}
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">{t('plans.annual')}</CardTitle>
              <CardDescription>{t('plans.annualDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-4">
                <span className="text-4xl font-bold">{formatCurrencyBRL(60.91)}</span>
                <span className="text-gray-500 dark:text-muted-foreground">{t('plans.annualUnit')}</span>
              </div>
              <p className="text-sm text-green-600 font-medium mb-4">
                {t('plans.equivalentMonthly', { price: formatCurrencyBRL(5.07) })}
              </p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t('plans.features.sameAsMonthly')}</li>
                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t('plans.features.discount')}</li>
                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t('plans.features.annualBilling')}</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => handleCheckout('annual')}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {loading ? t('processing') : t('plans.subscribeAnnual')}
              </Button>
            </CardFooter>
          </Card>
        </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
