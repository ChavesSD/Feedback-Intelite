import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../context/AuthContext';
import { MessageSquare, RefreshCw, Power, QrCode, CheckCircle2, AlertCircle, Smartphone, Send, Bell, Clock, X } from 'lucide-react';

interface InstanceInfo {
  instanceName: string;
  status: 'open' | 'close' | 'connecting';
  owner?: string;
  profileName?: string;
  profilePictureUrl?: string;
}

interface MessageTemplates {
  welcome: string;
  feedback: string;
  reminder: string;
}

const WhatsAppIntegration = () => {
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MessageTemplates | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [activeTemplateKey, setActiveTemplateKey] = useState<keyof MessageTemplates | null>(null);
  const [templateDraft, setTemplateDraft] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [lastQrTs, setLastQrTs] = useState<number | null>(null);
  const qrFetchingRef = useRef(false);
  const lastQrTsRef = useRef<number | null>(null);

  const fetchInstanceStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/whatsapp/status`);
      const data = await response.json();
      
      if (response.ok) {
        setInstance(data.instance);
        // Não limpar o QR durante estados intermediários (ex.: connecting)
        if (data.instance.status === 'close' || data.instance.status === 'connecting') {
          fetchQrCode();
        } else if (data.instance.status === 'open') {
          setQrCode(null);
        }
      } else {
        setError(data.message || 'Erro ao carregar status do WhatsApp');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQrCode = async () => {
    try {
      const now = Date.now();
      if (qrFetchingRef.current) return;
      if (lastQrTsRef.current && now - lastQrTsRef.current < 45000) return;
      qrFetchingRef.current = true;
      const response = await fetch(`${API_URL}/whatsapp/qrcode`);
      const data = await response.json();
      if (response.ok) {
        // Suporte a diferentes formatos de resposta da Evolution API
        const code = data.base64 || data.qrcode?.base64 || data.code;
        if (code) {
          setQrCode(code.startsWith('data:') ? code : `data:image/png;base64,${code}`);
          const ts = Date.now();
          lastQrTsRef.current = ts;
          setLastQrTs(ts);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar QR Code:', err);
    } finally {
      qrFetchingRef.current = false;
    }
  };

  const handleRestart = async () => {
    try {
      setLoading(true);
      await fetch(`${API_URL}/whatsapp/restart`, { method: 'POST' });
      setTimeout(fetchInstanceStatus, 3000);
    } catch (err) {
      setError('Erro ao reiniciar instância');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/whatsapp/disconnect`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Erro ao desconectar instância');
      }
      setQrCode(null);
      lastQrTsRef.current = null;
      setLastQrTs(null);
      setTimeout(fetchInstanceStatus, 2000);
    } catch (err) {
      setError('Erro ao desconectar instância');
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_URL}/whatsapp/templates`);
      const data = await response.json();
      if (response.ok) {
        setTemplates(data);
      }
    } catch (err) {
      console.error('Erro ao buscar templates:', err);
    }
  };

  const openTemplateModal = (key: keyof MessageTemplates) => {
    setActiveTemplateKey(key);
    setTemplateDraft(templates?.[key] || '');
    setTemplateModalOpen(true);
  };

  const saveTemplate = async () => {
    if (!activeTemplateKey) return;
    try {
      setSavingTemplate(true);
      const response = await fetch(`${API_URL}/whatsapp/templates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [activeTemplateKey]: templateDraft })
      });
      const data = await response.json();
      if (response.ok) {
        setTemplates(data);
        setTemplateModalOpen(false);
      }
    } catch (err) {
      console.error('Erro ao salvar template:', err);
    } finally {
      setSavingTemplate(false);
    }
  };

  useEffect(() => {
    fetchInstanceStatus();
    fetchTemplates();
    const statusInterval = setInterval(() => {
      if (instance?.status !== 'open') {
        fetchInstanceStatus();
      }
    }, 15000);
    const qrInterval = setInterval(() => {
      if (instance?.status !== 'open') {
        const nearExpire = !lastQrTsRef.current || (Date.now() - lastQrTsRef.current > 45000);
        if (nearExpire) {
          fetchQrCode();
        }
      }
    }, 40000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(qrInterval);
    };
  }, [instance?.status, lastQrTs]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-green-500/10 p-2 rounded-lg">
            <MessageSquare className="w-5 h-5 text-green-500" />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">WhatsApp <span className="text-green-500">Integração</span></h2>
        </div>
        <button 
          onClick={fetchInstanceStatus}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> ATUALIZAR STATUS
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Status Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-green-500/5 blur-3xl rounded-full"></div>
            
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-green-500" />
              Status da Instância
            </h3>

            {loading && !instance ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 opacity-50" />
                <p className="text-sm text-gray-500">{error}</p>
                <button onClick={fetchInstanceStatus} className="text-xs font-bold text-green-500 hover:underline">Tentar novamente</button>
              </div>
            ) : instance ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nome</span>
                  <span className="text-sm font-black text-white">{instance.instanceName}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Conexão</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${instance.status === 'open' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                    <span className={`text-xs font-black uppercase tracking-widest ${instance.status === 'open' ? 'text-green-500' : 'text-red-500'}`}>
                      {instance.status === 'open' ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                </div>

                {instance.status === 'open' && instance.profileName && (
                  <div className="flex items-center gap-4 p-4 bg-green-500/5 border border-green-500/10 rounded-2xl animate-in zoom-in duration-300">
                    <div className="w-12 h-12 rounded-xl bg-black overflow-hidden border border-white/10">
                      {instance.profilePictureUrl ? (
                        <img src={instance.profilePictureUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-green-500">
                          <MessageSquare className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">{instance.profileName}</p>
                      <p className="text-[10px] font-bold text-gray-500">{instance.owner}</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                  </div>
                )}

                <button 
                  onClick={handleRestart}
                  className="w-full py-4 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 rounded-2xl text-xs font-black text-gray-400 hover:text-red-500 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  <Power className="w-4 h-4" /> Reiniciar Instância
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={loading || instance.status !== 'open'}
                  className="w-full py-4 bg-white/5 hover:bg-red-600/15 border border-white/10 hover:border-red-500/40 rounded-2xl text-xs font-black text-gray-400 hover:text-red-400 transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" /> Desconectar Instância
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* QR Code Card */}
        <div className="lg:col-span-7">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 h-full flex flex-col items-center justify-center relative overflow-hidden">
             <div className="absolute -left-10 -top-10 w-40 h-40 bg-blue-500/5 blur-3xl rounded-full"></div>
             
             {instance?.status === 'open' ? (
               <div className="text-center space-y-6 animate-in zoom-in duration-500">
                 <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20">
                   <CheckCircle2 className="w-12 h-12 text-green-500" />
                 </div>
                 <div>
                   <h4 className="text-xl font-black text-white uppercase">Sincronizado!</h4>
                   <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto leading-relaxed">
                     Sua instância está ativa e pronta para enviar notificações automáticas via Evolution API.
                   </p>
                 </div>
               </div>
             ) : qrCode ? (
               <div className="text-center space-y-8 animate-in fade-in duration-500">
                 <div className="space-y-2">
                   <h4 className="text-xl font-black text-white uppercase flex items-center justify-center gap-2">
                     <QrCode className="w-6 h-6 text-green-500" /> Conectar WhatsApp
                   </h4>
                   <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Aponte a câmera para o QR Code abaixo</p>
                 </div>
                 
                 <div className="p-4 bg-white rounded-3xl shadow-2xl shadow-green-500/10 inline-block border-8 border-white">
                   <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                 </div>

                 <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">O QR Code expira a cada 40 segundos</p>
               </div>
             ) : (
               <div className="text-center space-y-4">
                 <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                   <RefreshCw className="w-8 h-8 text-gray-800 animate-spin" />
                 </div>
                 <p className="text-gray-500 text-sm italic font-medium">Aguardando geração do QR Code...</p>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Mensagens Prontas */}
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/10 p-2 rounded-lg">
            <Bell className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="text-lg font-bold text-white uppercase tracking-tight">Configurações de <span className="text-blue-500">Mensagens</span></h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Mensagem de Bem-Vindo */}
          <button
            type="button"
            onClick={() => openTemplateModal('welcome')}
            className="text-left bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 hover:bg-white/[0.02] transition-all"
          >
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-500/10 p-2 rounded-xl">
                <Send className="w-4 h-4 text-blue-500" />
              </div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider">Bem-Vindo</h4>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              Envia automaticamente a URL do sistema e as credenciais de acesso para o WhatsApp do novo usuário.
            </p>
            <div className="text-[10px] font-bold text-blue-500/50 uppercase tracking-widest border-t border-white/5 pt-4">
              Disponível em: Gerenciar Equipe
            </div>
          </button>

          {/* Mensagem de Feedback */}
          <button
            type="button"
            onClick={() => openTemplateModal('feedback')}
            className="text-left bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-green-500/30 hover:bg-white/[0.02] transition-all"
          >
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-green-500/5 blur-2xl rounded-full"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-500/10 p-2 rounded-xl">
                <MessageSquare className="w-4 h-4 text-green-500" />
              </div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider">Feedback</h4>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              Notifica o colaborador instantaneamente via WhatsApp quando ele recebe uma nova avaliação.
            </p>
            <div className="flex items-center gap-2 text-[10px] font-bold text-green-500 uppercase tracking-widest border-t border-white/5 pt-4">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              Ativo no Sistema
            </div>
          </button>

          {/* Mensagem de Lembrete */}
          <button
            type="button"
            onClick={() => openTemplateModal('reminder')}
            className="text-left bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-purple-500/30 hover:bg-white/[0.02] transition-all"
          >
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-500/5 blur-2xl rounded-full"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-purple-500/10 p-2 rounded-xl">
                <Clock className="w-4 h-4 text-purple-500" />
              </div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider">Lembrete</h4>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              Envia lembrete de reunião para todos os colaboradores toda sexta-feira às 10:00.
            </p>
            <div className="flex items-center gap-2 text-[10px] font-bold text-purple-500 uppercase tracking-widest border-t border-white/5 pt-4">
              <Clock className="w-3 h-3" />
              Sextas às 10h (Agendado)
            </div>
          </button>
        </div>
      </div>

      {templateModalOpen && activeTemplateKey && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in duration-300 my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                Editar <span className="text-green-500">Mensagem</span>
              </h3>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                Variáveis disponíveis
              </p>
              <div className="flex flex-wrap gap-2">
                {(activeTemplateKey === 'welcome'
                  ? ['{name}', '{username}', '{systemUrl}']
                  : activeTemplateKey === 'feedback'
                    ? ['{name}', '{type}', '{content}', '{systemUrl}']
                    : ['{meetingTime}', '{systemUrl}']
                ).map((v) => (
                  <span key={v} className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">
                    {v}
                  </span>
                ))}
              </div>
            </div>

            <textarea
              className="w-full min-h-[220px] px-5 py-4 bg-black border border-white/10 rounded-2xl focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none text-white transition-all placeholder:text-gray-700 resize-none"
              value={templateDraft}
              onChange={(e) => setTemplateDraft(e.target.value)}
            />

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingTemplate}
                onClick={saveTemplate}
                className="px-5 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black transition-all disabled:opacity-50"
              >
                {savingTemplate ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppIntegration;
