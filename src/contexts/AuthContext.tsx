import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface Establishment {
  id: number;
  nomeFantasia: string;
  status: 'ATIVO' | 'PENDENTE_PAGAMENTO' | 'INATIVO';
}

interface User {
  id: number;
  nome: string;
  email: string;
  estabelecimento?: Establishment;
}

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
        const decoded = JSON.parse(jsonPayload);
        
        userData = {
          id: decoded.id || decoded.sub,
          nome: decoded.nome || decoded.name || 'Usuário',
          email: decoded.email || '',
          estabelecimento: undefined
        };

        try {
          const userResponse = await api.get('/usuarios/me');
          if (userResponse.data) {
            userData.nome = userResponse.data.nome || userData.nome;
            userData.email = userResponse.data.email || userData.email;
          }
        } catch (error) {
          console.warn('Não foi possível buscar dados detalhados do usuário', error);
        }
      } catch (e) {
        console.error('Erro ao decodificar token', e);
      }

      if (!userData) return;

      try {
        const estResponse = await api.get('/estabelecimentos');
        // A API pode retornar um array ou um objeto único
        const estData = Array.isArray(estResponse.data) ? estResponse.data[0] : estResponse.data;
        if (estData) {
          userData.estabelecimento = estData;
        }
      } catch (err: any) {
        console.warn('Não foi possível buscar detalhes do estabelecimento', err);
        // Se der 402, significa que o usuário existe mas está pendente de pagamento
        if (err.response && err.response.status === 402) {
          userData.estabelecimento = {
            id: 0, // ID temporário
            nomeFantasia: 'Pagamento Pendente',
            status: 'PENDENTE_PAGAMENTO'
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
