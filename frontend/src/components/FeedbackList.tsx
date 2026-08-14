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
  const { users, user, apiFetchJson } = useAuth();
  const [filter, setFilter] = React.useState<'Todos' | 'Suporte' | 'Comercial' | 'RH' | 'Geral'>('Todos');

  const filteredFeedbacks = filter === 'Todos' 
    ? feedbacks 
    : feedbacks.filter(f => f.receiverSector === filter);

  const handleDelete = async (feedbackId: string) => {
    if (!user?._id) return;
    const ok = window.confirm('Deseja excluir este feedback enviado?');
    if (!ok) return;

    try {
      const { response, data } = await apiFetchJson<any>(`/feedbacks/${feedbackId}`, { method: 'DELETE' });

      if (!response.ok) {
        alert((data as any)?.message || 'Não foi possível excluir o feedback.');
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
        <div className="w-8 h-8 border-4 border-indigo-400/30 border-t-indigo-300 rounded-full animate-spin"></div>
        <p className="text-gray-500 text-sm font-medium animate-pulse">Carregando feedbacks...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
      <div className="px-6 py-5 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2 rounded-lg">
            <MessageSquare className="w-5 h-5 text-indigo-300" />
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
                  ? 'bg-indigo-500 border-indigo-400 text-white' 
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
                    ? 'bg-emerald-500/[0.06] border-emerald-400/20 hover:bg-emerald-500/[0.09]' 
                    : feedback.type === 'negative'
                    ? 'bg-rose-500/[0.06] border-rose-400/20 hover:bg-rose-500/[0.09]'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                      feedback.type === 'positive'
                        ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300'
                        : feedback.type === 'negative'
                        ? 'bg-rose-500/10 border-rose-400/20 text-rose-300'
                        : 'bg-white/5 border-white/10 text-zinc-400'
                    }`}>
                      {feedback.type === 'positive' ? <ThumbsUp className="w-5 h-5" /> : 
                       feedback.type === 'negative' ? <ThumbsDown className="w-5 h-5" /> : 
                       <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white group-hover:text-zinc-200 transition-colors">
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
                          feedback.receiverSector === 'Suporte' ? 'bg-indigo-500/10 text-indigo-300' :
                          feedback.receiverSector === 'Comercial' ? 'bg-amber-400/10 text-amber-300' :
                          feedback.receiverSector === 'RH' ? 'bg-violet-500/10 text-violet-300' :
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
                    <div className="flex items-center gap-1 bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-lg">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-black text-amber-300">
                        {feedback.rating.toFixed(1)}
                      </span>
                    </div>
                  )}

                  {feedback.type === 'positive' && (
                    <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded border border-emerald-400/20">
                      Positivo
                    </span>
                  )}

                  {feedback.type === 'negative' && (
                    <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest bg-rose-500/10 px-2 py-1 rounded border border-rose-400/20">
                      Negativo
                    </span>
                  )}

                  {(mode === 'sent' || (mode === 'received' && feedback.receiverId === user?._id)) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(feedback._id)}
                      className="ml-3 p-2 rounded-xl border border-white/10 bg-white/[0.02] text-gray-500 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all"
                      title="Excluir feedback"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="relative">
                  <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-full ${
                    feedback.type === 'positive' ? 'bg-emerald-400/70' : 
                    feedback.type === 'negative' ? 'bg-rose-400/70' : 
                    'bg-indigo-400/40'
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
