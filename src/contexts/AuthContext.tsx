import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import type { Establishment, User } from '@/domain/models';
import { fromLegacyWire, normalizeRole } from '@/lib/legacyWire';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUserProfile = async () => {
    try {
      const token = localStorage.getItem('tozzo_token');
      if (!token) return;

      // Decodificar o token para obter dados básicos do usuário
      let userData: User | null = null;
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const decoded = fromLegacyWire(JSON.parse(jsonPayload)) as Partial<User> & { sub?: number | string };
        const decodedId = decoded.id ?? decoded.sub;
        if (decodedId == null) throw new Error('Token does not contain a user id');

        const authenticatedUser: User = {
          id: decodedId,
          name: decoded.name || 'Usuário',
          email: decoded.email || '',
          role: normalizeRole(decoded.role),
          establishment: undefined,
        };
        userData = authenticatedUser;

        try {
          const userResponse = await api.get('/usuarios/me');
          if (userResponse.data) {
            authenticatedUser.name = userResponse.data.name || authenticatedUser.name;
            authenticatedUser.email = userResponse.data.email || authenticatedUser.email;
            authenticatedUser.role = normalizeRole(userResponse.data.role);
          }
        } catch (error) {
          console.warn('Não foi possível buscar dados detalhados do usuário', error);
        }
      } catch (e) {
        console.error('Erro ao decodificar token', e);
      }

      if (!userData) return;

      try {
        const establishmentResponse = await api.get('/estabelecimentos');
        // A API pode retornar um array ou um objeto único
        const rawEstablishmentData = Array.isArray(establishmentResponse.data) ? establishmentResponse.data[0] : establishmentResponse.data;
        if (rawEstablishmentData) {
          userData.establishment = fromLegacyWire<unknown>(rawEstablishmentData, 'establishment') as Establishment;
        }
      } catch (err: any) {
        console.warn('Não foi possível buscar detalhes do estabelecimento', err);
        // Se der 402, significa que o usuário existe mas está pendente de pagamento
        if (err.response && err.response.status === 402) {
          userData.establishment = {
            id: 0, // ID temporário
            tradeName: 'Pagamento Pendente',
            status: 'PENDING_PAYMENT'
          };
        }
      }

      setUser(userData);
    } catch (error) {
      console.error('Error fetching user profile', error);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('tozzo_token');
      if (token) {
        setIsAuthenticated(true);
        await refreshUserProfile();
      }
      setIsLoading(false);
    };

    initAuth();

    const handleLogout = () => {
      setIsAuthenticated(false);
      setUser(null);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const login = async (token: string) => {
    localStorage.setItem('tozzo_token', token);
    setIsAuthenticated(true);
    setIsLoading(true);
    await refreshUserProfile();
    setIsLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('tozzo_token');
    setIsAuthenticated(false);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
