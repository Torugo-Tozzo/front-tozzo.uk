import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle } from "lucide-react";

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const timer = setTimeout(async () => {
      // Força o logout para garantir que o usuário faça login novamente
      // e receba um novo token/status atualizado do backend
      logout();
      navigate('/login');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, logout]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 p-8">
        <div className="flex justify-center">
          <CheckCircle className="h-20 w-20 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Pagamento Confirmado!</h1>
        <p className="text-lg text-gray-600">Estamos preparando seu ambiente...</p>
        <p className="text-sm text-gray-500">Você será redirecionado em instantes.</p>
      </div>
    </div>
  );
}
