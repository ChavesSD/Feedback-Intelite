import { useEffect, useState } from 'react';
import { API_URL, useAuth } from '../context/AuthContext';
import { Calendar, CheckCircle2, Image as ImageIcon, Send } from 'lucide-react';

interface EventItem {
  _id: string;
  title: string;
  content: string;
  attachment?: string;
  createdByName: string;
  recognized: boolean;
  recognizedAt?: string;
  createdAt: string;
  recognizedByName?: string;
}

const EventsBoard = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState<string>('');
  const [error, setError] = useState('');

  const isRh = user?.sector === 'RH';

  const fetchEvents = async () => {
    if (!user?._id) return;
    try {
      const response = await fetch(`${API_URL}/events?viewerId=${user._id}`);
      const data = await response.json();
      if (response.ok) {
        setEvents(data);
      } else {
        setError(data.message || 'Erro ao carregar eventos');
      }
    } catch (e) {
      setError('Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [user?._id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachment((event.target?.result as string) || '');
    };
    reader.readAsDataURL(file);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?._id) return;
    try {
      setSubmitting(true);
      setError('');
      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          attachment,
          creatorId: user._id
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Erro ao criar evento');
        return;
      }
      setTitle('');
      setContent('');
      setAttachment('');
      fetchEvents();
    } catch (e) {
      setError('Erro ao criar evento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecognize = async (eventId: string) => {
    if (!user?._id) return;
    try {
      setError('');
      const response = await fetch(`${API_URL}/events/${eventId}/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Erro ao reconhecer evento');
        return;
      }
      fetchEvents();
    } catch (e) {
      setError('Erro ao reconhecer evento');
    }
  };

  return (
    <div className="space-y-6">
      {isRh && (
        <form onSubmit={handleCreateEvent} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Publicar Evento
          </h3>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do evento"
            className="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
          />
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Descrição/comentário do acontecimento"
            className="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all min-h-[120px] resize-none"
          />
          <label className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-widest cursor-pointer">
            <ImageIcon className="w-4 h-4" />
            Adicionar Foto
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
          {attachment && (
            <img src={attachment} alt="Prévia" className="max-h-48 rounded-xl border border-white/10 object-contain" />
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Publicando...' : 'Publicar Evento'}
          </button>
        </form>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="text-gray-500 text-sm">Carregando eventos...</div>
        ) : events.length === 0 ? (
          <div className="text-gray-500 text-sm">Nenhum evento publicado.</div>
        ) : (
          events.map((event) => (
            <div key={event._id} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-lg font-black text-white">{event.title}</h4>
                  <p className="text-xs text-gray-500">
                    Publicado por {event.createdByName} • {new Date(event.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                {event.recognized ? (
                  <span className="text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest bg-green-500/15 text-green-400 border border-green-500/30">
                    Reconhecido
                  </span>
                ) : (
                  <span className="text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                    Pendente
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{event.content}</p>

              {event.attachment && (
                <img src={event.attachment} alt="Evento" className="max-h-72 rounded-xl border border-white/10 object-contain" />
              )}

              {event.recognized && isRh && event.recognizedByName && (
                <p className="text-xs text-purple-400 font-bold uppercase tracking-widest">
                  Reconhecido por: {event.recognizedByName}
                </p>
              )}

              {!isRh && !event.recognized && (
                <button
                  onClick={() => handleRecognize(event._id)}
                  className="w-full py-3 bg-red-600/80 hover:bg-red-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Reconheço que este evento foi realizado por mim
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EventsBoard;
