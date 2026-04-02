import React from 'react';
import { MessageSquare, Star, User, Calendar, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface Feedback {
  _id: string;
  senderId?: string;
  senderName: string;
  receiverId: string;
  receiverSector: string;
  content: string;
  rating: number;
  date: string;
  isAnonymous: boolean;
  type?: 'positive' | 'negative' | 'neutral';
  attachment?: string;
}

interface FeedbackListProps {
  feedbacks: Feedback[];
  loading?: boolean;
  mode?: 'received' | 'sent';
  onDeleted?: () => void;
}

const FeedbackList: React.FC<FeedbackListProps> = ({ feedbacks, loading, mode = 'received', onDeleted }) => {
  const { users, user, token } = useAuth();
  const [filter, setFilter] = React.useState<'Todos' | 'Suporte' | 'Comercial' | 'RH' | 'Geral'>('Todos');

  const filteredFeedbacks = filter === 'Todos' 
    ? feedbacks 
    : feedbacks.filter(f => f.receiverSector === filter);

  const handleDelete = async (feedbackId: string) => {
    if (!user?._id) return;
    const ok = window.confirm('Deseja excluir este feedback enviado?');
    if (!ok) return;

    try {
      const response = await fetch(`/api/feedbacks/${feedbackId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.message || 'Não foi possível excluir o feedback.');
        return;
      }

      onDeleted?.();
    } catch {
      alert('Erro ao excluir feedback.');
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-gray-500 text-sm font-medium animate-pulse">Carregando feedbacks...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
      <div className="px-6 py-5 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/10 p-2 rounded-lg">
            <MessageSquare className="w-5 h-5 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-white">{mode === 'sent' ? 'Feedbacks Enviados' : 'Feedbacks Recebidos'}</h2>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
          {(['Todos', 'Suporte', 'Comercial', 'RH', 'Geral'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest transition-all border ${
                filter === s 
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                  : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {filteredFeedbacks.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
              <MessageSquare className="w-8 h-8 text-gray-700" />
            </div>
            <p className="text-gray-500 text-sm italic">Nenhum feedback encontrado para esta categoria.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredFeedbacks.map((feedback) => (
              <div 
                key={feedback._id} 
                className={`group relative p-5 border rounded-xl transition-all duration-300 ${
                  feedback.type === 'positive' 
                    ? 'bg-green-500/[0.03] border-green-500/10 hover:bg-green-500/[0.05]' 
                    : feedback.type === 'negative'
                    ? 'bg-red-500/[0.03] border-red-500/10 hover:bg-red-500/[0.05]'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                      feedback.type === 'positive'
                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                        : feedback.type === 'negative'
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : 'bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-white/10 text-blue-400'
                    }`}>
                      {feedback.type === 'positive' ? <ThumbsUp className="w-5 h-5" /> : 
                       feedback.type === 'negative' ? <ThumbsDown className="w-5 h-5" /> : 
                       <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white group-hover:text-blue-400 transition-colors">
                          {mode === 'sent'
                            ? `Para: ${users.find(u => u._id === feedback.receiverId)?.name || 'Usuário'}`
                            : (feedback.isAnonymous ? 'Remetente Anônimo' : feedback.senderName)}
                        </p>
                        {mode === 'sent' && feedback.isAnonymous && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight bg-white/5 text-gray-400 border border-white/10">
                            Anônimo
                          </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${
                          feedback.receiverSector === 'Suporte' ? 'bg-blue-500/10 text-blue-400' :
                          feedback.receiverSector === 'Comercial' ? 'bg-green-500/10 text-green-400' :
                          feedback.receiverSector === 'RH' ? 'bg-pink-500/10 text-pink-400' :
                          'bg-gray-500/10 text-gray-400'
                        }`}>
                          {feedback.receiverSector}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Calendar className="w-3 h-3 text-gray-600" />
                        <p className="text-[10px] text-gray-500 uppercase tracking-tighter font-semibold">
                          {new Date(feedback.date).toLocaleDateString('pt-BR', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {feedback.type === 'neutral' && (
                    <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg shadow-inner">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm font-black text-yellow-500">
                        {feedback.rating.toFixed(1)}
                      </span>
                    </div>
                  )}

                  {feedback.type === 'positive' && (
                    <span className="text-[10px] font-black text-green-500 uppercase tracking-widest bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                      Positivo
                    </span>
                  )}

                  {feedback.type === 'negative' && (
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                      Negativo
                    </span>
                  )}

                  {(mode === 'sent' || (mode === 'received' && feedback.receiverId === user?._id)) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(feedback._id)}
                      className="ml-3 p-2 rounded-xl border border-white/10 bg-white/[0.02] text-gray-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all"
                      title="Excluir feedback"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="relative">
                  <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-full ${
                    feedback.type === 'positive' ? 'bg-green-500/30' : 
                    feedback.type === 'negative' ? 'bg-red-500/30' : 
                    'bg-blue-500/30'
                  }`}></div>
                  <p className="text-gray-400 text-sm leading-relaxed pl-4 italic">
                    "{feedback.content}"
                  </p>
                </div>

                {feedback.attachment && (
                  <div className="mt-4 pl-4 border-l border-white/5">
                    <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 max-w-sm">
                      <img 
                        src={feedback.attachment} 
                        alt="Anexo" 
                        className="w-full h-auto object-contain cursor-zoom-in hover:scale-[1.02] transition-transform duration-300"
                        onClick={() => window.open(feedback.attachment, '_blank')}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackList;
