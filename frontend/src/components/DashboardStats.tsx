import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Trophy, Users, PieChart as PieChartIcon, Star, Crown, Zap } from 'lucide-react';
import Avatar from './Avatar';

interface TopEmployee {
  _id: string;
  name: string;
  sector: string;
  avatar?: string;
  skills?: {
    atendimento?: number;
    proatividade?: number;
    tratamento?: number;
    agilidade?: number;
    dificuldade?: number;
  };
  resolutionRate?: number;
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
  topSupervisors: TopEmployee[];
  sectorStats: SectorStat[];
  typeStats: TypeStat[];
}

const SKILL_FIELDS = [
  { key: 'atendimento', label: 'Atendimento' },
  { key: 'proatividade', label: 'Proatividade' },
  { key: 'tratamento', label: 'Tratamento' },
  { key: 'agilidade', label: 'Agilidade' },
  { key: 'dificuldade', label: 'Dificuldade' }
] as const;

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#34d399',
  negative: '#fb7185',
  neutral: '#a1a1aa'
};

const buildSkillsSummary = (emp: TopEmployee) => {
  const s = emp.skills ?? {};
  const toInt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0);
  return {
    atendimento: toInt(s.atendimento),
    proatividade: toInt(s.proatividade),
    tratamento: toInt(s.tratamento),
    agilidade: toInt(s.agilidade),
    dificuldade: toInt(s.dificuldade),
    resolutionRate: typeof emp.resolutionRate === 'number' && Number.isFinite(emp.resolutionRate)
      ? Math.round(emp.resolutionRate)
      : 0
  };
};

const canHover = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover)').matches;

