import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export interface User {
  _id: string;
  username: string;
  name: string;
  role: 'employee' | 'supervisor';
  sector: 'Suporte' | 'Comercial' | 'RH' | 'Geral';
  avatar?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  users: User[];
  token: string | null;
  isAuthenticated: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addUser: (userData: { name: string, username: string, sector: string, password?: string, avatar?: string, phone?: string }) => Promise<void>;
  updateUser: (id: string, userData: { name: string, username: string, sector: string, role?: string, password?: string, avatar?: string, phone?: string }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Detectar o IP atual para chamadas de API
export const getApiUrl = () => {
  const { hostname, protocol, port } = window.location;
  
  // Se estiver em produção (Railway), usa a URL relativa ou absoluta do domínio
  if (hostname !== 'localhost' && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return `${protocol}//${hostname}${port ? `:${port}` : ''}/api`;
  }

  // Se estiver no localhost ou IP direto (desenvolvimento), usa a porta 5001
  const baseIp = hostname === 'localhost' ? 'localhost' : hostname;
  return `http://${baseIp}:5001/api`;
};

export const API_URL = getApiUrl();

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('logged_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('app_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    if (user) {
      refreshUsers();
    }
  }, [user]);

  const refreshUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('logged_user', JSON.stringify(data.user));
        localStorage.setItem('auth_token', data.token);
        return true;
      } else {
        const errorData = await response.json();
        const msg = errorData.message || errorData.error || 'Erro ao fazer login';
        console.error('Falha no login:', msg);
        alert(msg);
      }
    } catch (error) {
      console.error('Erro no login:', error);
      alert('Erro ao conectar com o servidor');
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('logged_user');
    localStorage.removeItem('auth_token');
  };

  const addUser = async (userData: { name: string, username: string, sector: string, password?: string, avatar?: string }) => {
    try {
      await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...userData, role: 'employee' }),
      });
      await refreshUsers();
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error);
    }
  };

  const updateUser = async (id: string, userData: { name: string, username: string, sector: string, role?: string, password?: string, avatar?: string }) => {
    try {
      const response = await fetch(`${API_URL}/users/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        // Se o usuário atualizou seu próprio perfil, atualiza o estado local
        if (user && id === user._id) {
          const newUser = { ...user, ...updatedUser };
          setUser(newUser);
          localStorage.setItem('logged_user', JSON.stringify(newUser));
        }
        await refreshUsers();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao atualizar usuário');
      }
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/users/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        await refreshUsers();
      } else {
        const err = await response.json();
        console.error('Erro ao deletar:', err);
      }
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      users, 
      token,
      isAuthenticated: !!user, 
      theme,
      toggleTheme,
      login, 
      logout, 
      addUser, 
      updateUser,
      deleteUser,
      refreshUsers
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
