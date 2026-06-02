'use client';

import {
  LayoutDashboard,
  BarChart3,
  Target,
  History,
  Settings,
  User,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'dashboard', label: 'DASH', icon: LayoutDashboard },
  { id: 'chart', label: 'CHART', icon: BarChart3 },
  { id: 'signal', label: 'SIGNAL', icon: Target },
  { id: 'history', label: 'HISTORY', icon: History },
  { id: 'setup', label: 'SETUP', icon: Settings },
  { id: 'profile', label: 'PROFILE', icon: User },
] as const;

export function BottomNav() {
  const currentTab = useStore((s) => s.currentTab);
  const setCurrentTab = useStore((s) => s.setCurrentTab);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#080d17]/96 backdrop-blur-xl pb-safe lg:hidden">
      <div className="flex h-14 items-center justify-around">
        {TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors',
                isActive ? 'text-emerald-400' : 'text-muted-foreground/50'
              )}
            >
              {/* Active top accent bar */}
              {isActive && (
                <span className="absolute -top-[1px] left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-emerald-400" />
              )}

              <Icon className={cn('h-5 w-5', isActive && 'drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]')} />
              <span className="text-[9px] font-mono font-semibold tracking-wider">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
