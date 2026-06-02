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
} from 'lucide-react';
import { useStore, formatPair, type HistoryEntry } from '@/lib/store';
import { useClock } from '@/hooks/use-clock';
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

const signalScale = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 25 } },
  exit: { scale: 0.8, opacity: 0, transition: { duration: 0.2 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

/* ═══════════════════════════════════════════
   1. LIVE STATUS BANNER
   ═══════════════════════════════════════════ */
function LiveStatusBanner() {
  const running = useStore((s) => s.running);
  const selectedPairs = useStore((s) => s.selectedPairs);

  return (
    <AnimatePresence>
      {running && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="flex items-center justify-center mb-4"
        >
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2">
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

/* ═══════════════════════════════════════════
   2. ACTIVE SIGNAL CARD
   ═══════════════════════════════════════════ */
function ActiveSignalCard() {
  const pendingSignal = useStore((s) => s.pendingSignal);
  const { fullLocal } = useClock();
  const [countdown, setCountdown] = useState(0);

  // Calculate countdown to next minute boundary
  useEffect(() => {
    if (!pendingSignal) return;
    const tick = () => {
      const now = new Date();
      const secondsLeft = 60 - now.getSeconds();
      setCountdown(secondsLeft);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [pendingSignal]);

  if (!pendingSignal) return null;

  const isUp = pendingSignal.dir === 'UP';

  return (
    <AnimatePresence>
      <motion.div
        key={pendingSignal.id}
        variants={signalScale}
        initial="initial"
        animate="animate"
        exit="exit"
        className={cn(
          'relative rounded-2xl border overflow-hidden p-5 sm:p-6',
          isUp
            ? 'border-emerald-500/20 animate-signal-breathe'
            : 'border-red-500/20 animate-signal-breathe-red'
        )}
        style={{
          background: isUp
            ? 'linear-gradient(180deg, rgba(16,185,129,0.04) 0%, rgba(10,14,23,0.9) 100%)'
            : 'linear-gradient(180deg, rgba(239,68,68,0.04) 0%, rgba(10,14,23,0.9) 100%)',
        }}
      >
        {/* Top gradient accent line */}
        <div
          className={cn(
            'absolute left-0 right-0 top-0 h-0.5',
            isUp
              ? 'bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent'
              : 'bg-gradient-to-r from-transparent via-red-500/50 to-transparent'
          )}
        />

        {/* Header: Pair + Direction */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-mono text-white tracking-wide">
              {formatPair(pendingSignal.pair)}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-[11px] font-mono text-muted-foreground/50">
              <Signal className="h-3 w-3" />
              <span>Pattern Signal</span>
            </div>
          </div>

          {/* Direction Badge */}
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5',
              isUp
                ? 'border-emerald-500/20 bg-emerald-500/10'
                : 'border-red-500/20 bg-red-500/10'
            )}
          >
            {isUp ? (
              <ChevronUp className={cn('h-4 w-4 text-emerald-400')} />
            ) : (
              <ChevronDown className={cn('h-4 w-4 text-red-400')} />
            )}
            <span
              className={cn(
                'text-sm font-mono font-bold tracking-wider',
                isUp ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {pendingSignal.dir}
            </span>
          </div>
        </div>

        {/* Tags Row */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {/* Pattern Logic */}
          <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-mono font-semibold tracking-wider text-amber-400">
            {pendingSignal.logic}
          </span>
          {/* Expiry */}
          <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-mono font-semibold tracking-wider text-cyan-400">
            1 MIN EXPIRY
          </span>
          {/* Score */}
          <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-mono font-semibold tracking-wider text-emerald-400">
            SCORE: {pendingSignal.score}/10
          </span>
        </div>

        {/* Entry Time + Countdown */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
          {/* Entry Time */}
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              isUp ? 'bg-emerald-500/10' : 'bg-red-500/10'
            )}>
              <Clock className={cn('h-4 w-4', isUp ? 'text-emerald-400' : 'text-red-400')} />
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/50 uppercase">
                Entry Time
              </p>
              <p className="text-2xl font-mono font-black text-white tracking-wider tabular-nums">
                {pendingSignal.entryStr}
              </p>
            </div>
          </div>

          {/* Countdown */}
          <div className="sm:ml-auto">
            <div className="flex items-center gap-2">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                'bg-amber-500/10'
              )}>
                <Zap className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/50 uppercase">
                  Candle Starts In
                </p>
                <p className={cn(
                  'text-2xl font-mono font-black tabular-nums',
                  countdown > 10 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {countdown}s
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Waiting for Result indicator when countdown is 0 */}
        {countdown === 0 && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            <span className="text-[11px] font-mono font-bold tracking-wider text-amber-400 animate-pulse">
              WAITING FOR RESULT
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════
   3. PLACEHOLDER CARD (NO SIGNAL)
   ═══════════════════════════════════════════ */
function PlaceholderCard() {
  const running = useStore((s) => s.running);

  return (
    <div className="glass-card flex flex-col items-center justify-center py-16 sm:py-20">
      {/* Search Icon with Pulse Rings */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-16 w-16 rounded-full border border-emerald-500/10 animate-scan-pulse" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-16 w-16 rounded-full border border-emerald-500/10 animate-scan-pulse" style={{ animationDelay: '0.7s' }} />
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]">
          <Search className={cn(
            'h-6 w-6',
            running ? 'text-emerald-400' : 'text-muted-foreground/30'
          )} />
        </div>
      </div>

      <p className={cn(
        'text-sm font-mono font-bold tracking-wider',
        running ? 'text-emerald-400/70' : 'text-muted-foreground/40'
      )}>
        {running ? 'SCANNING MARKET...' : 'ENGINE STOPPED'}
      </p>
      <p className="mt-1.5 text-[11px] font-mono text-muted-foreground/30">
        {running ? 'Waiting for high-confidence pattern signal' : 'Start the engine to begin scanning'}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════
   4. RECENT SIGNALS LIST
   ═══════════════════════════════════════════ */
function RecentSignalsList() {
  const history = useStore((s) => s.history);

  // Show only the 20 most recent
  const recentHistory = useMemo(() => history.slice(0, 20), [history]);

  if (recentHistory.length === 0) return null;

  const resultColorMap: Record<string, string> = {
    WIN: 'bg-emerald-500/70 text-emerald-400 border-emerald-500/20',
    MTG: 'bg-blue-500/70 text-blue-400 border-blue-500/20',
    LOSS: 'bg-red-500/70 text-red-400 border-red-500/20',
    WAIT: 'bg-amber-500/70 text-amber-400 border-amber-500/20',
  };

  const resultBgMap: Record<string, string> = {
    WIN: 'bg-emerald-500',
    MTG: 'bg-blue-500',
    LOSS: 'bg-red-500',
  };

  return (
    <motion.div
      custom={2}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="glass-card p-5 sm:p-6"
    >
      {/* Section Divider */}
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
      <div className="max-h-96 overflow-y-auto space-y-1.5">
        {recentHistory.map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03, duration: 0.3 }}
            className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.04] transition-colors"
          >
            {/* Direction Icon */}
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md shrink-0',
                entry.dir === 'UP'
                  ? 'bg-emerald-500/15'
                  : 'bg-red-500/15'
              )}
            >
              {entry.dir === 'UP' ? (
                <ChevronUp className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-red-400" />
              )}
            </div>

            {/* Pair Name */}
            <span className="text-xs font-mono font-semibold text-white/80 shrink-0 w-20 sm:w-24">
              {formatPair(entry.pair)}
            </span>

            {/* Logic */}
            <span className="text-[10px] font-mono text-amber-400/70 truncate flex-1">
              {entry.logic}
            </span>

            {/* Entry Time */}
            <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">
              {entry.entryStr}
            </span>

            {/* Result Badge */}
            <span
              className={cn(
                'shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider',
                resultColorMap[entry.result] || resultColorMap.WAIT
              )}
            >
              {entry.result}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   SIGNALS PAGE (EXPORT)
   ═══════════════════════════════════════════ */
export default function SignalsPage() {
  const pendingSignal = useStore((s) => s.pendingSignal);
  const running = useStore((s) => s.running);

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Page Header */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-lg font-black tracking-wider text-white">
            <span className="text-emerald-400">SIGNALS</span>
          </h1>
        </div>
        <p className="text-[11px] font-mono text-muted-foreground/40">
          Live binary options pattern signals
        </p>
      </motion.div>

      {/* Live Status Banner */}
      <LiveStatusBanner />

      {/* Active Signal or Placeholder */}
      {pendingSignal ? <ActiveSignalCard /> : <PlaceholderCard />}

      {/* Recent Signals */}
      <RecentSignalsList />
    </motion.div>
  );
}
