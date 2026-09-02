import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorCode } from '@/services/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getErrorTranslationKey } from '@/i18n/error-keys';
import { PricingCards } from '@/components/PricingCards';
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function PlanSelectionPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');

  useEffect(() => {
    if (user?.establishment?.status === 'ACTIVE' && user?.establishment?.plan && user.establishment.plan !== 'FREE') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleCheckout = async (tier: 'PAGO' | 'ENTERPRISE', interval: 'monthly' | 'annual') => {
    setLoading(true);
    try {
      const response = await api.post('/payments/stripe/checkout', { tier, interval });

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

        <PricingCards
          currentPlan={user?.establishment?.plan}
          onSelectPago={(interval) => handleCheckout('PAGO', interval)}
          onSelectEnterprise={() => handleCheckout('ENTERPRISE', 'monthly')}
          loading={loading}
        />
        </div>
      </main>
      <Footer />
    </div>
  );
}
