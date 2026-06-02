'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Trash2,
  Trophy,
  Minus,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  BarChart3,
} from 'lucide-react';
import { useStore, formatPair, type HistoryEntry } from '@/lib/store';
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
   1. WIN RATE DONUT + STATS
   ═══════════════════════════════════════════ */
function WinRateDonut() {
  const allTimeStats = useStore((s) => s.allTimeStats);

  const total = allTimeStats.win + allTimeStats.mtg + allTimeStats.loss;
  const winRate = total > 0 ? ((allTimeStats.win + allTimeStats.mtg) / total) * 100 : 0;

  const winPct = total > 0 ? (allTimeStats.win / total) * 100 : 0;
  const mtgPct = total > 0 ? (allTimeStats.mtg / total) * 100 : 0;

  const conicGradient = total > 0
    ? `conic-gradient(#10b981 0% ${winPct}%, #3b82f6 ${winPct}% ${winPct + mtgPct}%, rgba(255,255,255,0.05) ${winPct + mtgPct}% 100%)`
    : `conic-gradient(rgba(255,255,255,0.05) 0% 100%)`;

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut */}
        <div className="relative flex shrink-0 items-center justify-center">
          <div
            className="h-36 w-36 rounded-full transition-all duration-700"
            style={{ background: conicGradient }}
          >
            <div className="absolute inset-[6px] rounded-full bg-[#0a0e17] flex flex-col items-center justify-center">
              <span className="font-mono font-black text-2xl tabular-nums text-white">
                {winRate.toFixed(1)}
              </span>
              <span className="text-[9px] font-mono tracking-wider text-muted-foreground/40">
                WIN RATE
              </span>
            </div>
          </div>
        </div>

        {/* Side Stats */}
        <div className="flex-1 w-full space-y-3">
          {/* Stat Rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-emerald-500/10 bg-emerald-500/[0.03] px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-mono text-muted-foreground/60">Win</span>
              </div>
              <span className="font-mono font-bold tabular-nums text-emerald-400">
                {allTimeStats.win}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-blue-500/10 bg-blue-500/[0.03] px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-[11px] font-mono text-muted-foreground/60">MTG</span>
              </div>
              <span className="font-mono font-bold tabular-nums text-blue-400">
                {allTimeStats.mtg}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-red-500/10 bg-red-500/[0.03] px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-[11px] font-mono text-muted-foreground/60">Loss</span>
              </div>
              <span className="font-mono font-bold tabular-nums text-red-400">
                {allTimeStats.loss}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
              <span className="text-[11px] font-mono text-muted-foreground/60">Total</span>
              <span className="font-mono font-bold tabular-nums text-white/70">
                {total}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   2. ACTION BUTTONS + FILTER BUTTONS
   ═══════════════════════════════════════════ */
type FilterType = 'ALL' | 'WIN' | 'LOSS' | 'MTG';

function HistoryControls({
  filter,
  setFilter,
}: {
  filter: FilterType;
  setFilter: (f: FilterType) => void;
}) {
  const clearHistory = useStore((s) => s.clearHistory);
  const exportHistoryCSV = useStore((s) => s.exportHistoryCSV);

  const filters: { type: FilterType; label: string; colorClass: string }[] = [
    { type: 'ALL', label: 'ALL', colorClass: 'text-white/70 border-current' },
    { type: 'WIN', label: 'WIN', colorClass: 'text-emerald-400 border-current' },
    { type: 'LOSS', label: 'LOSS', colorClass: 'text-red-400 border-current' },
    { type: 'MTG', label: 'MTG', colorClass: 'text-blue-400 border-current' },
  ];

  const handleExport = () => {
    const csv = exportHistoryCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexustrade-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Filter Buttons */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.type}
            onClick={() => setFilter(f.type)}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-[11px] font-mono font-semibold tracking-wider transition-all',
              filter === f.type
                ? `${f.colorClass} bg-white/5`
                : 'border-white/[0.06] text-muted-foreground/30 hover:text-muted-foreground/50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500/30 px-3 py-2.5 text-[11px] font-mono font-semibold tracking-wider text-emerald-400 transition-all hover:bg-emerald-500/5"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
        <button
          onClick={() => clearHistory()}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/30 px-3 py-2.5 text-[11px] font-mono font-semibold tracking-wider text-red-400 transition-all hover:bg-red-500/5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear History
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   3. TRADE HISTORY LIST
   ═══════════════════════════════════════════ */
function TradeHistoryList({ filter }: { filter: FilterType }) {
  const history = useStore((s) => s.history);
  const tzDateStr = useStore((s) => s.tzDateStr);

  const filteredHistory = useMemo(() => {
    if (filter === 'ALL') return history;
    return history.filter((h) => h.result === filter);
  }, [history, filter]);

  const resultBadgeClass: Record<string, string> = {
    WIN: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    MTG: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
    LOSS: 'border-red-500/20 bg-red-500/10 text-red-400',
    WAIT: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  };

  const resultIconMap: Record<string, typeof Trophy> = {
    WIN: Trophy,
    MTG: Minus,
    LOSS: TrendingDown,
  };

  const resultRowBg: Record<string, string> = {
    WIN: 'bg-emerald-500/[0.03]',
    MTG: 'bg-blue-500/[0.03]',
    LOSS: 'bg-red-500/[0.03]',
  };

  return (
    <div className="glass-card p-5 sm:p-6">
      {/* Section Divider */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
          Trade History
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
        <span className="text-[10px] font-mono text-muted-foreground/30">
          {filteredHistory.length} trades
        </span>
      </div>

      {/* Scrollable List */}
      <div className="max-h-[500px] overflow-y-auto space-y-2">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.03]">
              <BarChart3 className="h-5 w-5 text-muted-foreground/20" />
            </div>
            <p className="text-[11px] font-mono text-muted-foreground/30">
              {filter === 'ALL' ? 'No trade history yet' : `No ${filter} trades found`}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground/20">
              {filter === 'ALL' ? 'Start trading to see your results here' : 'Try a different filter'}
            </p>
          </div>
        ) : (
          filteredHistory.map((entry, i) => {
            const Icon = resultIconMap[entry.result] || Trophy;
            const rowBg = resultRowBg[entry.result] || '';

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02, duration: 0.25 }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-white/[0.06] px-4 py-3 transition-colors hover:bg-white/[0.02]',
                  rowBg
                )}
              >
                {/* Left: Colored Icon */}
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                    entry.result === 'WIN' && 'bg-emerald-500/10',
                    entry.result === 'MTG' && 'bg-blue-500/10',
                    entry.result === 'LOSS' && 'bg-red-500/10'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5',
                      entry.result === 'WIN' && 'text-emerald-400',
                      entry.result === 'MTG' && 'text-blue-400',
                      entry.result === 'LOSS' && 'text-red-400'
                    )}
                  />
                </div>

                {/* Middle: Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white/80">
                      {formatPair(entry.pair)}
                    </span>
                    {entry.dir === 'UP' ? (
                      <ChevronUp className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-red-400" />
                    )}
                    <span className="text-[10px] font-mono text-amber-400/70 truncate">
                      {entry.logic}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/40">
                    {entry.time ? tzDateStr(new Date(entry.time)) : '—'}
                  </p>
                </div>

                {/* Right: Result Badge */}
                <span
                  className={cn(
                    'shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider',
                    resultBadgeClass[entry.result] || resultBadgeClass.WAIT
                  )}
                >
                  {entry.result}
                </span>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   HISTORY PAGE (EXPORT)
   ═══════════════════════════════════════════ */
export default function HistoryPage() {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const stats = useStore((s) => s.stats);

  const total = stats.win + stats.mtg + stats.loss;

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
            <span className="text-emerald-400">HISTORY</span>
          </h1>
        </div>
        <p className="text-[11px] font-mono text-muted-foreground/40">
          Trade performance and signal records
        </p>
      </motion.div>

      {/* Win Rate Donut */}
      <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
        <WinRateDonut />
      </motion.div>

      {/* Controls */}
      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
        <HistoryControls filter={filter} setFilter={setFilter} />
      </motion.div>

      {/* Trade History List */}
      <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
        <TradeHistoryList filter={filter} />
      </motion.div>
    </motion.div>
  );
}
