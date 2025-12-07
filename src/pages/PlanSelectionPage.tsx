import { useState } from 'react';
import api from '@/services/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function PlanSelectionPage() {
  const [loading, setLoading] = useState(false);

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
        alert('Erro ao iniciar pagamento: URL não encontrada.');
      }
    } catch (error: any) {
      console.error("Erro no checkout:", error);
      alert('Erro ao processar pagamento. Verifique se sua sessão está ativa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Escolha seu Plano</h1>
          <p className="mt-4 text-lg text-gray-600">
            Para continuar acessando o sistema, selecione uma das opções abaixo.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-8">
          {/* Monthly Plan */}
          <Card className="relative flex flex-col border-2 border-transparent hover:border-primary/50 transition-all">
            <CardHeader>
              <CardTitle className="text-2xl">Mensal</CardTitle>
              <CardDescription>Flexibilidade total para seu negócio</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-4">
                <span className="text-4xl font-bold">R$ 6,90</span>
                <span className="text-gray-500">/mês</span>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Acesso completo ao sistema</li>
                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Suporte prioritário</li>
                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Cancele quando quiser</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => handleCheckout('monthly')}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Processando...' : 'Assinar Mensal'}
              </Button>
            </CardFooter>
          </Card>

          {/* Annual Plan */}
          <Card className="relative flex flex-col border-2 border-green-500 shadow-lg scale-105 z-10">
            <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
              MAIS POPULAR
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">Anual</CardTitle>
              <CardDescription>Economize com pagamento anual</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-4">
                <span className="text-4xl font-bold">R$ 60,91</span>
                <span className="text-gray-500">/ano</span>
              </div>
              <p className="text-sm text-green-600 font-medium mb-4">Equivalente a R$ 5,07/mês</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Tudo do plano mensal</li>
                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Desconto de ~27%</li>
                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Cobrança anual</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => handleCheckout('annual')}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {loading ? 'Processando...' : 'Assinar Anual'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
