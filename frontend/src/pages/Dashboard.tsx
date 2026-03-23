import { useEffect, useState } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import FeedbackList, { type Feedback } from '../components/FeedbackList';
import FeedbackForm from '../components/FeedbackForm';
import UserManagement from '../components/UserManagement';
import DashboardStats from '../components/DashboardStats';
import WhatsAppIntegration from '../components/WhatsAppIntegration';
import { LogOut, User as UserIcon, Info, Users, MessageSquare, BarChart3, Settings, Key, Image as ImageIcon, X, Save, Sun, Moon, Menu, Smartphone } from 'lucide-react';

const Dashboard = () => {
  const { user, users, logout, updateUser, theme, toggleTheme } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [activeTab, setActiveTab] = useState<'feedbacks' | 'management' | 'stats' | 'whatsapp'>('stats');
  const [loading, setLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  // Profile Update State
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileAvatar, setProfileAvatar] = useState(user?.avatar || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileAvatar(user.avatar || '');
      setProfilePhone(user.phone || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setIsUpdatingProfile(true);
      await updateUser(user._id, {
        name: profileName,
        username: user.username,
        sector: user.sector,
        avatar: profileAvatar,
        phone: profilePhone,
        password: profilePassword || undefined
      });
      alert('Perfil atualizado com sucesso!');
      setIsProfileModalOpen(false);
      setProfilePassword('');
    } catch (error: any) {
      alert(error.message || 'Erro ao atualizar perfil');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const fetchFeedbacks = async () => {
    if (!user) return;
    try {
      // Busca feedbacks onde o receptor é o ID do usuário logado
      const response = await fetch(`${API_URL}/feedbacks/${user._id}`);
      const data = await response.json();
      setFeedbacks(data);
    } catch (error) {
      console.error('Erro ao buscar feedbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [user]);

  const handleSendFeedback = async (content: string, rating: number, isAnonymous: boolean, type: 'positive' | 'negative' | 'neutral' = 'neutral', attachment?: string | null) => {
    try {
      // Encontrar o supervisor do mesmo setor do usuário
      const supervisor = users.find(u => u.role === 'supervisor' && u.sector === user?.sector);
      const receiverId = supervisor ? supervisor._id : user?._id; // Fallback para si mesmo se não achar supervisor (não deve ocorrer)

      const response = await fetch(`${API_URL}/feedbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user?._id,
          senderName: user?.name,
          receiverId: receiverId,
          content,
          rating,
          isAnonymous,
          type,
          attachment
        }),
      });

      if (response.ok) {
        fetchFeedbacks();
      }
    } catch (error) {
      console.error('Erro ao enviar feedback:', error);
    }
  };

  const isSupervisor = user?.role === 'supervisor';

  // Performance Insight calculations
  const positiveFeedbacks = feedbacks.filter(f => f.type === 'positive').length;
  const negativeFeedbacks = feedbacks.filter(f => f.type === 'negative').length;
  const totalTypedFeedbacks = positiveFeedbacks + negativeFeedbacks;
  
  // Calculate average based on positive (5 stars) and negative (1 star)
  // Formula: ((pos * 5) + (neg * 1)) / (pos + neg)
  const performanceAverage = totalTypedFeedbacks > 0 
    ? (((positiveFeedbacks * 5) + (negativeFeedbacks * 1)) / totalTypedFeedbacks).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30 flex flex-col md:flex-row">
      {/* Sidebar Navigation (Desktop) */}
      <aside className={`fixed left-0 top-0 h-full hidden md:flex flex-col py-8 border-r border-white/5 bg-[#050505] z-20 transition-all duration-300 ${isSidebarExpanded ? 'w-64 px-6' : 'w-20 items-center'}`}>
        <button 
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className={`p-3 rounded-xl hover:bg-white/5 transition-all mb-10 text-gray-400 hover:text-white ${!isSidebarExpanded ? 'mx-auto' : ''}`}
        >
          <Menu className="w-6 h-6" />
        </button>

        <nav className="flex flex-col gap-4 flex-1 w-full">
          <button 
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-4 transition-all p-3 rounded-xl w-full ${!isSidebarExpanded ? 'justify-center' : ''} ${activeTab === 'stats' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            title="Dashboard"
          >
            <BarChart3 className="w-6 h-6 shrink-0" />
            {isSidebarExpanded && <span className="font-bold text-sm">Dashboard</span>}
          </button>

          <button 
            onClick={() => setActiveTab('feedbacks')}
            className={`flex items-center gap-4 transition-all p-3 rounded-xl w-full ${!isSidebarExpanded ? 'justify-center' : ''} ${activeTab === 'feedbacks' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            title="Feedbacks"
          >
            <MessageSquare className="w-6 h-6 shrink-0" />
            {isSidebarExpanded && <span className="font-bold text-sm">Feedbacks</span>}
          </button>
          
          {isSupervisor && (
            <button 
              onClick={() => setActiveTab('management')}
              className={`flex items-center gap-4 transition-all p-3 rounded-xl w-full ${!isSidebarExpanded ? 'justify-center' : ''} ${activeTab === 'management' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
              title="Gerenciar Equipe"
            >
              <Users className="w-6 h-6 shrink-0" />
              {isSidebarExpanded && <span className="font-bold text-sm">Gerenciar Equipe</span>}
            </button>
          )}

          {user?.username === 'deyvison@intelite.com' && (
            <button 
              onClick={() => setActiveTab('whatsapp')}
              className={`flex items-center gap-4 transition-all p-3 rounded-xl w-full ${!isSidebarExpanded ? 'justify-center' : ''} ${activeTab === 'whatsapp' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
              title="WhatsApp"
            >
              <Smartphone className="w-6 h-6 shrink-0" />
              {isSidebarExpanded && <span className="font-bold text-sm">WhatsApp</span>}
            </button>
          )}
        </nav>

        <button 
          onClick={logout}
          className={`flex items-center gap-4 text-red-500/70 hover:text-red-500 transition-all p-3 rounded-xl mt-auto w-full hover:bg-red-500/5 ${!isSidebarExpanded ? 'justify-center' : ''}`}
          title="Sair"
        >
          <LogOut className="w-6 h-6 shrink-0" />
          {isSidebarExpanded && <span className="font-bold text-sm">Sair</span>}
        </button>
      </aside>

      {/* Main Content Area */}
      <div className={`transition-all duration-300 min-h-screen flex flex-col flex-1 ${isSidebarExpanded ? 'md:ml-64' : 'md:ml-20'}`}>
        {/* Header */}
        <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/5 px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-white uppercase">
              {(activeTab === 'stats' ? 'Dashboard' : activeTab === 'management' ? 'Gerenciar Equipe' : activeTab === 'whatsapp' ? 'WhatsApp' : 'Feedbacks')} <span className="text-blue-500">Overview</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-0.5">
              Performance & Team Insights
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-white">{user?.name}</span>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                {isSupervisor ? 'Core Management' : `${user?.sector} Team`}
              </span>
            </div>
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 p-[1px] hover:scale-105 transition-transform group relative"
              title="Meu Perfil"
            >
              <div className="w-full h-full rounded-2xl bg-black flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-6 h-6 text-white/80" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-lg p-1 border border-black group-hover:bg-blue-500 transition-colors">
                <Settings className="w-3 h-3 text-white" />
              </div>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'feedbacks' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              {/* Left Column: Feedback List */}
              <div className="xl:col-span-8 order-2 xl:order-1">
                <FeedbackList feedbacks={feedbacks} loading={loading} />
              </div>
              
              {/* Right Column: Feedback Form */}
              <div className="xl:col-span-4 order-1 xl:order-2">
                {!isSupervisor && (
                  <FeedbackForm onSend={handleSendFeedback} />
                )}
                
                {isSupervisor && (
                  <div className="bg-gradient-to-br from-purple-600/10 to-transparent border border-purple-500/20 rounded-3xl p-8 relative overflow-hidden group">
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-purple-500/10 blur-3xl rounded-full group-hover:bg-purple-500/20 transition-all"></div>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-500" />
                      Visão do Gestor
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6">
                      Como supervisor, você pode gerenciar sua equipe e acompanhar a satisfação geral. 
                      A transparência e o anonimato garantem a saúde da cultura da empresa.
                    </p>
                    <button 
                      onClick={() => setActiveTab('management')}
                      className="w-full py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-400 font-bold transition-all text-sm uppercase tracking-widest"
                    >
                      Gerenciar Usuários
                    </button>
                  </div>
                )}

                <div className="bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-3xl p-8 relative overflow-hidden group">
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/10 blur-3xl rounded-full group-hover:bg-blue-500/20 transition-all"></div>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-500" />
                    Performance Insight
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-6">
                    Mantenha a constância nos feedbacks. A sinceridade impulsiona mudanças reais.
                  </p>
                  <div className="flex gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex-1">
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Positivos</p>
                      <p className="text-xl font-black text-green-500">{positiveFeedbacks}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex-1">
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Negativos</p>
                      <p className="text-xl font-black text-red-500">{negativeFeedbacks}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex-1">
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Média</p>
                      <p className="text-xl font-black text-blue-500">{performanceAverage}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="animate-in fade-in duration-500">
              <DashboardStats />
            </div>
          )}

          {activeTab === 'management' && isSupervisor && (
            <div className="h-[calc(100vh-200px)] min-h-[600px] animate-in fade-in duration-500">
              <UserManagement />
            </div>
          )}

          {activeTab === 'whatsapp' && user?.username === 'deyvison@intelite.com' && (
            <div className="animate-in fade-in duration-500">
              <WhatsAppIntegration />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#050505] border-t border-white/5 px-6 py-3 flex justify-around items-center z-20 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('stats')}
          className={`flex flex-col items-center gap-1 shrink-0 ${activeTab === 'stats' ? 'text-blue-500' : 'text-gray-500'}`}
        >
          <BarChart3 className="w-6 h-6" />
          <span className="text-[10px] font-bold">Dashboard</span>
        </button>

        <button 
          onClick={() => setActiveTab('feedbacks')}
          className={`flex flex-col items-center gap-1 shrink-0 ${activeTab === 'feedbacks' ? 'text-blue-500' : 'text-gray-500'}`}
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-[10px] font-bold">Feedbacks</span>
        </button>
        
        {isSupervisor && (
          <button 
            onClick={() => setActiveTab('management')}
            className={`flex flex-col items-center gap-1 shrink-0 ${activeTab === 'management' ? 'text-blue-500' : 'text-gray-500'}`}
          >
            <Users className="w-6 h-6" />
            <span className="text-[10px] font-bold">Equipe</span>
          </button>
        )}

        {user?.username === 'deyvison@intelite.com' && (
          <button 
            onClick={() => setActiveTab('whatsapp')}
            className={`flex flex-col items-center gap-1 shrink-0 ${activeTab === 'whatsapp' ? 'text-green-500' : 'text-gray-500'}`}
          >
            <Smartphone className="w-6 h-6" />
            <span className="text-[10px] font-bold">WhatsApp</span>
          </button>
        )}

        <button 
          onClick={() => setIsProfileModalOpen(true)}
          className={`flex flex-col items-center gap-1 shrink-0 ${isProfileModalOpen ? 'text-blue-500' : 'text-gray-500'}`}
        >
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-bold">Perfil</span>
        </button>

        <button 
          onClick={logout}
          className="flex flex-col items-center gap-1 shrink-0 text-red-500/70"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-[10px] font-bold">Sair</span>
        </button>
      </nav>

      {/* Background Glows */}
      <div className={`fixed top-0 right-0 w-[500px] h-[500px] blur-[150px] pointer-events-none -z-10 transition-colors duration-500 ${theme === 'dark' ? 'bg-blue-600/5' : 'bg-blue-500/30'}`}></div>
      <div className={`fixed bottom-0 left-0 w-[500px] h-[500px] blur-[150px] pointer-events-none -z-10 transition-colors duration-500 ${theme === 'dark' ? 'bg-purple-600/5' : 'bg-purple-400/30'}`}></div>

      {/* Profile Update Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Meu <span className="text-blue-500">Perfil</span></h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-600 to-purple-600 p-[1px] mb-4">
                  <div className="w-full h-full rounded-3xl bg-black flex items-center justify-center overflow-hidden">
                    {profileAvatar ? (
                      <img src={profileAvatar} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-10 h-10 text-white/20" />
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Prévia do Avatar</p>
              </div>

              <div className="space-y-4">
                <div className="relative group">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    required 
                    placeholder="Nome Completo" 
                    className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all" 
                    value={profileName} 
                    onChange={(e) => setProfileName(e.target.value)} 
                  />
                </div>

                <div className="relative group">
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="url" 
                    placeholder="URL da Foto de Perfil" 
                    className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all" 
                    value={profileAvatar} 
                    onChange={(e) => setProfileAvatar(e.target.value)} 
                  />
                </div>

                <div className="relative group">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="WhatsApp (ex: 5511999999999)" 
                    className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all" 
                    value={profilePhone} 
                    onChange={(e) => setProfilePhone(e.target.value)} 
                  />
                </div>

                <div className="relative group">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="password" 
                    placeholder="Nova Senha (deixe em branco para manter)" 
                    className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all" 
                    value={profilePassword} 
                    onChange={(e) => setProfilePassword(e.target.value)} 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isUpdatingProfile} 
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-900/20"
              >
                {isUpdatingProfile ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <><Save className="w-4 h-4" /> Salvar Alterações</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
