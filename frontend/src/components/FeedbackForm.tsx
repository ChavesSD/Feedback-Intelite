import React, { useState } from 'react';
import { Send, Info, ThumbsUp, ThumbsDown, Paperclip, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface FeedbackFormProps {
  onSend: (receiverId: string, content: string, rating: number, isAnonymous: boolean, type: 'positive' | 'negative', attachment?: string | null) => void;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ onSend }) => {
  const { users, user } = useAuth();
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [selectedType, setSelectedType] = useState<'positive' | 'negative'>('positive');
  const [receiverId, setReceiverId] = useState('');

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setAttachment(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachment(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content && receiverId) {
      const finalRating = selectedType === 'positive' ? 5 : 1;
      onSend(receiverId, content, finalRating, isAnonymous, selectedType, attachment);
      setContent('');
      setAttachment(null);
      setSelectedType('positive');
    }
  };

  const availableRecipients = users.filter(u => u._id !== user?._id);

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
      <div className="px-6 py-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          <div className="bg-green-500/10 p-2 rounded-lg">
            <Send className="w-5 h-5 text-green-500" />
          </div>
          Enviar Feedback
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        <div className="space-y-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">
            Enviar para
          </label>
          <select
            required
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none transition-all"
          >
            <option value="" disabled style={{ backgroundColor: '#0a0a0a', color: '#ffffff' }}>
              Selecione um usuário
            </option>
            {availableRecipients.length === 0 ? (
              <option value="" disabled style={{ backgroundColor: '#0a0a0a', color: '#ffffff' }}>
                Nenhum usuário disponível
              </option>
            ) : (
              availableRecipients.map((u) => (
                <option key={u._id} value={u._id} style={{ backgroundColor: '#0a0a0a', color: '#ffffff' }}>
                  {u.name} • {u.role === 'supervisor' ? 'Supervisor' : 'Funcionário'} • {u.sector}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">
            Seu Feedback
          </label>
          <div className="relative group">
            <textarea
              required
              className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none text-white transition-all placeholder:text-gray-700 min-h-[160px] resize-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              placeholder="Descreva sua experiência ou sugestão construtiva... (Você também pode colar uma imagem aqui)"
            />
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <label className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg cursor-pointer transition-all border border-white/5" title="Anexar Imagem">
                <Paperclip className="w-4 h-4" />
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
            <div className="absolute bottom-4 right-4 text-[10px] text-gray-600 font-mono">
              {content.length} caracteres
            </div>
          </div>
        </div>

        {attachment && (
          <div className="relative group animate-in zoom-in duration-300">
            <div className="w-full h-40 rounded-2xl border border-white/10 overflow-hidden bg-black/40 flex items-center justify-center">
              <img src={attachment} alt="Anexo" className="max-w-full max-h-full object-contain" />
            </div>
            <button 
              type="button"
              onClick={() => setAttachment(null)}
              className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">
              Tipo de Feedback
            </label>
            <div className="flex gap-3 bg-white/[0.03] p-2 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setSelectedType('positive')}
                className={`flex-1 py-3 rounded-lg transition-all flex items-center justify-center gap-2 font-bold text-xs border ${
                  selectedType === 'positive'
                    ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-900/40'
                    : 'bg-green-600/5 border-green-500/20 text-green-500 hover:bg-green-600/10'
                }`}
              >
                <ThumbsUp className="w-4 h-4" /> POSITIVO
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('negative')}
                className={`flex-1 py-3 rounded-lg transition-all flex items-center justify-center gap-2 font-bold text-xs border ${
                  selectedType === 'negative'
                    ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40'
                    : 'bg-red-600/5 border-red-500/20 text-red-500 hover:bg-red-600/10'
                }`}
              >
                <ThumbsDown className="w-4 h-4" /> NEGATIVO
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">
              Privacidade
            </label>
            <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                  isAnonymous
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : 'bg-black/40 border-white/10 text-gray-500 hover:bg-white/[0.03] hover:text-white'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isAnonymous ? 'bg-blue-500 border-blue-500' : 'border-white/20'
                  }`}
                >
                  {isAnonymous && <div className="w-2 h-2 bg-white rounded-full"></div>}
                </div>
                <span className="text-sm font-medium">Enviar de forma anônima</span>
                <Info className="w-4 h-4 ml-auto opacity-40" />
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!content || !receiverId}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-600 text-white font-black py-4 rounded-xl transition-all shadow-xl shadow-green-900/20 active:scale-[0.98] flex items-center justify-center gap-3 text-lg tracking-tight"
        >
          <Send className="w-5 h-5" />
          Enviar Feedback Oficial
        </button>
      </form>
    </div>
  );
};

export default FeedbackForm;
