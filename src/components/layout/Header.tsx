'use client';

import { useClock } from '@/hooks/use-clock';
import { useStore } from '@/lib/store';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const { utc, fullLocal } = useClock();
  const running = useStore((s) => s.running);

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-white/[0.06] bg-[#080d17]/85 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]">
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="text-sm font-bold tracking-[0.15em] text-white/90">
            NEXUSTRADE <span className="text-emerald-400">PRO</span>
          </span>
        </div>

        {/* Right: Status + Clock */}
        <div className="flex items-center gap-4">
          {/* Live Status */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  'absolute inline-flex h-full w-full rounded-full opacity-75',
                  running
                    ? 'animate-ping bg-emerald-400'
                    : 'animate-ping bg-red-400'
                )}
              />
              <span
                className={cn(
                  'relative inline-flex h-2 w-2 rounded-full',
                  running ? 'bg-emerald-500' : 'bg-red-500'
                )}
              />
            </span>
            <span
              className={cn(
                'text-[10px] font-mono font-semibold tracking-wider',
                running ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {running ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-white/[0.06]" />

          {/* Clock */}
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono tracking-wider text-muted-foreground/60">UTC</span>
              <span className="text-[11px] font-mono font-semibold tabular-nums text-white/80">
                {utc}
              </span>
            </div>
            <div className="h-4 w-px bg-white/[0.06]" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono tracking-wider text-muted-foreground/60">LOCAL</span>
              <span className="text-[11px] font-mono font-semibold tabular-nums text-white/80">
                {fullLocal}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
