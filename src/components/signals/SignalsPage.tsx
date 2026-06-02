'use client';

import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Clock,
  ChevronUp,
  ChevronDown,
  Zap,
  Signal,
  Activity,
} from 'lucide-react';
import { useStore, formatPair, priceDecimalsDisplay, type HistoryEntry } from '@/lib/store';
import { useClock } from '@/hooks/use-clock';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const COUNTDOWN_RING_R = 22;
const COUNTDOWN_RING_C = 2 * Math.PI * COUNTDOWN_RING_R; // ~138.23

/* ═══════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════════════════════════ */
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

const signalScale = {
  initial: { scale: 0.92, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
  exit: { scale: 0.92, opacity: 0, transition: { duration: 0.2 } },
};

const rowFadeIn = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, duration: 0.3 },
  }),
};

const staggerContainer = {
  visible: { transition: { staggerChildren: 0.04 } },
};

/* ═══════════════════════════════════════════════════════════════
   1. PAGE HEADER
   ═══════════════════════════════════════════════════════════════ */
function PageHeader() {
  return (
    <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
      <h1 className="text-lg font-black tracking-wider text-white">
        <span className="text-emerald-400">SIGNALS</span>
      </h1>
      <p className="mt-0.5 text-[11px] font-mono text-muted-foreground/40">
        Live binary options pattern detection terminal
      </p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. LIVE STATUS BANNER
   ═══════════════════════════════════════════════════════════════ */
function LiveStatusBanner() {
  const running = useStore((s) => s.running);
  const selectedPairs = useStore((s) => s.selectedPairs);

  return (
    <AnimatePresence>
      {running && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -8 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex items-center justify-center"
        >
          <div className="flex items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-2 shadow-[0_0_16px_rgba(16,185,129,0.08)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-mono font-bold tracking-wider text-emerald-400">
              LIVE — SCANNING {selectedPairs.length} PAIRS
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. COUNTDOWN RING (SVG Arc)
   ═══════════════════════════════════════════════════════════════ */
function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const progress = Math.max(0, seconds / total);
  const offset = COUNTDOWN_RING_C * (1 - progress);

  let ringColor = '#10b981'; // emerald
  if (seconds <= 4) ringColor = '#f43f5e'; // rose
  else if (seconds <= 10) ringColor = '#f59e0b'; // amber

  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      className="shrink-0 -rotate-90"
    >
      {/* Track */}
      <circle
        cx="28"
        cy="28"
        r={COUNTDOWN_RING_R}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="3"
      />
      {/* Arc */}
      <motion.circle
        cx="28"
        cy="28"
        r={COUNTDOWN_RING_R}
        fill="none"
        stroke={ringColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={COUNTDOWN_RING_C}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.4, ease: 'linear' }}
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4. ACTIVE SIGNAL CARD — THE HERO
   ═══════════════════════════════════════════════════════════════ */
function ActiveSignalCard() {
  const pendingSignal = useStore((s) => s.pendingSignal);
  const lastPrices = useStore((s) => s.lastPrices);
  const { fullLocal } = useClock();
  const [countdown, setCountdown] = useState(() => 60 - new Date().getSeconds());

  const displayLogics = useMemo(() => {
    if (!pendingSignal) return [];
    const all = pendingSignal.logics?.length ? pendingSignal.logics : [pendingSignal.logic];
    return all.slice(0, 4);
  }, [pendingSignal]);

  const currentPrice = pendingSignal
    ? lastPrices[pendingSignal.pair] ?? pendingSignal.price
    : 0;
  const decimals = priceDecimalsDisplay(currentPrice);

  useEffect(() => {
    if (!pendingSignal) return;
    const interval = setInterval(() => {
      const now = new Date();
      setCountdown(60 - now.getSeconds());
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingSignal]);

  if (!pendingSignal) return null;

  const isUp = pendingSignal.dir === 'UP';
  const dirLabel = isUp ? 'CALL' : 'PUT';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pendingSignal.id}
        variants={signalScale}
        initial="initial"
        animate="animate"
        exit="exit"
        className={cn(
          'relative rounded-2xl border overflow-hidden',
          isUp
            ? 'border-emerald-500/20 animate-signal-breathe'
            : 'border-rose-500/20 animate-signal-breathe-red'
        )}
        style={{
          background: isUp
            ? 'linear-gradient(180deg, rgba(16,185,129,0.06) 0%, rgba(16,185,129,0.01) 40%, rgba(10,14,23,0.95) 100%)'
            : 'linear-gradient(180deg, rgba(244,63,94,0.06) 0%, rgba(244,63,94,0.01) 40%, rgba(10,14,23,0.95) 100%)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* ── Top accent line (thick gradient) ── */}
        <div
          className={cn(
            'absolute left-0 right-0 top-0 h-1',
            isUp
              ? 'bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent'
              : 'bg-gradient-to-r from-transparent via-rose-500/60 to-transparent'
          )}
        />

        <div className="p-5 sm:p-7">
          {/* ── Row 1: Pair Name + Direction Badge ── */}
          <div className="flex items-start justify-between gap-4 mb-5">
            {/* Pair */}
            <div className="min-w-0">
              <h2 className="text-3xl sm:text-4xl font-black font-mono text-white tracking-wide leading-none">
                {formatPair(pendingSignal.pair)}
              </h2>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-muted-foreground/40" />
                <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/40 uppercase">
                  Pattern Signal Detected
                </span>
              </div>
            </div>

            {/* Direction Badge — Large pill */}
            <div
              className={cn(
                'flex items-center gap-2 rounded-xl border px-4 py-2.5 shrink-0',
                isUp
                  ? 'border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                  : 'border-rose-500/20 bg-rose-500/10 shadow-[0_0_12px_rgba(244,63,94,0.1)]'
              )}
            >
              {isUp ? (
                <ChevronUp className="h-5 w-5 text-emerald-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-rose-400" />
              )}
              <span
                className={cn(
                  'text-base font-mono font-black tracking-wider',
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {dirLabel}
              </span>
            </div>
          </div>

          {/* ── Row 2: Pattern Logic Tags ── */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {displayLogics.map((logic, idx) => (
              <span
                key={idx}
                className="rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-2.5 py-1 text-[10px] font-mono font-semibold tracking-wider text-amber-400"
              >
                {logic}
              </span>
            ))}
            {/* Expiry Badge */}
            <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] font-mono font-semibold tracking-wider text-emerald-400">
              1M EXPIRY
            </span>
            {/* Score Badge */}
            <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] font-mono font-semibold tracking-wider text-emerald-400">
              {pendingSignal.score}/10
            </span>
          </div>

          {/* ── Row 3: Entry Price ── */}
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                isUp ? 'bg-emerald-500/10' : 'bg-rose-500/10'
              )}
            >
              <span className="text-[10px] font-mono font-bold text-muted-foreground/50">$</span>
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/40 uppercase">
                Entry Price
              </p>
              <p className="text-lg font-mono font-black text-white tracking-wider tabular-nums">
                {currentPrice.toFixed(decimals)}
              </p>
            </div>
          </div>

          {/* ── Row 4: Entry Time + Countdown ── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            {/* Entry Time — LARGE display */}
            <div className="flex items-center gap-4 flex-1">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl',
                  isUp ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                )}
              >
                <Clock
                  className={cn('h-5 w-5', isUp ? 'text-emerald-400' : 'text-rose-400')}
                />
              </div>
              <div>
                <p className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/40 uppercase">
                  Entry Time
                </p>
                <p className="text-3xl font-mono font-black text-white tracking-wider tabular-nums leading-none mt-1">
                  {pendingSignal.entryStr}
                </p>
              </div>
            </div>

            {/* Countdown — LARGE display with ring */}
            <div className="flex items-center gap-4">
              <CountdownRing seconds={countdown} total={60} />
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <p className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/40 uppercase">
                    Expires In
                  </p>
                </div>
                <p
                  className={cn(
                    'text-3xl font-mono font-black tabular-nums leading-none',
                    countdown > 10
                      ? 'text-emerald-400'
                      : countdown > 4
                        ? 'text-amber-400'
                        : 'text-rose-400'
                  )}
                >
                  {countdown}s
                </p>
              </div>
            </div>
          </div>

          {/* ── Row 5: Waiting for Result Banner ── */}
          <AnimatePresence>
            {countdown === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mt-5 flex items-center justify-center gap-2.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.05] px-4 py-3"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                </span>
                <span className="text-[12px] font-mono font-bold tracking-wider text-amber-400 animate-pulse">
                  WAITING FOR RESULT
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. PLACEHOLDER CARD (NO ACTIVE SIGNAL)
   ═══════════════════════════════════════════════════════════════ */
function PlaceholderCard() {
  const running = useStore((s) => s.running);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card flex flex-col items-center justify-center py-20 sm:py-24 relative overflow-hidden"
    >
      {/* Background radial glow */}
      {running && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-48 rounded-full bg-emerald-500/[0.04] blur-3xl animate-pulse" />
        </div>
      )}

      {/* Pulse rings */}
      <div className="relative mb-8">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-20 w-20 rounded-full border border-emerald-500/[0.08] animate-scan-pulse" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="h-20 w-20 rounded-full border border-emerald-500/[0.08] animate-scan-pulse"
            style={{ animationDelay: '0.6s' }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="h-20 w-20 rounded-full border border-emerald-500/[0.06] animate-scan-pulse"
            style={{ animationDelay: '1.2s' }}
          />
        </div>

        {/* Search Icon with glow */}
        <div
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-2xl',
            running
              ? 'bg-emerald-500/10 shadow-[0_0_24px_rgba(16,185,129,0.15)]'
              : 'bg-white/[0.03]'
          )}
        >
          <Search
            className={cn(
              'h-7 w-7',
              running ? 'text-emerald-400' : 'text-muted-foreground/25'
            )}
          />
        </div>
      </div>

      <motion.p
        animate={running ? { opacity: [0.7, 1, 0.7] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        className={cn(
          'text-sm font-mono font-bold tracking-wider',
          running ? 'text-emerald-400/80' : 'text-muted-foreground/40'
        )}
      >
        {running ? 'SCANNING MARKET...' : 'ENGINE OFFLINE'}
      </motion.p>
      <p className="mt-2 text-[11px] font-mono text-muted-foreground/30">
        {running
          ? 'Analyzing candle patterns across selected pairs'
          : 'Start the signal engine to begin scanning'}
      </p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6. RECENT SIGNALS LIST
   ═══════════════════════════════════════════════════════════════ */
function RecentSignalsList() {
  const history = useStore((s) => s.history);

  const recentHistory = useMemo(() => history.slice(0, 20), [history]);

  if (recentHistory.length === 0) return null;

  const resultColorMap: Record<string, string> = {
    WIN: 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400',
    MTG: 'border-amber-500/20 bg-amber-500/[0.07] text-amber-400',
    LOSS: 'border-rose-500/20 bg-rose-500/[0.07] text-rose-400',
  };

  const resultDotColor: Record<string, string> = {
    WIN: 'bg-emerald-400',
    MTG: 'bg-amber-400',
    LOSS: 'bg-rose-400',
  };

  return (
    <motion.div
      custom={2}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="glass-card p-5 sm:p-6"
    >
      {/* Section Header */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
          Recent Signals
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
        <span className="text-[10px] font-mono text-muted-foreground/30">
          {recentHistory.length} shown
        </span>
      </div>

      {/* Scrollable List */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="max-h-96 overflow-y-auto space-y-1.5"
      >
        {recentHistory.map((entry, i) => (
          <motion.div
            key={entry.id}
            custom={i}
            variants={rowFadeIn}
            className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.05] transition-colors cursor-default"
          >
            {/* Direction Icon */}
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg shrink-0',
                entry.dir === 'UP'
                  ? 'bg-emerald-500/[0.12]'
                  : 'bg-rose-500/[0.12]'
              )}
            >
              {entry.dir === 'UP' ? (
                <ChevronUp className="h-4 w-4 text-emerald-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-rose-400" />
              )}
            </div>

            {/* Pair Name */}
            <span className="text-xs font-mono font-semibold text-white/80 shrink-0 w-20 sm:w-24">
              {formatPair(entry.pair)}
            </span>

            {/* Primary Logic (truncated) */}
            <span className="text-[10px] font-mono text-amber-400/70 truncate flex-1 min-w-0">
              {entry.logic}
            </span>

            {/* Entry Time */}
            <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0 hidden sm:block">
              {entry.entryStr}
            </span>

            {/* Score */}
            <span className="text-[10px] font-mono text-muted-foreground/30 shrink-0 hidden sm:block tabular-nums">
              {entry.score}
            </span>

            {/* Result Badge */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={cn(
                  'inline-flex items-center justify-center h-1.5 w-1.5 rounded-full',
                  resultDotColor[entry.result] || 'bg-muted-foreground/30'
                )}
              />
              <span
                className={cn(
                  'rounded-md border px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider',
                  resultColorMap[entry.result] || resultColorMap.LOSS
                )}
              >
                {entry.result}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIGNALS PAGE (EXPORT)
   ═══════════════════════════════════════════════════════════════ */
export default function SignalsPage() {
  const pendingSignal = useStore((s) => s.pendingSignal);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <PageHeader />

      {/* Live Status Banner */}
      <LiveStatusBanner />

      {/* Active Signal or Placeholder */}
      <AnimatePresence mode="wait">
        {pendingSignal ? (
          <ActiveSignalCard key="signal" />
        ) : (
          <PlaceholderCard key="placeholder" />
        )}
      </AnimatePresence>

      {/* Recent Signals */}
      <RecentSignalsList />
    </div>
  );
}
