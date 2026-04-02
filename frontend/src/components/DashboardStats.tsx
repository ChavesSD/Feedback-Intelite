import { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Trophy, Users, PieChart as PieChartIcon, Star, Crown } from 'lucide-react';
import Avatar from './Avatar';

interface TopEmployee {
  _id: string;
  name: string;
  sector: string;
  avatar?: string;
  averageRating: number;
  count: number;
}

interface SectorStat {
  name: string;
  count: number;
  averageRating: number;
}

interface TypeStat {
  name: string;
  value: number;
}

interface DashboardData {
  topEmployees: TopEmployee[];
  sectorStats: SectorStat[];
  typeStats: TypeStat[];
}

const DashboardStats = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [top3Filter, setTop3Filter] = useState<'Todos' | 'Suporte' | 'Comercial' | 'RH' | 'Geral'>('Todos');
  const [showConfetti, setShowConfetti] = useState(false);

  const confettiPieces = useMemo(() => {
    const colors = ['#0ea5e9', '#38bdf8', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#93c5fd'];
    const random = (min: number, max: number) => Math.random() * (max - min) + min;
    return Array.from({ length: 44 }).map((_, idx) => ({
      id: idx,
      left: random(0, 100),
      size: random(6, 12),
      rotate: random(180, 720),
      duration: random(2.2, 4.2),
      delay: random(0, 0.8),
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() > 0.6 ? 'circle' : 'rect'
    }));
  }, []);

  const fetchStats = async (sector: string = 'Todos') => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/stats/dashboard?sector=${sector}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const stats = await response.json();
      // Validar a estrutura básica dos dados recebidos
      if (stats && stats.topEmployees && stats.sectorStats && stats.typeStats) {
        setData(stats);
      } else {
        console.error('Dados do dashboard em formato inválido:', stats);
        setData(null);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(top3Filter);
  }, [top3Filter]);

  useEffect(() => {
    if (!loading && data && data.topEmployees.length > 0) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [loading, top3Filter, data?.topEmployees?.length]);

  if (loading && !data) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-0">
      {/* Top 3 Employees - Gaming Podium Style */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-12">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500/10 p-2 rounded-lg">
              <Trophy className="w-5 h-5 text-yellow-500" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Hall da <span className="text-yellow-500">Fama</span></h3>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            {(['Todos', 'Suporte', 'Comercial', 'RH', 'Geral'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setTop3Filter(s)}
                className={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest transition-all border shrink-0 ${
                  top3Filter === s 
                    ? 'bg-yellow-500 border-yellow-500 text-black shadow-lg shadow-yellow-500/20' 
                    : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        
        <div className="relative min-h-[450px] flex items-end justify-center px-4 pt-20">
          <AnimatePresence>
            {showConfetti && (
              <motion.div
                key="confetti"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 overflow-hidden z-20"
              >
                {confettiPieces.map((p) => (
                  <motion.span
                    key={p.id}
                    initial={{ y: -40, opacity: 0, rotate: 0 }}
                    animate={{ y: 520, opacity: [0, 1, 1, 0], rotate: p.rotate }}
                    transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
                    style={{
                      left: `${p.left}%`,
                      width: `${p.size}px`,
                      height: `${Math.max(4, p.size * 0.45)}px`,
                      backgroundColor: p.color,
                      borderRadius: p.shape === 'circle' ? '9999px' : '3px'
                    }}
                    className="absolute top-0 shadow-[0_0_12px_rgba(255,255,255,0.08)]"
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              >
                <div className="w-12 h-12 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div>
                <p className="text-yellow-500/50 text-xs font-black uppercase tracking-widest">Calculando XP...</p>
              </motion.div>
            ) : data.topEmployees.length > 0 ? (
              <motion.div 
                key="podium"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-end justify-center gap-2 sm:gap-6 w-full max-w-4xl"
              >
                {/* 2nd Place */}
                {data.topEmployees[1] && (
                  <div className="flex flex-col items-center flex-1 max-w-[140px] group">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 }}
                      className="mb-4 relative"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-400 p-[2px] shadow-lg">
                        <div className="w-full h-full rounded-2xl bg-black overflow-hidden border border-white/10">
                          <Avatar src={data.topEmployees[1].avatar} name={data.topEmployees[1].name} className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="absolute -top-3 -right-3 w-8 h-8 bg-slate-400 text-black rounded-lg flex items-center justify-center font-black text-sm shadow-lg">2</div>
                    </motion.div>
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: 120 }}
                      transition={{ type: "spring", damping: 12, delay: 0.2 }}
                      className="w-full bg-gradient-to-t from-slate-900 to-slate-400/20 border-x border-t border-slate-400/30 rounded-t-2xl flex flex-col items-center pt-4 px-2 text-center"
                    >
                      <span className="text-[10px] font-black text-white/90 truncate w-full">{data.topEmployees[1].name}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{data.topEmployees[1].sector}</span>
                      <div className="mt-auto mb-4 flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/5">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-bold text-white">{data.topEmployees[1].averageRating.toFixed(1)}</span>
                      </div>
                    </motion.div>
                  </div>
                )}

                {/* 1st Place - The Winner */}
                {data.topEmployees[0] && (
                  <div className="flex flex-col items-center flex-1 max-w-[180px] z-10 relative">
                    <motion.div 
                      initial={{ y: 50, opacity: 0, scale: 0.5 }}
                      animate={{ y: [0, -20, 0], opacity: 1, scale: 1.2 }}
                      transition={{ 
                        y: { repeat: Infinity, duration: 3, ease: "easeInOut" },
                        opacity: { duration: 0.5 },
                        scale: { duration: 0.5 }
                      }}
                      className="mb-6 relative"
                    >
                      {/* Halo Effect */}
                      <div className="absolute inset-0 bg-yellow-500/20 blur-2xl rounded-full animate-pulse"></div>
                      
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-yellow-500 p-[3px] shadow-[0_0_30px_rgba(234,179,8,0.3)]">
                        <div className="w-full h-full rounded-3xl bg-black overflow-hidden border border-white/10 relative">
                          <Avatar src={data.topEmployees[0].avatar} name={data.topEmployees[0].name} className="w-full h-full object-cover" />
                          <div className="absolute top-1 right-1">
                            <Crown className="w-6 h-6 text-yellow-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                          </div>
                        </div>
                      </div>
                      
                      <motion.div 
                        animate={{ rotate: [0, -10, 10, 0], y: [0, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                        className="absolute -top-10 left-1/2 -translate-x-1/2"
                      >
                        <Trophy className="w-10 h-10 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                      </motion.div>
                    </motion.div>

                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: 180 }}
                      transition={{ type: "spring", damping: 10 }}
                      className="w-full bg-gradient-to-t from-yellow-900/40 to-yellow-500/30 border-x border-t border-yellow-500/40 rounded-t-3xl flex flex-col items-center pt-6 px-4 text-center shadow-[0_-10px_40px_rgba(234,179,8,0.1)]"
                    >
                      <span className="text-sm font-black text-white leading-tight drop-shadow-md">{data.topEmployees[0].name}</span>
                      <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mt-1">{data.topEmployees[0].sector}</span>
                      
                      <div className="mt-auto mb-6 flex flex-col items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-black/60 px-4 py-2 rounded-2xl border border-yellow-500/20">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-lg font-black text-white">{data.topEmployees[0].averageRating.toFixed(1)}</span>
                        </div>
                        <span className="text-[10px] text-yellow-500/60 font-bold uppercase tracking-tighter">{data.topEmployees[0].count} Feedbacks</span>
                      </div>
                    </motion.div>
                  </div>
                )}

                {/* 3rd Place */}
                {data.topEmployees[2] && (
                  <div className="flex flex-col items-center flex-1 max-w-[140px] group">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 }}
                      className="mb-4 relative"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-700 p-[2px] shadow-lg">
                        <div className="w-full h-full rounded-2xl bg-black overflow-hidden border border-white/10">
                          <Avatar src={data.topEmployees[2].avatar} name={data.topEmployees[2].name} className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="absolute -top-3 -right-3 w-8 h-8 bg-amber-700 text-white rounded-lg flex items-center justify-center font-black text-sm shadow-lg">3</div>
                    </motion.div>
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: 90 }}
                      transition={{ type: "spring", damping: 15, delay: 0.3 }}
                      className="w-full bg-gradient-to-t from-amber-900/40 to-amber-700/20 border-x border-t border-amber-700/30 rounded-t-2xl flex flex-col items-center pt-4 px-2 text-center"
                    >
                      <span className="text-[10px] font-black text-white/90 truncate w-full">{data.topEmployees[2].name}</span>
                      <span className="text-[8px] font-bold text-amber-600 uppercase tracking-tighter mt-1">{data.topEmployees[2].sector}</span>
                      <div className="mt-auto mb-4 flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/5">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-bold text-white">{data.topEmployees[2].averageRating.toFixed(1)}</span>
                      </div>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="no-data"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 border border-dashed border-white/10 rounded-3xl w-full max-w-lg mx-auto"
              >
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-gray-700" />
                </div>
                <p className="text-gray-500 text-sm italic font-medium">Ainda não há jogadores suficientes no ranking.</p>
                <p className="text-gray-600 text-[10px] mt-2 uppercase tracking-widest font-black">Envie feedbacks para subir de nível!</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sector Distribution */}
        <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 min-h-[400px] flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-500/10 p-2 rounded-lg">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-white">Feedbacks por Setor</h3>
          </div>
          
          <div className="flex-1 w-full min-h-[300px] h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sectorStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Sentiment Analysis */}
        <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 min-h-[400px] flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-purple-500/10 p-2 rounded-lg">
              <PieChartIcon className="w-5 h-5 text-purple-500" />
            </div>
            <h3 className="text-lg font-bold text-white">Análise de Sentimento</h3>
          </div>
          
          <div className="flex-1 w-full min-h-[300px] h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.typeStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {data.typeStats.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        entry.name === 'positive' ? '#10b981' : 
                        entry.name === 'negative' ? '#ef4444' : 
                        '#6366f1'
                      } 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardStats;
