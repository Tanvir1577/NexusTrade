'use client';

import {
  LayoutDashboard,
  BarChart3,
  Target,
  History,
  Settings,
  User,
  Zap,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chart', label: 'Chart', icon: BarChart3 },
  { id: 'signal', label: 'Signal', icon: Target },
  { id: 'history', label: 'History', icon: History },
  { id: 'setup', label: 'Settings', icon: Settings },
  { id: 'profile', label: 'Profile', icon: User },
] as const;

export function DesktopSidebar() {
  const currentTab = useStore((s) => s.currentTab);
  const setCurrentTab = useStore((s) => s.setCurrentTab);
  const stats = useStore((s) => s.stats);
  const profile = useStore((s) => s.profile);

  const total = stats.win + stats.mtg + stats.loss;
  const winRate = total > 0 ? ((stats.win + stats.mtg) / total) * 100 : 0;

  return (
    <aside className="fixed left-0 top-14 bottom-0 z-30 hidden w-60 flex-col border-r border-white/[0.04] bg-[#070b14] lg:flex">
      <div className="flex flex-1 flex-col">
        {/* ── Brand Block ── */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10"
              style={{
                boxShadow:
                  'inset 0 0 0 1px rgba(16,185,129,0.22), 0 0 18px rgba(16,185,129,0.1)',
              }}
            >
              <Zap className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.45)]" />
            </div>
            <div>
              <p className="text-[14px] font-black tracking-[0.14em] text-white/90">
                Nexus<span className="text-emerald-400">Trade</span>{' '}
                <span className="text-white/35">Pro</span>
              </p>
              <p className="text-[9px] font-mono tracking-[0.22em] text-white/20">
                Signal Terminal
              </p>
            </div>
          </div>
        </div>

        {/* ── Session Mini-Stats Card ── */}
        <div className="mx-4 mb-4 rounded-xl border border-white/[0.06] bg-[#0a0f1c]/80 p-3.5">
          <p className="mb-2.5 text-[9px] font-mono font-semibold tracking-[0.18em] text-white/25">
            SESSION STATS
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Wins */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[13px] font-mono font-bold tabular-nums text-emerald-400">
                  {stats.win}
                </span>
                <span className="text-[8px] font-mono tracking-[0.16em] text-white/20">
                  W
                </span>
              </div>

              {/* Draws (MTG) */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[13px] font-mono font-bold tabular-nums text-amber-500">
                  {stats.mtg}
                </span>
                <span className="text-[8px] font-mono tracking-[0.16em] text-white/20">
                  M
                </span>
              </div>

              {/* Losses */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[13px] font-mono font-bold tabular-nums text-rose-500">
                  {stats.loss}
                </span>
                <span className="text-[8px] font-mono tracking-[0.16em] text-white/20">
                  L
                </span>
              </div>
            </div>

            {/* Win rate pill */}
            <div className="rounded-lg bg-emerald-500/10 px-2.5 py-1">
              <span className="text-[12px] font-mono font-bold tabular-nums text-emerald-400">
                {winRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* ── Gradient separator ── */}
        <div className="mx-4 mb-2 h-px bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-transparent" />

        {/* ── Navigation Items ── */}
        <nav className="flex-1 space-y-1 px-3 pt-2">
          {NAV_ITEMS.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={cn(
                  'group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all duration-200',
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-white/30 hover:bg-white/[0.03] hover:text-white/60',
                )}
                style={
                  isActive
                    ? {
                        boxShadow:
                          'inset 0 0 0 1px rgba(16,185,129,0.18)',
                      }
                    : undefined
                }
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] transition-all duration-200',
                    isActive &&
                      'drop-shadow-[0_0_8px_rgba(16,185,129,0.45)]',
                  )}
                />
                <span className="text-[13px] font-medium">{item.label}</span>

                {/* Spring-animated active indicator dot */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-dot"
                    className="absolute right-3.5 h-1.5 w-1.5 rounded-full bg-emerald-400"
                    style={{
                      boxShadow: '0 0 8px rgba(16,185,129,0.6)',
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Bottom: User Profile ── */}
        <div className="relative">
          {/* Gradient separator above profile */}
          <div className="mx-4 h-px bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-transparent" />
          <div className="p-4 pt-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/8"
                style={{
                  boxShadow:
                    'inset 0 0 0 1px rgba(255,255,255,0.06)',
                }}
              >
                <User className="h-3.5 w-3.5 text-white/50" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs font-semibold text-white/65">
                  {profile.name}
                </p>
                <p className="truncate text-[10px] font-mono tracking-wider text-white/20">
                  {profile.role}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
