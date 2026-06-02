'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Globe,
  Shield,
  Activity,
  ChevronUp,
  ChevronDown,
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
    <motion.div
      custom={0}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="settings-card-emerald p-5 sm:p-6"
    >
      {/* Section Title */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
          <Zap className="h-4 w-4 text-emerald-400" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-emerald-400 uppercase">
          Engine Control
        </span>
      </div>

      {/* Engine Status + Actions */}
      {!running ? (
        <div className="space-y-4">
          <button
            onClick={() => setRunning(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl h-11 bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-500/25 text-sm font-bold tracking-wider uppercase text-white transition-all hover:shadow-emerald-500/35 active:scale-[0.98]"
          >
            <Zap className="h-4 w-4" />
            START ENGINE
          </button>
          <div className="flex justify-center">
            <span className="text-[10px] font-mono tracking-[0.15em] text-emerald-400/70">
              {ALL_PAIRS.length} PAIRS AVAILABLE
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active Pill */}
          <div className="flex items-center justify-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-mono font-bold tracking-wider text-emerald-400">
              ENGINE ACTIVE — {selectedPairs.length} PAIRS
            </span>
          </div>
          <button
            onClick={() => setRunning(false)}
            className="flex w-full items-center justify-center gap-2 rounded-xl h-11 bg-gradient-to-r from-red-600 to-red-500 shadow-lg shadow-red-500/20 text-sm font-bold tracking-wider uppercase text-white transition-all hover:shadow-red-500/30 active:scale-[0.98]"
          >
            <Shield className="h-4 w-4" />
            STOP ENGINE
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   2. CURRENCY PAIRS CARD
   ═══════════════════════════════════════════ */
const PAIR_GROUPS: { label: string; pairs: readonly string[] }[] = [
  { label: 'EUR', pairs: ['EUR_USD', 'EUR_JPY', 'EUR_CHF', 'EUR_AUD', 'EUR_CAD', 'EUR_GBP'] },
  { label: 'GBP', pairs: ['GBP_USD', 'GBP_JPY', 'GBP_AUD', 'GBP_CAD', 'GBP_CHF'] },
  { label: 'AUD', pairs: ['AUD_USD', 'AUD_JPY', 'AUD_CAD', 'AUD_CHF'] },
  { label: 'USD', pairs: ['USD_JPY', 'USD_CAD', 'USD_CHF'] },
  { label: 'Cross', pairs: ['CAD_JPY', 'CHF_JPY'] },
];

function CurrencyPairsCard() {
  const selectedPairs = useStore((s) => s.selectedPairs);
  const togglePair = useStore((s) => s.togglePair);
  const setSelectedPairs = useStore((s) => s.setSelectedPairs);

  const allSelected = ALL_PAIRS.every((p) => selectedPairs.includes(p));

  return (
    <motion.div
      custom={1}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="settings-card-blue p-5 sm:p-6"
    >
      {/* Section Title */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
          <Activity className="h-4 w-4 text-blue-400" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-blue-400 uppercase">
          Currency Pairs
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground/40">
          {selectedPairs.length}/{ALL_PAIRS.length}
        </span>
      </div>

      {/* Pair Groups */}
      <div className="space-y-4">
        {PAIR_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.15em]">
              {group.label}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {group.pairs.map((pair) => {
                const isActive = selectedPairs.includes(pair);
                return (
                  <button
                    key={pair}
                    onClick={() => togglePair(pair)}
                    className={cn(
                      'min-w-[80px] rounded-lg border px-3 py-2 text-xs font-mono text-center transition-all duration-200',
                      isActive
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]'
                        : 'border-white/[0.05] text-muted-foreground/50 hover:border-white/[0.1] hover:text-muted-foreground/70'
                    )}
                  >
                    {formatPair(pair)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Select All / Deselect All */}
      <div className="mt-5 flex gap-2">
        <button
          onClick={() => setSelectedPairs([...ALL_PAIRS])}
          className={cn(
            'flex-1 rounded-lg border px-3 py-2 text-[11px] font-mono font-semibold tracking-wider transition-all',
            allSelected
              ? 'border-white/[0.06] text-muted-foreground/30'
              : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/5'
          )}
        >
          SELECT ALL
        </button>
        <button
          onClick={() => setSelectedPairs([])}
          className={cn(
            'flex-1 rounded-lg border px-3 py-2 text-[11px] font-mono font-semibold tracking-wider transition-all',
            selectedPairs.length === 0
              ? 'border-white/[0.06] text-muted-foreground/30'
              : 'border-red-500/20 text-red-400 hover:bg-red-500/5'
          )}
        >
          DESELECT ALL
        </button>
      </div>
    </motion.div>
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
    <motion.div
      custom={2}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="settings-card-cyan p-5 sm:p-6"
    >
      {/* Section Title */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
          <Shield className="h-4 w-4 text-cyan-400" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-cyan-400 uppercase">
          Signal Configuration
        </span>
      </div>

      <div className="space-y-6">
        {/* Minimum Pattern Score */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
              Minimum Pattern Score
            </label>
            <span className="rounded-md bg-emerald-500/10 px-2.5 py-0.5 text-sm font-mono font-bold text-emerald-400 tabular-nums">
              {minScore}/10
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-full h-1.5 appearance-none rounded-full bg-white/5 cursor-pointer accent-emerald-500
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(16,185,129,0.4)] [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-[0_0_8px_rgba(16,185,129,0.4)] [&::-moz-range-thumb]:cursor-pointer"
          />
          <div className="mt-2 flex justify-between">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'text-[9px] font-mono',
                  i + 1 === minScore ? 'text-emerald-400 font-bold' : 'text-muted-foreground/20'
                )}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>

        {/* Martingale Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
              One-Step Martingale
            </label>
            <p className="mt-1 text-[11px] font-mono text-muted-foreground/40">
              Auto-retry on loss with 2.5x multiplier
            </p>
          </div>
          <button
            onClick={() => setMtgEnabled(!mtgEnabled)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300',
              mtgEnabled ? 'bg-emerald-500' : 'bg-white/10'
            )}
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
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   4. TIMEZONE CARD
   ═══════════════════════════════════════════ */
function TimezoneCard() {
  const tzOffset = useStore((s) => s.tzOffset);
  const setTzOffset = useStore((s) => s.setTzOffset);

  const offsets = Array.from({ length: 25 }, (_, i) => i - 12);

  const formatOffsetLabel = (offset: number) => {
    if (offset === 0) return 'UTC';
    const sign = offset >= 0 ? '+' : '-';
    const h = Math.floor(Math.abs(offset));
    return `UTC${sign}${h}`;
  };

  return (
    <motion.div
      custom={3}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="settings-card-amber p-5 sm:p-6"
    >
      {/* Section Title */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
          <Globe className="h-4 w-4 text-amber-400" />
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
          className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-4 py-2.5 text-sm font-mono text-white/90 appearance-none cursor-pointer transition-colors hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/30"
        >
          {offsets.map((offset) => (
            <option key={offset} value={offset}>
              {formatOffsetLabel(offset)}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] font-mono text-muted-foreground/40">
          All times displayed in {formatOffsetLabel(tzOffset)}
        </p>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   SETTINGS PAGE (EXPORT)
   ═══════════════════════════════════════════ */
export default function SettingsPage() {
  const resetSession = useStore((s) => s.resetSession);

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

      <EngineControlCard />
      <CurrencyPairsCard />
      <SignalSettingsCard />
      <TimezoneCard />

      {/* Reset Session Card */}
      <motion.div
        custom={4}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="glass-card p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
            Session Management
          </span>
        </div>
        <button
          onClick={() => {
            resetSession();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl h-11 border border-amber-500/20 text-sm font-bold tracking-wider uppercase text-amber-400 transition-all hover:bg-amber-500/5 active:scale-[0.98]"
        >
          Reset Session Stats
        </button>
        <p className="mt-3 text-center text-[10px] font-mono text-muted-foreground/30">
          Clears session win/loss/mtg counts — history is preserved
        </p>
      </motion.div>
    </motion.div>
  );
}
