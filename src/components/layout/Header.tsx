'use client';

import { useClock } from '@/hooks/use-clock';
import { useStore } from '@/lib/store';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const { utc, fullLocal } = useClock();
  const running = useStore((s) => s.running);

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-white/[0.04] bg-[#070b14]/90 backdrop-blur-2xl">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* ── Left: Brand ── */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10"
            style={{
              boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.22), 0 0 16px rgba(16,185,129,0.08)',
            }}
          >
            <Zap className="h-[18px] w-[18px] text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.45)]" />
          </div>
          <div className="flex items-baseline gap-0.5 select-none">
            <span className="text-[13px] font-black tracking-[0.18em] text-white/90">
              NEXUS
            </span>
            <span className="text-[13px] font-black tracking-[0.18em] text-emerald-400">
              TRADE
            </span>
          </div>
        </div>

        {/* ── Center: (reserved / empty) ── */}

        {/* ── Right: Status + Clock ── */}
        <div className="flex items-center gap-4">
          {/* Live / Offline indicator */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  'absolute inline-flex h-full w-full rounded-full opacity-75',
                  running
                    ? 'animate-ping bg-emerald-400'
                    : 'animate-ping bg-rose-400',
                )}
              />
              <span
                className={cn(
                  'relative inline-flex h-2 w-2 rounded-full',
                  running ? 'bg-emerald-500' : 'bg-rose-500',
                )}
              />
            </span>
            <span
              className={cn(
                'text-[10px] font-mono font-semibold tracking-[0.16em]',
                running ? 'text-emerald-400' : 'text-rose-500',
              )}
            >
              {running ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-white/[0.06]" />

          {/* Clock cluster */}
          <div className="hidden items-center gap-3 sm:flex">
            {/* UTC */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-medium tracking-[0.12em] text-white/25">
                UTC
              </span>
              <span className="min-w-[52px] text-[11px] font-mono font-semibold tabular-nums tracking-wide text-white/75">
                {utc}
              </span>
            </div>

            <div className="h-3.5 w-px bg-white/[0.06]" />

            {/* Local */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-medium tracking-[0.12em] text-white/25">
                LOCAL
              </span>
              <span className="min-w-[100px] text-[11px] font-mono font-semibold tabular-nums tracking-wide text-white/75">
                {fullLocal}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
