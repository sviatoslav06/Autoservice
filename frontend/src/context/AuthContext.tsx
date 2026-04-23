import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import api from '../api/axios';

interface User {
  id: number;
  username: string;
  email: string;
  phone?: string | null;
  role: 'Client' | 'Manager' | 'Mechanic' | 'Accountant' | 'Admin';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!token) {
        setUser(null);
        return;
      }

      try {
        const response = await api.get<User>('/auth/me');
        if (active) {
          setUser(response.data);
        }
      } catch {
        if (active) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, [token]);

  const login = (newToken: string, userData: User) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
