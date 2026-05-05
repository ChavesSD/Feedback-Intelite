import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { AuthProvider, useAuth } from './context/AuthContext';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Erro não tratado na UI:', error);
  }

  private resetSession = () => {
    localStorage.removeItem('logged_user');
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-8">
            <h1 className="text-2xl font-black uppercase tracking-tight">
              Algo deu <span className="text-blue-500">errado</span>
            </h1>
            <p className="text-sm text-gray-400 mt-3">
              Sua sessão pode ter expirado ou ocorreu um erro inesperado. Clique abaixo para limpar a sessão e entrar novamente.
            </p>
            <button
              onClick={this.resetSession}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all"
            >
              Recarregar e ir para login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/dashboard" 
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } 
            />
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
