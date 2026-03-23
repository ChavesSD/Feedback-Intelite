import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const { login, theme } = useAuth();
  const navigate = useNavigate();

  const primaryLogoSrc = useMemo(() => {
    const raw =
      theme === 'light'
        ? '/Logo para tema claro.png'
        : '/Logo para tema escuro.png';
    return encodeURI(raw);
  }, [theme]);

  const fallbackLogoSrc = useMemo(() => {
    const raw =
      theme === 'light'
        ? '/Logo para tema claro.png'
        : '/Logo para tema escuro.png';
    return encodeURI(raw);
  }, [theme]);

  const [logoSrc, setLogoSrc] = useState(primaryLogoSrc);

  useEffect(() => {
    setLogoFailed(false);
    setLogoSrc(primaryLogoSrc);
  }, [theme]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 font-sans">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl p-8 backdrop-blur-sm">
          <div className="flex flex-col items-center mb-10">
            <div className="mb-6 flex justify-center">
              {logoFailed ? (
                <div className="h-12 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-white font-black tracking-tight">Intelite</span>
                </div>
              ) : (
                <img
                  src={logoSrc}
                  alt="Intelite"
                  className="h-12 w-auto object-contain"
                  onError={() => {
                    if (logoSrc === primaryLogoSrc) {
                      setLogoSrc(fallbackLogoSrc);
                      return;
                    }
                    setLogoFailed(true);
                  }}
                />
              )}
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Team Feedback</h1>
            <p className="text-gray-400 mt-3 text-center text-sm leading-relaxed">
              Gestão de Feedback para Equipes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">
                Usuário
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-white transition-all placeholder:text-gray-600"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Seu usuário"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">
                Senha
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-white transition-all placeholder:text-gray-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Entrar
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">
              Ambiente Seguro • Criptografia Ativa
            </p>
          </div>
        </div>
        
        <p className="text-center mt-8 text-gray-600 text-xs tracking-widest uppercase">
          &copy; 2026 Feedback System • Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;
