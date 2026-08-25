import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface ProtectedRouteProps {
  allowPending?: boolean;
}

export default function ProtectedRoute({ allowPending = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useTranslation('common');

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen" role="status" aria-label={t('loading')}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Pending payment users may access only routes explicitly marked as allowed.
  const status = user?.establishment?.status;
  
  if (!allowPending) {
    if (user?.establishment && status !== 'ACTIVE') {
      return <Navigate to="/plan" replace />;
    }
  }

  return <Outlet />;
}
