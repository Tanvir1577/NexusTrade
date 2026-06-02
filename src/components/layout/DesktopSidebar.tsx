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
    <aside className="fixed left-0 top-14 bottom-0 z-30 hidden w-56 flex-col border-r border-white/[0.06] bg-[#080d17] lg:flex">
      <div className="flex flex-1 flex-col">
        {/* Logo Block */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]">
              <Zap className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-black tracking-[0.12em] text-white/90">
                NEXUS<span className="text-emerald-400">TRADE</span>
              </p>
              <p className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground/40">
                PRO TERMINAL
              </p>
            </div>
          </div>
        </div>

        {/* Mini Session Stats Card */}
        <div className="mx-4 mb-4 rounded-xl border border-white/[0.06] bg-[#0c1220] p-3">
          <p className="mb-2 text-[9px] font-mono font-semibold tracking-[0.15em] text-muted-foreground/50">
            SESSION
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {stats.win}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground/40">W</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono font-bold text-blue-400">
                  {stats.mtg}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground/40">M</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono font-bold text-red-400">
                  {stats.loss}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground/40">L</span>
              </div>
            </div>
            <div className="rounded-md bg-emerald-500/10 px-2 py-0.5">
              <span className="text-[11px] font-mono font-bold text-emerald-400">
                {winRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 mb-2 h-px bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-transparent" />

        {/* Nav Items */}
        <nav className="flex-1 space-y-0.5 px-3 pt-2">
          {NAV_ITEMS.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={cn(
                  'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200',
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]'
                    : 'text-muted-foreground/50 hover:bg-white/[0.03] hover:text-white/70'
                )}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] transition-all',
                    isActive && 'drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]'
                  )}
                />
                <span className="text-[13px] font-medium">{item.label}</span>

                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute right-3 h-1.5 w-1.5 rounded-full bg-emerald-400"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: User Avatar Area */}
        <div className="border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <User className="h-3.5 w-3.5 text-white/60" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-xs font-semibold text-white/70">{profile.name}</p>
              <p className="truncate text-[10px] font-mono text-muted-foreground/40">{profile.role}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
