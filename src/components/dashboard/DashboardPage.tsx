'use client';

import { useMemo } from 'react';
import { useStore, formatPair, ALL_PAIRS } from '@/lib/store';
import { useClock } from '@/hooks/use-clock';
import { motion } from 'framer-motion';
import {
  Zap,
  TrendingUp,
  Target,
  XCircle,
  Flame,
  Activity,
  Clock,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════ */
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

/* ═══════════════════════════════════════════
   1. HERO BANNER
   ═══════════════════════════════════════════ */
function HeroBanner() {
  const running = useStore((s) => s.running);
  const { fullLocal } = useClock();

  return (
    <motion.div
      custom={0}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="glass-card relative overflow-hidden p-5 sm:p-6"
    >
      {/* Animated radial emerald glow */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20"
        style={{
          background:
            'radial-gradient(circle, rgba(16,185,129,0.35) 0%, transparent 70%)',
          animation: 'hero-gradient 6s ease infinite',
          backgroundSize: '200% 200%',
        }}
      />

      {/* Top emerald accent line */}
      <div className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

      <div className="relative flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.3)]">
            <Zap className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider sm:text-2xl">
              <span className="text-emerald-400">NEXUSTRADE</span>{' '}
              <span className="text-white">PRO</span>
            </h1>
            <p className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50">
              BINARY SIGNAL TERMINAL &middot; {fullLocal}
            </p>
          </div>
        </div>

        {/* Right: Status Pill */}
        <div
          className={cn(
            'flex items-center gap-2 rounded-full border px-4 py-1.5',
            running
              ? 'border-emerald-500/20 bg-emerald-500/10'
              : 'border-white/[0.08] bg-white/[0.03]'
          )}
        >
          <span className="relative flex h-2 w-2">
            {running && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                running ? 'bg-emerald-500' : 'bg-red-500'
              )}
            />
          </span>
          <span
            className={cn(
              'text-[11px] font-mono font-bold tracking-wider',
              running ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {running ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   2. PERFORMANCE STATS ROW
   ═══════════════════════════════════════════ */
function PerformanceStats() {
  const stats = useStore((s) => s.stats);

  const cards = [
    {
      label: 'DIRECT WIN',
      value: stats.win,
      icon: TrendingUp,
      color: 'emerald' as const,
      textColor: 'text-emerald-400',
      bgFrom: 'from-emerald-500/15',
      bgTo: 'to-emerald-500/5',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.08)]',
    },
    {
      label: 'MTG WIN',
      value: stats.mtg,
      icon: Target,
      color: 'blue' as const,
      textColor: 'text-blue-400',
      bgFrom: 'from-blue-500/15',
      bgTo: 'to-blue-500/5',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.08)]',
    },
    {
      label: 'LOSS',
      value: stats.loss,
      icon: XCircle,
      color: 'red' as const,
      textColor: 'text-red-400',
      bgFrom: 'from-red-500/15',
      bgTo: 'to-red-500/5',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.08)]',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            custom={i + 1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className={cn(
              'glass-card p-4 sm:p-5',
              card.glow
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br',
                  card.bgFrom,
                  card.bgTo
                )}
              >
                <Icon className={cn('h-5 w-5', card.textColor)} />
              </div>
            </div>
            <p
              className={cn(
                'font-mono font-black text-3xl tabular-nums sm:text-4xl',
                card.textColor
              )}
            >
              {card.value}
            </p>
            <p className="mt-1 text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
              {card.label}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   3. QUICK INFO ROW
   ═══════════════════════════════════════════ */
function QuickInfoRow() {
  const stats = useStore((s) => s.stats);
  const running = useStore((s) => s.running);
  const sessionLog = useStore((s) => s.sessionLog);

  // Calculate win streak (consecutive W/MTG from end)
  const winStreak = useMemo(() => {
    let streak = 0;
    for (let i = sessionLog.length - 1; i >= 0; i--) {
      if (sessionLog[i].result === 'WIN' || sessionLog[i].result === 'MTG') {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [sessionLog]);

  // Market pulse status
  const marketPulse = useMemo(() => {
    if (running) return 'ACTIVE';
    if (sessionLog.length > 0) return 'SCANNING';
    return 'IDLE';
  }, [running, sessionLog]);

  // Signals per hour
  const signalsPerHour = useMemo(() => {
    if (sessionLog.length < 2) return 0;
    const first = new Date(sessionLog[0].time).getTime();
    const last = new Date(sessionLog[sessionLog.length - 1].time).getTime();
    const hours = Math.max((last - first) / 3600000, 0.1);
    return Math.round(sessionLog.length / hours);
  }, [sessionLog]);

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Win Streak */}
      <motion.div
        custom={4}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="rounded-xl border border-white/[0.08] bg-[#0c1220] p-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/15 to-amber-500/5">
            <Flame className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="font-mono font-bold text-lg tabular-nums text-amber-400">
              {winStreak}
            </p>
            <p className="text-[9px] font-mono tracking-[0.12em] text-muted-foreground/50 uppercase">
              Win Streak
            </p>
          </div>
        </div>
      </motion.div>

      {/* Market Pulse */}
      <motion.div
        custom={5}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="rounded-xl border border-white/[0.08] bg-[#0c1220] p-3"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              marketPulse === 'ACTIVE'
                ? 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5'
                : marketPulse === 'SCANNING'
                  ? 'bg-gradient-to-br from-amber-500/15 to-amber-500/5'
                  : 'bg-gradient-to-br from-white/5 to-white/[0.02]'
            )}
          >
            <Activity
              className={cn(
                'h-4 w-4',
                marketPulse === 'ACTIVE'
                  ? 'text-emerald-400'
                  : marketPulse === 'SCANNING'
                    ? 'text-amber-400'
                    : 'text-muted-foreground/40'
              )}
            />
          </div>
          <div>
            <p
              className={cn(
                'text-[13px] font-mono font-bold',
                marketPulse === 'ACTIVE'
                  ? 'text-emerald-400'
                  : marketPulse === 'SCANNING'
                    ? 'text-amber-400'
                    : 'text-muted-foreground/40'
              )}
            >
              {marketPulse}
            </p>
            <p className="text-[9px] font-mono tracking-[0.12em] text-muted-foreground/50 uppercase">
              Market Pulse
            </p>
          </div>
        </div>
      </motion.div>

      {/* Signals / Hour */}
      <motion.div
        custom={6}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="rounded-xl border border-white/[0.08] bg-[#0c1220] p-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/15 to-cyan-500/5">
            <Clock className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <p className="font-mono font-bold text-lg tabular-nums text-cyan-400">
              {signalsPerHour}
            </p>
            <p className="text-[9px] font-mono tracking-[0.12em] text-muted-foreground/50 uppercase">
              Sig / Hour
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   4. WIN RATE CARD
   ═══════════════════════════════════════════ */
function WinRateCard() {
  const stats = useStore((s) => s.stats);

  const total = stats.win + stats.mtg + stats.loss;
  const winRate = total > 0 ? ((stats.win + stats.mtg) / total) * 100 : 0;

  // SVG Ring Gauge config
  const radius = 52;
  const strokeWidth = 7;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (winRate / 100) * circumference;

  // Gradient progress bar markers
  const markers = [25, 50, 75];

  return (
    <motion.div
      custom={7}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="glass-card p-5 sm:p-6"
    >
      {/* Section Divider */}
      <div className="mb-5 flex items-center gap-3">
        <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
          WIN RATE
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row">
        {/* SVG Ring Gauge */}
        <div className="relative flex shrink-0 items-center justify-center">
          <svg
            height={radius * 2}
            width={radius * 2}
            className="-rotate-90"
          >
            {/* Background ring */}
            <circle
              stroke="rgba(255,255,255,0.05)"
              fill="transparent"
              strokeWidth={strokeWidth}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            {/* Progress ring */}
            <circle
              stroke="url(#winRateGradient)"
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              className="transition-all duration-700 ease-out"
            />
            {/* Gradient definition */}
            <defs>
              <linearGradient id="winRateGradient" gradientTransform="rotate(90)">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono font-black text-2xl tabular-nums text-white">
              {winRate.toFixed(1)}
            </span>
            <span className="text-[9px] font-mono tracking-wider text-muted-foreground/40">
              PERCENT
            </span>
          </div>
        </div>

        {/* Right: Large % + Breakdown */}
        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div className="flex items-baseline gap-1 justify-center sm:justify-start">
            <span className="font-mono font-black text-4xl tabular-nums text-emerald-400">
              {winRate.toFixed(1)}
            </span>
            <span className="text-lg font-bold text-muted-foreground/40">%</span>
          </div>

          {/* W/L Breakdown */}
          <div className="flex items-center gap-4 justify-center sm:justify-start">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-mono text-muted-foreground/60">
                W <span className="font-bold text-emerald-400">{stats.win}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-[11px] font-mono text-muted-foreground/60">
                M <span className="font-bold text-blue-400">{stats.mtg}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-[11px] font-mono text-muted-foreground/60">
                L <span className="font-bold text-red-400">{stats.loss}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-muted-foreground/40">
                Σ{total}
              </span>
            </div>
          </div>

          {/* Gradient Progress Bar */}
          <div className="relative">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 transition-all duration-700"
                style={{ width: `${winRate}%` }}
              />
            </div>
            {/* Markers */}
            <div className="relative -mt-2.5 h-2.5 w-full">
              {markers.map((m) => (
                <div
                  key={m}
                  className="absolute top-0 h-2.5 w-px bg-white/[0.08]"
                  style={{ left: `${m}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   5. SESSION SIGNAL FLOW
   ═══════════════════════════════════════════ */
function SessionSignalFlow() {
  const stats = useStore((s) => s.stats);
  const sessionLog = useStore((s) => s.sessionLog);

  // Build 8-column grid blocks from recent entries (most recent last)
  const blocks = useMemo(() => {
    const recent = sessionLog.slice(-64); // 8x8 grid max
    return recent.map((entry) => ({
      result: entry.result,
    }));
  }, [sessionLog]);

  // Pad to fill the grid nicely
  const gridBlocks = useMemo(() => {
    if (blocks.length === 0) return [];
    // Round up to nearest multiple of 8
    const padded = [...blocks];
    while (padded.length % 8 !== 0) {
      padded.push(null);
    }
    return padded;
  }, [blocks]);

  return (
    <motion.div
      custom={8}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="glass-card p-5 sm:p-6"
    >
      {/* Section Divider */}
      <div className="mb-5 flex items-center gap-3">
        <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
          SESSION SIGNAL FLOW
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
      </div>

      {/* 3-Column Mini Stats */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.06] px-3 py-2">
          <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          <span className="text-[11px] font-mono text-muted-foreground/50">WIN</span>
          <span className="ml-auto font-mono font-bold tabular-nums text-emerald-400">
            {stats.win}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-blue-500/[0.06] px-3 py-2">
          <div className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
          <span className="text-[11px] font-mono text-muted-foreground/50">MTG</span>
          <span className="ml-auto font-mono font-bold tabular-nums text-blue-400">
            {stats.mtg}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-red-500/[0.06] px-3 py-2">
          <div className="h-2.5 w-2.5 rounded-sm bg-red-500" />
          <span className="text-[11px] font-mono text-muted-foreground/50">LOSS</span>
          <span className="ml-auto font-mono font-bold tabular-nums text-red-400">
            {stats.loss}
          </span>
        </div>
      </div>

      {/* Signal Blocks Grid */}
      {gridBlocks.length > 0 ? (
        <div className="grid grid-cols-8 gap-1">
          {gridBlocks.map((block, i) => {
            if (!block) {
              return (
                <div
                  key={`empty-${i}`}
                  className="aspect-square rounded-sm bg-white/[0.02]"
                />
              );
            }

            const colorClass =
              block.result === 'WIN'
                ? 'bg-emerald-500/70'
                : block.result === 'MTG'
                  ? 'bg-blue-500/70'
                  : 'bg-red-500/70';

            return (
              <motion.div
                key={`block-${i}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.015, duration: 0.25 }}
                className={cn('aspect-square rounded-sm', colorClass)}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.03]">
            <Activity className="h-5 w-5 text-muted-foreground/20" />
          </div>
          <p className="text-[11px] font-mono text-muted-foreground/30">
            No signals yet this session
          </p>
          <p className="text-[10px] font-mono text-muted-foreground/20">
            Start the engine to begin tracking
          </p>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   6. PAIR BIAS
   ═══════════════════════════════════════════ */
function PairBias() {
  // Generate demo bias data from selected pairs
  const selectedPairs = useStore((s) => s.selectedPairs);

  const biasData = useMemo(() => {
    // Use a simple deterministic pseudo-random based on pair name
    return selectedPairs.map((pair) => {
      let hash = 0;
      for (let c = 0; c < pair.length; c++) {
        hash = (hash * 31 + pair.charCodeAt(c)) | 0;
      }
      const bullStrength = 40 + Math.abs(hash % 61); // 40-100
      const isBull = (Math.abs(hash) % 3) !== 0;
      return {
        pair,
        display: formatPair(pair),
        strength: bullStrength,
        isBull,
      };
    });
  }, [selectedPairs]);

  return (
    <motion.div
      custom={9}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="glass-card p-5 sm:p-6"
    >
      {/* Section Divider */}
      <div className="mb-5 flex items-center gap-3">
        <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
          PAIR BIAS
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
      </div>

      <div className="space-y-3">
        {biasData.map((item) => (
          <div key={item.pair} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-[11px] font-mono text-muted-foreground/50">
              {item.display}
            </span>

            {/* Progress Bar */}
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  item.isBull
                    ? 'bg-gradient-to-r from-emerald-500/60 to-emerald-500'
                    : 'bg-gradient-to-r from-red-500/60 to-red-500'
                )}
                style={{ width: `${item.strength}%` }}
              />
            </div>

            {/* Badge */}
            <div
              className={cn(
                'shrink-0 rounded-md px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider',
                item.isBull
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              )}
            >
              {item.isBull ? 'BULL' : 'BEAR'}
            </div>
          </div>
        ))}

        {biasData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-[11px] font-mono text-muted-foreground/30">
              No pairs selected
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   DASHBOARD PAGE (EXPORT)
   ═══════════════════════════════════════════ */
export default function DashboardPage() {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <HeroBanner />
      <PerformanceStats />
      <QuickInfoRow />
      <WinRateCard />
      <SessionSignalFlow />
      <PairBias />
    </motion.div>
  );
}
