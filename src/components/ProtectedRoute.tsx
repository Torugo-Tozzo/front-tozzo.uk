import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  allowPending?: boolean;
}

export default function ProtectedRoute({ allowPending = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Se o usuário estiver pendente de pagamento e a rota não permitir pendentes
  const status = user?.estabelecimento?.status;
  
  if (!allowPending) {
    // Se tiver estabelecimento e não estiver ATIVO, bloqueia
    if (user?.estabelecimento && status !== 'ATIVO') {
      return <Navigate to="/plans" replace />;
    }
    // Se NÃO tiver estabelecimento, pode ser um erro de carga ou usuário sem vínculo
    // Nesse caso, talvez devêssemos bloquear ou redirecionar para um setup?
    // Por enquanto, vamos manter o comportamento de bloquear apenas se explicitamente não for ATIVO
  }

  return <Outlet />;
}
