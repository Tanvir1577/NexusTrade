'use client';

import { useMemo } from 'react';
import { useStore, formatPair, ALL_PAIRS } from '@/lib/store';
import { useClock } from '@/hooks/use-clock';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Target,
  XCircle,
  Flame,
  Activity,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════ */
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.07,
      duration: 0.45,
      ease: [0.22, 0.61, 0.36, 1],
    },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
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
      className="glass-card relative overflow-hidden px-5 py-4 sm:px-6"
    >
      {/* Top emerald accent line */}
      <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

      <div className="relative flex items-center justify-between">
        {/* Left — Session info */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full border px-3.5 py-1.5',
              running
                ? 'border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.08)]'
                : 'border-white/[0.06] bg-white/[0.03]'
            )}
          >
            <span className="relative flex h-2.5 w-2.5">
              {running && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              )}
              <span
                className={cn(
                  'relative inline-flex h-2.5 w-2.5 rounded-full',
                  running ? 'bg-emerald-400' : 'bg-rose-500'
                )}
              />
            </span>
            <span
              className={cn(
                'text-[11px] font-mono font-bold tracking-[0.15em]',
                running ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {running ? 'ENGINE LIVE' : 'ENGINE OFFLINE'}
            </span>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/35">
              SESSION TIME
            </span>
            <span className="text-[12px] font-mono font-semibold tabular-nums text-white/70">
              {fullLocal}
            </span>
          </div>
        </div>

        {/* Right — Quick summary */}
        <div className="text-[10px] font-mono tracking-[0.12em] text-muted-foreground/30">
          BINARY SIGNALS &middot; M1 EXPIRY
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   2. PERFORMANCE STATS ROW (WIN / MTG / LOSS)
   ═══════════════════════════════════════════ */
function PerformanceStats() {
  const stats = useStore((s) => s.stats);

  const cards = [
    {
      label: 'WIN',
      value: stats.win,
      icon: TrendingUp,
      textColor: 'text-emerald-400',
      iconBg: 'from-emerald-500/20 to-emerald-500/5',
      shadow: 'shadow-[0_4px_24px_-4px_rgba(16,185,129,0.15)]',
      borderAccent: 'border-emerald-500/[0.12]',
    },
    {
      label: 'MTG',
      value: stats.mtg,
      icon: Target,
      textColor: 'text-amber-400',
      iconBg: 'from-amber-500/15 to-amber-500/5',
      shadow: 'shadow-[0_4px_24px_-4px_rgba(245,158,11,0.12)]',
      borderAccent: 'border-amber-500/[0.08]',
    },
    {
      label: 'LOSS',
      value: stats.loss,
      icon: XCircle,
      textColor: 'text-rose-500',
      iconBg: 'from-rose-500/15 to-rose-500/5',
      shadow: 'shadow-[0_4px_24px_-4px_rgba(244,63,94,0.12)]',
      borderAccent: 'border-rose-500/[0.08]',
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
              'stat-card relative overflow-hidden',
              card.shadow,
              card.borderAccent
            )}
          >
            {/* Subtle top gradient accent */}
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 h-16 opacity-40"
              style={{
                background:
                  card.label === 'WIN'
                    ? 'radial-gradient(ellipse at 50% -20%, rgba(16,185,129,0.15) 0%, transparent 70%)'
                    : card.label === 'MTG'
                      ? 'radial-gradient(ellipse at 50% -20%, rgba(245,158,11,0.12) 0%, transparent 70%)'
                      : 'radial-gradient(ellipse at 50% -20%, rgba(244,63,94,0.12) 0%, transparent 70%)',
              }}
            />

            <div className="relative">
              {/* Icon */}
              <div
                className={cn(
                  'mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]',
                  card.iconBg
                )}
              >
                <Icon className={cn('h-5 w-5', card.textColor)} />
              </div>

              {/* Value */}
              <p
                className={cn(
                  'font-mono font-black text-3xl leading-none tabular-nums sm:text-4xl',
                  card.textColor
                )}
              >
                {card.value}
              </p>

              {/* Label */}
              <p className="mt-2 text-[10px] font-mono font-medium tracking-[0.2em] text-muted-foreground/50 uppercase">
                {card.label}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   3. QUICK INFO ROW (Streak / Pulse / Sig/Hr)
   ═══════════════════════════════════════════ */
function QuickInfoRow() {
  const stats = useStore((s) => s.stats);
  const running = useStore((s) => s.running);
  const sessionLog = useStore((s) => s.sessionLog);

  // Win streak — consecutive W/MTG from end
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

  // Market pulse
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
        className="rounded-xl border border-white/[0.06] bg-[#0c1220]/90 p-3.5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/15 to-amber-500/5">
            <Flame className="h-4 w-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="font-mono font-bold text-lg leading-none tabular-nums text-amber-400">
              {winStreak}
            </p>
            <p className="mt-1 text-[9px] font-mono tracking-[0.15em] text-muted-foreground/40 uppercase">
              Streak
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
        className="rounded-xl border border-white/[0.06] bg-[#0c1220]/90 p-3.5"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              marketPulse === 'ACTIVE'
                ? 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5'
                : marketPulse === 'SCANNING'
                  ? 'bg-gradient-to-br from-amber-500/15 to-amber-500/5'
                  : 'bg-gradient-to-br from-white/[0.06] to-white/[0.02]'
            )}
          >
            <Activity
              className={cn(
                'h-4 w-4',
                marketPulse === 'ACTIVE'
                  ? 'text-emerald-400'
                  : marketPulse === 'SCANNING'
                    ? 'text-amber-400'
                    : 'text-muted-foreground/30'
              )}
            />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                'font-mono text-[13px] font-bold leading-none',
                marketPulse === 'ACTIVE'
                  ? 'text-emerald-400'
                  : marketPulse === 'SCANNING'
                    ? 'text-amber-400'
                    : 'text-muted-foreground/30'
              )}
            >
              {marketPulse}
            </p>
            <p className="mt-1 text-[9px] font-mono tracking-[0.15em] text-muted-foreground/40 uppercase">
              Pulse
            </p>
          </div>
        </div>
      </motion.div>

      {/* Sig / Hour */}
      <motion.div
        custom={6}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="rounded-xl border border-white/[0.06] bg-[#0c1220]/90 p-3.5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/15 to-emerald-500/5">
            <Clock className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="font-mono font-bold text-lg leading-none tabular-nums text-emerald-400">
              {signalsPerHour}
            </p>
            <p className="mt-1 text-[9px] font-mono tracking-[0.15em] text-muted-foreground/40 uppercase">
              Sig/Hour
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
  const radius = 54;
  const strokeWidth = 7;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (winRate / 100) * circumference;

  // Progress bar markers
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
        <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50 uppercase">
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
              stroke="rgba(255,255,255,0.04)"
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
            {/* Emerald gradient */}
            <defs>
              <linearGradient id="winRateGradient" gradientTransform="rotate(90)">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono font-black text-2xl tabular-nums text-white">
              {winRate.toFixed(1)}
            </span>
            <span className="mt-0.5 text-[9px] font-mono tracking-[0.15em] text-muted-foreground/35">
              PERCENT
            </span>
          </div>
        </div>

        {/* Right — Large % + Breakdown */}
        <div className="flex-1 space-y-4 text-center sm:text-left">
          {/* Large percentage */}
          <div className="flex items-baseline gap-1 justify-center sm:justify-start">
            <span className="font-mono font-black text-4xl tabular-nums text-emerald-400">
              {winRate.toFixed(1)}
            </span>
            <span className="text-lg font-bold text-muted-foreground/30">%</span>
          </div>

          {/* W / M / L Breakdown */}
          <div className="flex items-center gap-5 justify-center sm:justify-start">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-mono text-muted-foreground/50">
                W{' '}
                <span className="font-bold text-emerald-400">{stats.win}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-[11px] font-mono text-muted-foreground/50">
                M{' '}
                <span className="font-bold text-amber-400">
                  {stats.mtg}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-[11px] font-mono text-muted-foreground/50">
                L{' '}
                <span className="font-bold text-rose-400">{stats.loss}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-muted-foreground/30">
                Σ{total}
              </span>
            </div>
          </div>

          {/* Emerald gradient progress bar */}
          <div className="relative">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 transition-all duration-700"
                style={{ width: `${winRate}%` }}
              />
            </div>
            {/* Markers at 25 / 50 / 75 */}
            <div className="relative -mt-3 h-3 w-full">
              {markers.map((m) => (
                <div
                  key={m}
                  className="absolute top-0 h-3 w-px bg-white/[0.06]"
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

  // Use 16-column compact grid with smaller blocks
  const blocks = useMemo(() => {
    const recent = sessionLog.slice(-80);
    return recent.map((entry) => ({
      result: entry.result,
    }));
  }, [sessionLog]);

  const gridBlocks = useMemo(() => {
    if (blocks.length === 0) return [];
    const padded = [...blocks];
    while (padded.length % 16 !== 0) {
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
      className="glass-card px-4 py-3.5 sm:px-5 sm:py-4"
    >
      {/* Section Divider */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50 uppercase">
          Signal Flow
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
      </div>

      {/* 3-Column Mini Stat Chips — compact */}
      <div className="mb-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-sm bg-emerald-500" />
          <span className="text-[10px] font-mono tabular-nums text-emerald-400 font-bold">{stats.win}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-sm bg-amber-500" />
          <span className="text-[10px] font-mono tabular-nums text-amber-400 font-bold">{stats.mtg}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-sm bg-rose-500" />
          <span className="text-[10px] font-mono tabular-nums text-rose-400 font-bold">{stats.loss}</span>
        </div>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground/25">
          {stats.win + stats.mtg + stats.loss} total
        </span>
      </div>

      {/* Signal Blocks Grid — compact 16-col */}
      {gridBlocks.length > 0 ? (
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
          {gridBlocks.map((block, i) => {
            if (!block) {
              return (
                <div
                  key={`empty-${i}`}
                  className="aspect-square rounded-[2px] bg-white/[0.02]"
                />
              );
            }

            const colorClass =
              block.result === 'WIN'
                ? 'bg-emerald-500/70'
                : block.result === 'MTG'
                  ? 'bg-amber-500/70'
                  : 'bg-rose-500/70';

            return (
              <motion.div
                key={`block-${i}`}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: i * 0.008,
                  duration: 0.15,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
                className={cn(
                  'aspect-square rounded-[2px]',
                  colorClass
                )}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8">
          <Activity className="h-4 w-4 text-muted-foreground/15 mb-2" />
          <p className="text-[10px] font-mono text-muted-foreground/20">
            No signals yet this session
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
  const selectedPairs = useStore((s) => s.selectedPairs);

  const biasData = useMemo(() => {
    return selectedPairs.map((pair) => {
      let hash = 0;
      for (let c = 0; c < pair.length; c++) {
        hash = (hash * 31 + pair.charCodeAt(c)) | 0;
      }
      const bullStrength = 40 + Math.abs(hash % 61);
      const isBull = Math.abs(hash) % 3 !== 0;
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
        <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/50 uppercase">
          PAIR BIAS
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
      </div>

      <div className="space-y-3">
        {biasData.map((item) => (
          <div key={item.pair} className="flex items-center gap-3">
            {/* Pair name */}
            <span className="w-16 shrink-0 text-[11px] font-mono tabular-nums text-muted-foreground/45">
              {item.display}
            </span>

            {/* Progress bar */}
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  item.isBull
                    ? 'bg-gradient-to-r from-emerald-500/50 to-emerald-400'
                    : 'bg-gradient-to-r from-rose-500/50 to-rose-400'
                )}
                style={{ width: `${item.strength}%` }}
              />
            </div>

            {/* Strength badge */}
            <div
              className={cn(
                'shrink-0 rounded-md px-2 py-0.5 text-[9px] font-mono font-bold tracking-[0.1em]',
                item.isBull
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              )}
            >
              {item.isBull ? 'BULL' : 'BEAR'}
            </div>
          </div>
        ))}

        {biasData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-[11px] font-mono text-muted-foreground/25">
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