const SkillTooltip = ({ emp, wide }: { emp: TopEmployee; wide?: boolean }) => {
  const summary = buildSkillsSummary(emp);
  return (
    <div className={`bg-[#08080c]/95 border border-indigo-400/20 rounded-2xl p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md ${wide ? 'w-64' : 'w-56'}`}>
      <div className="text-[10px] font-gamer text-amber-400 uppercase tracking-[0.2em] mb-3">Stats</div>
      <div className="space-y-2">
        {SKILL_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
              <span>{label}</span>
              <span className="font-mono text-amber-300">{summary[key]}/5</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="xp-bar h-full rounded-full" style={{ width: `${(summary[key] / 5) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
        <span>Resolução</span>
        <span className="font-gamer text-amber-300">{summary.resolutionRate}%</span>
      </div>
    </div>
  );
};

const RankAvatar = ({
  emp,
  place,
  hovered,
  onEnter,
  onLeave
}: {
  emp: TopEmployee;
  place: 1 | 2 | 3;
  hovered: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) => {
  const size =
    place === 1
      ? 'w-[7.5rem] h-[7.5rem] sm:w-40 sm:h-40'
      : place === 2
        ? 'w-24 h-24 sm:w-[7.25rem] sm:h-[7.25rem]'
        : 'w-20 h-20 sm:w-28 sm:h-28';
  const ringPad = place === 1 ? '-inset-[6px]' : '-inset-[4px]';

  return (
    <div className={`relative ${place === 1 ? 'rank-float' : ''}`}>
      {place === 1 && (
        <>
          <div className="absolute -inset-8 bg-amber-400/15 blur-3xl rounded-full" />
          <div className={`absolute ${ringPad} rounded-full rank-ring opacity-80`} />
          <div className={`absolute ${ringPad} rounded-full rank-ring rank-ring-slow opacity-30`} />
        </>
      )}
      {place === 2 && (
        <div className={`absolute ${ringPad} rounded-full bg-gradient-to-br from-indigo-300/70 to-indigo-900`} />
      )}
      {place === 3 && (
        <div className={`absolute ${ringPad} rounded-full bg-gradient-to-br from-zinc-400/50 to-zinc-800`} />
      )}
      <div
        className={`${size} rounded-full p-[3px] relative z-[1] ${
          place === 1
            ? 'bg-gradient-to-br from-amber-200 via-amber-500 to-indigo-800 shadow-[0_0_32px_rgba(251,191,36,0.28)]'
            : place === 2
              ? 'bg-gradient-to-br from-indigo-200 via-indigo-500 to-indigo-950 shadow-[0_0_20px_rgba(129,140,248,0.2)]'
              : 'bg-gradient-to-br from-zinc-200 via-zinc-500 to-zinc-800'
        }`}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <div className="w-full h-full rounded-full bg-black overflow-hidden border border-white/10 relative group">
          <Avatar src={emp.avatar} name={emp.name} className="w-full h-full object-cover" />
          {place === 1 && (
            <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1 border border-amber-400/40">
              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
            </div>
          )}
          <div className={`absolute left-1/2 -translate-x-1/2 top-full mt-3 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-30 ${hovered ? '-translate-y-1' : 'translate-y-2'}`}>
            <SkillTooltip emp={emp} wide={place === 1} />
          </div>
        </div>
      </div>
      <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 z-[2] font-gamer ${
        place === 1
          ? 'text-[11px] px-3 py-1 rounded-full bg-amber-400 text-black'
          : place === 2
            ? 'text-[10px] px-2.5 py-1 rounded-full bg-indigo-950 text-indigo-200 border border-indigo-400/30'
            : 'text-[10px] px-2.5 py-1 rounded-full bg-zinc-900 text-zinc-300 border border-white/15'
      }`}>
        {place === 1 ? 'MVP' : `#${place}`}
      </div>
    </div>
  );
};

const DashboardStats = () => {
  const { apiFetchJson } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [top3Filter, setTop3Filter] = useState<'Todos' | 'Suporte' | 'Comercial' | 'RH' | 'Geral'>('Todos');
  const [showConfetti, setShowConfetti] = useState(false);
  const [hoveredHofIndex, setHoveredHofIndex] = useState<0 | 1 | 2 | null>(null);

  const confettiPieces = useMemo(() => {
    const colors = ['#fbbf24', '#818cf8', '#fde68a', '#34d399', '#c4b5fd', '#fb7185'];
    const random = (min: number, max: number) => Math.random() * (max - min) + min;
    return Array.from({ length: 52 }).map((_, idx) => ({
      id: idx,
      left: random(0, 100),
      size: random(5, 11),
      rotate: random(180, 720),
      duration: random(2.2, 4.2),
      delay: random(0, 0.8),
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() > 0.55 ? 'circle' : 'rect'
    }));
  }, []);

  const fetchStats = async (sector: string = 'Todos') => {
    try {
      setLoading(true);
      const { response, data: stats } = await apiFetchJson<DashboardData>(`/stats/dashboard?sector=${sector}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      if (stats && stats.topEmployees && stats.sectorStats && stats.typeStats) {
        setData({ ...stats, topSupervisors: stats.topSupervisors ?? [] });
      } else {
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

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-400/30 border-t-indigo-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const pieData = data.typeStats.map((item) => ({
    ...item,
    label: item.name === 'positive' ? 'Positivo' : item.name === 'negative' ? 'Negativo' : 'Neutro'
  }));

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-0">
      <section className="relative overflow-hidden rounded-[2rem] border border-indigo-400/15 bg-[#08080c] px-4 sm:px-8 pt-8 pb-2">
        <div className="absolute inset-0 podium-grid pointer-events-none" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[220px] bg-amber-400/10 blur-[90px] rounded-full pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-amber-400/10 p-2.5 rounded-xl border border-amber-400/20">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-gamer text-white uppercase tracking-wide">
                Hall da <span className="text-amber-400">Fama</span>
              </h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.22em] mt-1">Season ranking • top 3</p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            {(['Todos', 'Suporte', 'Comercial', 'RH', 'Geral'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setTop3Filter(s)}
                className={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest transition-all border shrink-0 ${
                  top3Filter === s
                    ? 'bg-indigo-500 border-indigo-400 text-white'
                    : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="relative min-h-[480px] flex items-end justify-center px-2 pt-10">
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
                    animate={{ y: 540, opacity: [0, 1, 1, 0], rotate: p.rotate }}
                    transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
                    style={{
                      left: `${p.left}%`,
                      width: `${p.size}px`,
                      height: `${Math.max(4, p.size * 0.45)}px`,
                      backgroundColor: p.color,
                      borderRadius: p.shape === 'circle' ? '9999px' : '3px'
                    }}
                    className="absolute top-0 shadow-[0_0_8px_rgba(255,255,255,0.12)]"
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
                <div className="w-12 h-12 border-4 border-indigo-400/30 border-t-indigo-300 rounded-full animate-spin" />
                <p className="text-indigo-300/70 text-xs font-gamer uppercase tracking-widest">Calculando XP...</p>
              </motion.div>
            ) : data.topEmployees.length > 0 ? (
              <motion.div
                key="podium"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-end justify-center gap-3 sm:gap-8 w-full max-w-5xl"
              >
                {data.topEmployees[1] && (
                  <div className="flex flex-col items-center flex-1 max-w-[180px]">
                    <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }} className="mb-8">
                      <RankAvatar
                        emp={data.topEmployees[1]}
                        place={2}
                        hovered={hoveredHofIndex === 1}
                        onEnter={() => canHover() && setHoveredHofIndex(1)}
                        onLeave={() => canHover() && setHoveredHofIndex((prev) => (prev === 1 ? null : prev))}
                      />
                    </motion.div>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 148 }}
                      transition={{ type: 'spring', damping: 14, delay: 0.15 }}
                      className="w-full bg-gradient-to-t from-black to-indigo-950/40 border-x border-t border-indigo-400/20 rounded-t-3xl flex flex-col items-center pt-5 px-3 text-center"
                    >
                      <span className="text-xs font-black text-white truncate w-full">{data.topEmployees[1].name}</span>
                      <span className="text-[9px] font-bold text-indigo-300/80 uppercase tracking-widest mt-1">{data.topEmployees[1].sector}</span>
                      <div className="mt-auto mb-4 flex items-center gap-1 bg-black/50 px-2.5 py-1 rounded-full border border-indigo-400/20">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-gamer text-white">{data.topEmployees[1].averageRating.toFixed(1)}</span>
                      </div>
                    </motion.div>
                  </div>
                )}

                {data.topEmployees[0] && (
                  <div className="flex flex-col items-center flex-1 max-w-[230px] z-10">
                    <motion.div
                      initial={{ y: 40, opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.45 }}
                      className="mb-10 relative"
                    >
                      <motion.div
                        animate={{ rotate: [0, -8, 8, 0], y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 2.4 }}
                        className="absolute -top-11 left-1/2 -translate-x-1/2"
                      >
                        <Trophy className="w-9 h-9 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]" />
                      </motion.div>
                      <RankAvatar
                        emp={data.topEmployees[0]}
                        place={1}
                        hovered={hoveredHofIndex === 0}
                        onEnter={() => canHover() && setHoveredHofIndex(0)}
                        onLeave={() => canHover() && setHoveredHofIndex((prev) => (prev === 0 ? null : prev))}
                      />
                    </motion.div>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 210 }}
                      transition={{ type: 'spring', damping: 11 }}
                      className="w-full bg-gradient-to-t from-black via-amber-950/50 to-amber-400/20 border-x border-t border-amber-300/30 rounded-t-[1.6rem] flex flex-col items-center pt-6 px-4 text-center shadow-[0_-18px_50px_rgba(251,191,36,0.12)]"
                    >
                      <span className="text-sm sm:text-base font-black text-white leading-tight">{data.topEmployees[0].name}</span>
                      <span className="text-[10px] font-bold text-amber-300 uppercase tracking-[0.18em] mt-1">{data.topEmployees[0].sector}</span>
                      <div className="w-full mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (data.topEmployees[0].averageRating / 5) * 100)}%` }}
                          transition={{ delay: 0.4, duration: 0.8 }}
                          className="xp-bar h-full rounded-full"
                        />
                      </div>
                      <div className="mt-auto mb-6 flex flex-col items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-black/60 px-4 py-2 rounded-2xl border border-amber-400/30">
                          <Zap className="w-4 h-4 text-amber-300" />
                          <span className="text-lg font-gamer text-white">{data.topEmployees[0].averageRating.toFixed(1)}</span>
                        </div>
                        <span className="text-[10px] text-amber-400/70 font-bold uppercase tracking-widest">
                          {data.topEmployees[0].count} feedbacks
                        </span>
                      </div>
                    </motion.div>
                  </div>
                )}

                {data.topEmployees[2] && (
                  <div className="flex flex-col items-center flex-1 max-w-[170px]">
                    <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="mb-8">
                      <RankAvatar
                        emp={data.topEmployees[2]}
                        place={3}
                        hovered={hoveredHofIndex === 2}
                        onEnter={() => canHover() && setHoveredHofIndex(2)}
                        onLeave={() => canHover() && setHoveredHofIndex((prev) => (prev === 2 ? null : prev))}
                      />
                    </motion.div>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 118 }}
                      transition={{ type: 'spring', damping: 16, delay: 0.22 }}
                      className="w-full bg-gradient-to-t from-black to-zinc-800/30 border-x border-t border-white/10 rounded-t-3xl flex flex-col items-center pt-5 px-3 text-center"
                    >
                      <span className="text-[11px] font-black text-white truncate w-full">{data.topEmployees[2].name}</span>
                      <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{data.topEmployees[2].sector}</span>
                      <div className="mt-auto mb-4 flex items-center gap-1 bg-black/50 px-2.5 py-1 rounded-full border border-white/10">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-gamer text-white">{data.topEmployees[2].averageRating.toFixed(1)}</span>
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
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                  <Trophy className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-gray-500 text-sm italic font-medium">Ainda não há jogadores suficientes no ranking.</p>
                <p className="text-slate-600 text-[10px] mt-2 uppercase tracking-widest font-black">Envie feedbacks para subir de nível!</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-amber-400/10 p-2 rounded-lg border border-amber-400/20">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-lg font-gamer text-white uppercase tracking-wide">
              Ranking de <span className="text-amber-400">Gestores</span>
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-10 h-10 border-4 border-indigo-400/30 border-t-indigo-300 rounded-full animate-spin" />
          </div>
        ) : data.topSupervisors.length > 0 ? (
          <div className="space-y-3">
            {data.topSupervisors.map((u, idx) => (
              <motion.div
                key={u._id || `${u.name}-${idx}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                className={`border rounded-2xl p-4 flex items-center gap-4 ${
                  idx === 0
                    ? 'bg-amber-400/[0.06] border-amber-400/25'
                    : 'bg-white/[0.02] border-white/10'
                }`}
              >
                <span className={`font-gamer w-10 text-sm ${idx === 0 ? 'text-amber-400' : 'text-indigo-300'}`}>#{String(idx + 1).padStart(2, '0')}</span>
                <div className={`w-14 h-14 rounded-full overflow-hidden p-[2px] ${idx === 0 ? 'bg-gradient-to-br from-amber-300 to-indigo-800 shadow-[0_0_16px_rgba(251,191,36,0.25)]' : 'bg-gradient-to-br from-indigo-300 to-indigo-800'}`}>
                  <div className="w-full h-full rounded-full overflow-hidden bg-black">
                    <Avatar src={u.avatar} name={u.name} className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white truncate">{u.name}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    {u.sector} • {u.count} feedbacks
                  </p>
                  <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden max-w-xs">
                    <div className="xp-bar h-full rounded-full" style={{ width: `${Math.min(100, (u.averageRating / 5) * 100)}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-black/40 px-3 py-2 rounded-2xl border border-amber-400/20 shrink-0">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-gamer text-white">{u.averageRating.toFixed(1)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border border-dashed border-white/10 rounded-3xl">
            <p className="text-gray-500 text-sm italic font-medium">Ainda não há gestores suficientes no ranking.</p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 min-h-[400px] flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-indigo-500/10 p-2 rounded-lg">
              <Users className="w-5 h-5 text-indigo-300" />
            </div>
            <h3 className="text-lg font-bold text-white">Feedbacks por Setor</h3>
          </div>
          <div className="flex-1 w-full min-h-[300px] h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sectorStats}>
                <defs>
                  <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a5b4fc" />
                    <stop offset="100%" stopColor="#4338ca" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#818cf818" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(129, 140, 248, 0.06)' }}
                  contentStyle={{ backgroundColor: '#08080c', border: '1px solid rgba(129,140,248,0.2)', borderRadius: '12px' }}
                  itemStyle={{ color: '#e0e7ff' }}
                />
                <Bar dataKey="count" fill="url(#barBlue)" radius={[8, 8, 0, 0]} barSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 min-h-[400px] flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-emerald-500/10 p-2 rounded-lg">
              <PieChartIcon className="w-5 h-5 text-emerald-300" />
            </div>
            <h3 className="text-lg font-bold text-white">Análise de Sentimento</h3>
          </div>
          <div className="flex-1 w-full min-h-[300px] h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={104}
                  paddingAngle={6}
                  dataKey="value"
                  nameKey="label"
                  stroke="#08080c"
                  strokeWidth={4}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.name] || '#a1a1aa'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#08080c', border: '1px solid rgba(129,140,248,0.2)', borderRadius: '12px' }}
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
