'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Square,
  Zap,
  Globe,
  Shield,
  Activity,
  TimerReset,
  ChevronRight,
  CheckCheck,
  X,
} from 'lucide-react';
import { useStore, ALL_PAIRS, formatPair } from '@/lib/store';
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
   1. ENGINE CONTROL CARD
   ═══════════════════════════════════════════ */
function EngineControlCard() {
  const running = useStore((s) => s.running);
  const setRunning = useStore((s) => s.setRunning);
  const selectedPairs = useStore((s) => s.selectedPairs);

  return (
    <div className="glass-card p-5 sm:p-6">
      {/* Section Divider */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
          <Zap className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-emerald-400 uppercase">
          Engine Control
        </span>
      </div>

      {/* Large toggle button */}
      {!running ? (
        <div className="space-y-4">
          <button
            onClick={() => setRunning(true)}
            className="flex w-full items-center justify-center gap-3 rounded-xl h-14 border border-emerald-500/20 bg-white/[0.02] text-sm font-bold tracking-[0.15em] uppercase text-emerald-400 transition-all duration-300 hover:bg-emerald-500/5 hover:border-emerald-500/30 active:scale-[0.98]"
          >
            <Play className="h-5 w-5" />
            START ENGINE
          </button>
          <div className="flex justify-center gap-4">
            <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/40">
              {ALL_PAIRS.length} PAIRS AVAILABLE
            </span>
            <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/40">
              {selectedPairs.length} SELECTED
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Running state */}
          <button
            onClick={() => setRunning(false)}
            className="flex w-full items-center justify-center gap-3 rounded-xl h-14 bg-emerald-500 shadow-lg shadow-emerald-500/20 text-sm font-bold tracking-[0.15em] uppercase text-[#060a13] transition-all duration-300 hover:shadow-emerald-500/30 active:scale-[0.98]"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            ENGINE RUNNING
            <Square className="h-3.5 w-3.5 ml-1" />
          </button>
          <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.03] px-4 py-2">
            <span className="text-[10px] font-mono tracking-[0.15em] text-emerald-400/80">
              SCANNING {selectedPairs.length} PAIRS
            </span>
            <ChevronRight className="h-3 w-3 text-emerald-400/40" />
            <span className="text-[10px] font-mono tracking-[0.15em] text-emerald-300/80">
              LIVE
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   2. CURRENCY PAIRS CARD (by base currency)
   ═══════════════════════════════════════════ */
const PAIR_GROUPS: { label: string; pairs: readonly string[] }[] = [
  { label: 'EUR', pairs: ['EUR_USD', 'EUR_JPY', 'EUR_CHF', 'EUR_AUD', 'EUR_CAD', 'EUR_GBP'] },
  { label: 'GBP', pairs: ['GBP_USD', 'GBP_JPY', 'GBP_AUD', 'GBP_CAD', 'GBP_CHF'] },
  { label: 'AUD', pairs: ['AUD_USD', 'AUD_JPY', 'AUD_CAD', 'AUD_CHF'] },
  { label: 'USD', pairs: ['USD_JPY', 'USD_CAD', 'USD_CHF'] },
  { label: 'CAD', pairs: ['CAD_JPY'] },
  { label: 'CHF', pairs: ['CHF_JPY'] },
];

function CurrencyPairsCard() {
  const selectedPairs = useStore((s) => s.selectedPairs);
  const togglePair = useStore((s) => s.togglePair);

  const handleSelectAllGroup = (groupPairs: readonly string[]) => {
    const store = useStore.getState();
    const current = store.selectedPairs;
    const newPairs = [...new Set([...current, ...groupPairs])];
    store.setSelectedPairs(newPairs);
  };

  const handleDeselectAllGroup = (groupPairs: readonly string[]) => {
    const store = useStore.getState();
    const current = store.selectedPairs;
    const newPairs = current.filter((p) => !groupPairs.includes(p));
    store.setSelectedPairs(newPairs);
  };

  return (
    <div className="glass-card p-5 sm:p-6">
      {/* Section Divider */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-emerald-400 uppercase">
          Currency Pairs
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground/40 tabular-nums">
          {selectedPairs.length}/{ALL_PAIRS.length}
        </span>
      </div>

      {/* Pair Groups */}
      <div className="space-y-5">
        {PAIR_GROUPS.map((group) => {
          const allGroupSelected = group.pairs.every((p) => selectedPairs.includes(p));
          const noneGroupSelected = group.pairs.every((p) => !selectedPairs.includes(p));

          return (
            <div key={group.label}>
              {/* Group header + Select/Deselect per group */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/40 uppercase">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-white/[0.04]" />
                <button
                  onClick={() =>
                    allGroupSelected
                      ? handleDeselectAllGroup(group.pairs)
                      : handleSelectAllGroup(group.pairs)
                  }
                  className="flex items-center gap-1 text-[9px] font-mono tracking-wider text-emerald-400/50 hover:text-emerald-400/80 transition-colors"
                >
                  {allGroupSelected ? (
                    <>
                      <X className="h-2.5 w-2.5" />
                      Deselect
                    </>
                  ) : (
                    <>
                      <CheckCheck className="h-2.5 w-2.5" />
                      Select
                    </>
                  )}
                </button>
              </div>

              {/* Pair chips */}
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                {group.pairs.map((pair) => {
                  const isActive = selectedPairs.includes(pair);
                  return (
                    <button
                      key={pair}
                      onClick={() => togglePair(pair)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-[11px] font-mono text-center transition-all duration-200',
                        isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.1)]'
                          : 'bg-white/[0.02] text-white/30 border-white/[0.04] hover:border-white/[0.08] hover:text-white/40'
                      )}
                    >
                      {formatPair(pair)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   3. SIGNAL SETTINGS CARD
   ═══════════════════════════════════════════ */
function SignalSettingsCard() {
  const minScore = useStore((s) => s.minScore);
  const setMinScore = useStore((s) => s.setMinScore);
  const mtgEnabled = useStore((s) => s.mtgEnabled);
  const setMtgEnabled = useStore((s) => s.setMtgEnabled);

  return (
    <div className="glass-card p-5 sm:p-6">
      {/* Section Divider */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
          <Shield className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-emerald-400 uppercase">
          Signal Configuration
        </span>
      </div>

      <div className="space-y-6">
        {/* Min Score slider */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
              Minimum Pattern Score
            </label>
            <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-lg font-mono font-bold text-emerald-400 tabular-nums">
              {minScore}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-full h-1.5 appearance-none rounded-full bg-white/[0.06] cursor-pointer accent-emerald-500
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(16,185,129,0.4)] [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(16,185,129,0.4)] [&::-moz-range-thumb]:cursor-pointer"
          />
          <div className="mt-2 flex justify-between px-0.5">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'text-[9px] font-mono tabular-nums',
                  i + 1 === minScore
                    ? 'text-emerald-400 font-bold'
                    : 'text-muted-foreground/20'
                )}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>

        {/* MTG Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3.5">
          <div>
            <label className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
              One-Step Martingale
            </label>
            <p className="mt-1 text-[11px] font-mono text-muted-foreground/35">
              Auto-retry on loss with 2.5x multiplier
            </p>
          </div>
          <button
            onClick={() => setMtgEnabled(!mtgEnabled)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 shrink-0',
              mtgEnabled ? 'bg-emerald-500' : 'bg-white/10'
            )}
            aria-label="Toggle martingale"
          >
            <span
              className={cn(
                'inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300',
                mtgEnabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   4. TIMEZONE CARD
   ═══════════════════════════════════════════ */
function TimezoneCard() {
  const tzOffset = useStore((s) => s.tzOffset);
  const setTzOffset = useStore((s) => s.setTzOffset);
  const tzLabel = useStore((s) => s.tzLabel);

  const offsets = Array.from({ length: 25 }, (_, i) => i - 12);

  const formatOffsetLabel = (offset: number) => {
    if (offset === 0) return 'UTC';
    const sign = offset >= 0 ? '+' : '-';
    const h = Math.floor(Math.abs(offset));
    return `UTC${sign}${h}`;
  };

  return (
    <div className="glass-card p-5 sm:p-6">
      {/* Section Divider */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
          <Globe className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-amber-400 uppercase">
          Timezone
        </span>
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
          Display Timezone
        </label>
        <select
          value={tzOffset}
          onChange={(e) => setTzOffset(Number(e.target.value))}
          className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-4 py-2.5 text-sm font-mono text-white/90 appearance-none cursor-pointer transition-colors hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/30"
        >
          {offsets.map((offset) => (
            <option key={offset} value={offset}>
              {formatOffsetLabel(offset)}
            </option>
          ))}
        </select>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2">
          <span className="text-[10px] font-mono text-muted-foreground/40">Current:</span>
          <span className="text-[11px] font-mono font-bold text-emerald-400 tabular-nums">
            {tzLabel()}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   5. RESET SESSION CARD
   ═══════════════════════════════════════════ */
function ResetSessionCard() {
  const resetSession = useStore((s) => s.resetSession);
  const [confirming, setConfirming] = useState(false);

  const handleReset = () => {
    if (confirming) {
      resetSession();
      setConfirming(false);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <div className="glass-card p-5 sm:p-6">
      {/* Section Divider */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10">
          <TimerReset className="h-3.5 w-3.5 text-rose-400" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-rose-400 uppercase">
          Session Management
        </span>
      </div>

      <button
        onClick={handleReset}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl h-11 border text-sm font-bold tracking-[0.15em] uppercase transition-all duration-300 active:scale-[0.98]',
          confirming
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
            : 'border-rose-500/20 text-rose-400 hover:bg-rose-500/5'
        )}
      >
        <TimerReset className="h-4 w-4" />
        {confirming ? 'CONFIRM RESET' : 'RESET SESSION STATS'}
      </button>
      <p className="mt-3 text-center text-[10px] font-mono text-muted-foreground/30">
        {confirming
          ? 'Click again to confirm — this cannot be undone'
          : 'Clears session win/loss/mtg counts — history is preserved'}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SETTINGS PAGE (EXPORT)
   ═══════════════════════════════════════════ */
export default function SettingsPage() {
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
            <span className="text-emerald-400">SETTINGS</span>
          </h1>
        </div>
        <p className="text-[11px] font-mono text-muted-foreground/40">
          Configure your trading engine parameters
        </p>
      </motion.div>

      <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
        <EngineControlCard />
      </motion.div>
      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
        <CurrencyPairsCard />
      </motion.div>
      <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
        <SignalSettingsCard />
      </motion.div>
      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
        <TimezoneCard />
      </motion.div>
      <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
        <ResetSessionCard />
      </motion.div>
    </motion.div>
  );
}
