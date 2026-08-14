import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export interface User {
  _id: string;
  username: string;
  name: string;
  role: 'employee' | 'supervisor';
  sector: 'Suporte' | 'Comercial' | 'RH' | 'Geral';
  avatar?: string;
  skills?: {
    atendimento?: number;
    proatividade?: number;
    tratamento?: number;
    agilidade?: number;
    dificuldade?: number;
  };
  resolutionRate?: number;
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
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  apiFetchJson: <T = unknown>(path: string, init?: RequestInit) => Promise<{ response: Response; data: T | null }>;
  addUser: (userData: { name: string, username: string, sector: string, password?: string, avatar?: string }) => Promise<void>;
  updateUser: (id: string, userData: { name: string, username: string, sector: string, role?: string, password?: string, avatar?: string, skills?: User['skills'], resolutionRate?: number }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const base64UrlToString = (value: string) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  try {
    return decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
  } catch {
    return '';
  }
};

const getJwtExpMs = (token: string) => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payloadStr = base64UrlToString(parts[1]);
  if (!payloadStr) return null;
  try {
    const payload = JSON.parse(payloadStr) as { exp?: number };
    if (!payload?.exp) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
};

const isJwtExpired = (token: string, skewMs: number = 30_000) => {
  const expMs = getJwtExpMs(token);
  if (!expMs) return true;
  return Date.now() >= expMs - skewMs;
};

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

const resolveApiUrl = (path: string) => {
  const trimmed = path.trim();
  if (!trimmed) return API_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${API_URL}${trimmed}`;
  return `${API_URL}/${trimmed}`;
};

const safeJsonParse = <T,>(text: string): T | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken && isJwtExpired(storedToken)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('logged_user');
      return null;
    }
    return storedToken;
  });
  const [user, setUser] = useState<User | null>(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken && isJwtExpired(storedToken)) return null;
    const savedUser = localStorage.getItem('logged_user');
    if (!savedUser) return null;
    try {
      return JSON.parse(savedUser) as User;
    } catch {
      localStorage.removeItem('logged_user');
      return null;
    }
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

  const logout = () => {
    setUser(null);
    setUsers([]);
    setToken(null);
    localStorage.removeItem('logged_user');
    localStorage.removeItem('auth_token');
  };

  const apiFetch = async (path: string, init?: RequestInit) => {
    const url = resolveApiUrl(path);
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(url, { ...init, headers });
    if (response.status === 401) {
      logout();
    }
    return response;
  };

  const apiFetchJson = async <T,>(path: string, init?: RequestInit) => {
    const response = await apiFetch(path, init);
    if (response.status === 204) return { response, data: null };
    const text = await response.text();
    const data = safeJsonParse<T>(text);
    return { response, data };
  };

  useEffect(() => {
    if (!token) return;
    if (isJwtExpired(token)) logout();
  }, [token]);

  useEffect(() => {
    if (user && token) {
      refreshUsers();
    }
  }, [user, token]);

  const refreshUsers = async () => {
    try {
      if (!token) return;
      const path = user?.role === 'supervisor' ? '/users' : '/users/public';
      const { response, data } = await apiFetchJson<User[]>(path);
      if (!response.ok) {
        setUsers([]);
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setUsers(list);

      if (user) {
        const self = list.find((u) => u._id === user._id);
        if (self) {
          const prevSkills = user.skills ?? {};
          const nextSkills = self.skills ?? {};
          const keys: (keyof NonNullable<User['skills']>)[] = ['atendimento', 'proatividade', 'tratamento', 'agilidade', 'dificuldade'];
          const skillsChanged = keys.some((k) => (prevSkills as any)[k] !== (nextSkills as any)[k]);
          const resolutionChanged = user.resolutionRate !== self.resolutionRate;

          if (skillsChanged || resolutionChanged) {
            const merged = { ...user, skills: nextSkills, resolutionRate: self.resolutionRate };
            setUser(merged);
            localStorage.setItem('logged_user', JSON.stringify(merged));
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      setUsers([]);
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

  const addUser = async (userData: { name: string, username: string, sector: string, password?: string, avatar?: string }) => {
    try {
      const response = await apiFetch('/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        } as HeadersInit,
        body: JSON.stringify({ ...userData, role: 'employee' }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erro ao adicionar usuário');
      }
      await refreshUsers();
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error);
      throw error;
    }
  };

  const updateUser = async (id: string, userData: { name: string, username: string, sector: string, role?: string, password?: string, avatar?: string, skills?: User['skills'], resolutionRate?: number }) => {
    try {
      const response = await apiFetch(`/users/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        } as HeadersInit,
        body: JSON.stringify(userData),
      });

      if (response.status === 401) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
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
      const response = await apiFetch(`/users/${id}`, { 
        method: 'DELETE',
      });
      
      if (response.ok) {
        await refreshUsers();
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao deletar usuário');
      }
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      users, 
      token,
      isAuthenticated: !!user && !!token, 
      theme,
      toggleTheme,
      login, 
      logout, 
      apiFetch,
      apiFetchJson,
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
