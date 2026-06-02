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
import { useStore, formatPair } from '@/lib/store';
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
   1. WIN RATE DONUT (CSS conic-gradient)
   ═══════════════════════════════════════════ */
function WinRateDonut() {
  const allTimeStats = useStore((s) => s.allTimeStats);

  const total = allTimeStats.win + allTimeStats.mtg + allTimeStats.loss;
  const winRate = total > 0 ? ((allTimeStats.win + allTimeStats.mtg) / total) * 100 : 0;

  const winPct = total > 0 ? (allTimeStats.win / total) * 100 : 0;
  const mtgPct = total > 0 ? (allTimeStats.mtg / total) * 100 : 0;

  // WIN=emerald-500, MTG=amber-500, LOSS=rose-500
  const conicGradient = total > 0
    ? `conic-gradient(#10b981 0% ${winPct}%, #f59e0b ${winPct}% ${winPct + mtgPct}%, rgba(255,255,255,0.05) ${winPct + mtgPct}% 100%)`
    : `conic-gradient(rgba(255,255,255,0.04) 0% 100%)`;

  return (
    <div className="glass-card p-6 sm:p-8">
      {/* Section Divider */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
          Performance Overview
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
      </div>

      {/* Large centered donut */}
      <div className="flex flex-col items-center">
        <div className="relative flex shrink-0 items-center justify-center">
          <div
            className="h-44 w-44 rounded-full transition-all duration-700"
            style={{ background: conicGradient }}
          >
            <div className="absolute inset-[8px] rounded-full bg-[#0a0e17] flex flex-col items-center justify-center">
              {total > 0 ? (
                <>
                  <span className="font-mono font-black text-3xl tabular-nums text-white">
                    {winRate.toFixed(1)}
                    <span className="text-lg text-emerald-400">%</span>
                  </span>
                  <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground/40 mt-1">
                    WIN RATE
                  </span>
                </>
              ) : (
                <>
                  <span className="font-mono font-black text-2xl tabular-nums text-muted-foreground/25">
                    0.0<span className="text-base">%</span>
                  </span>
                  <span className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground/20 mt-1">
                    NO DATA
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Legend row */}
        <div className="mt-6 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-mono text-muted-foreground/60">WIN</span>
            <span className="font-mono font-bold tabular-nums text-emerald-400 text-xs">{allTimeStats.win}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="text-[11px] font-mono text-muted-foreground/60">MTG</span>
            <span className="font-mono font-bold tabular-nums text-amber-400 text-xs">{allTimeStats.mtg}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span className="text-[11px] font-mono text-muted-foreground/60">LOSS</span>
            <span className="font-mono font-bold tabular-nums text-rose-400 text-xs">{allTimeStats.loss}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground/40">TOTAL</span>
            <span className="font-mono font-bold tabular-nums text-white/60 text-xs">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   2. FILTER PILLS (ALL / WIN / LOSS / MTG)
   ═══════════════════════════════════════════ */
type FilterType = 'ALL' | 'WIN' | 'LOSS' | 'MTG';

function FilterPills({
  filter,
  setFilter,
}: {
  filter: FilterType;
  setFilter: (f: FilterType) => void;
}) {
  const filters: { type: FilterType; label: string }[] = [
    { type: 'ALL', label: 'ALL' },
    { type: 'WIN', label: 'WIN' },
    { type: 'LOSS', label: 'LOSS' },
    { type: 'MTG', label: 'MTG' },
  ];

  return (
    <div className="flex gap-2">
      {filters.map((f) => (
        <button
          key={f.type}
          onClick={() => setFilter(f.type)}
          className={cn(
            'flex-1 rounded-lg border px-3 py-2 text-[11px] font-mono font-semibold tracking-wider transition-all duration-200',
            filter === f.type
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/50 hover:border-white/[0.1]'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   3. ACTION BUTTONS (Export CSV, Clear History)
   ═══════════════════════════════════════════ */
function ActionButtons() {
  const clearHistory = useStore((s) => s.clearHistory);
  const exportHistoryCSV = useStore((s) => s.exportHistoryCSV);

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
    <div className="flex gap-2">
      <button
        onClick={handleExport}
        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500/20 px-3 py-2.5 text-[11px] font-mono font-semibold tracking-wider text-emerald-400 transition-all duration-200 hover:bg-emerald-500/5 active:scale-[0.98]"
      >
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </button>
      <button
        onClick={() => clearHistory()}
        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-500/20 px-3 py-2.5 text-[11px] font-mono font-semibold tracking-wider text-rose-400 transition-all duration-200 hover:bg-rose-500/5 active:scale-[0.98]"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear History
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   4. TRADE HISTORY LIST
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
    MTG: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    LOSS: 'border-rose-500/20 bg-rose-500/10 text-rose-400',
    WAIT: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  };

  const resultIconMap: Record<string, typeof Trophy> = {
    WIN: Trophy,
    MTG: Minus,
    LOSS: TrendingDown,
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
      <div className="max-h-96 overflow-y-auto space-y-1.5">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.03] border border-white/[0.06]">
              <BarChart3 className="h-6 w-6 text-muted-foreground/20" />
            </div>
            <p className="text-xs font-mono text-muted-foreground/40 font-semibold">
              No trade history yet
            </p>
            <p className="mt-1 text-[10px] font-mono text-muted-foreground/25">
              {filter === 'ALL'
                ? 'Start trading to see your results here'
                : `No ${filter} trades found`}
            </p>
          </div>
        ) : (
          filteredHistory.map((entry, i) => {
            const Icon = resultIconMap[entry.result] || Trophy;

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.015, duration: 0.2 }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-white/[0.04] px-4 py-3 transition-colors duration-150 hover:bg-white/[0.02]',
                  i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'
                )}
              >
                {/* Direction icon: emerald UP / rose DOWN */}
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                    entry.dir === 'UP'
                      ? 'bg-emerald-500/10'
                      : 'bg-rose-500/10'
                  )}
                >
                  {entry.dir === 'UP' ? (
                    <ChevronUp className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-rose-400" />
                  )}
                </div>

                {/* Middle: Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white/80">
                      {formatPair(entry.pair)}
                    </span>
                    <span className="text-[10px] font-mono text-amber-500/70 truncate max-w-[120px]">
                      {entry.logic}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/35">
                    {entry.time ? tzDateStr(new Date(entry.time)) : '—'}
                    <span className="ml-2 text-muted-foreground/25">
                      S:{entry.score}
                    </span>
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

      {/* Filter Pills */}
      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
        <FilterPills filter={filter} setFilter={setFilter} />
      </motion.div>

      {/* Action Buttons */}
      <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
        <ActionButtons />
      </motion.div>

      {/* Trade History List */}
      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
        <TradeHistoryList filter={filter} />
      </motion.div>
    </motion.div>
  );
}
