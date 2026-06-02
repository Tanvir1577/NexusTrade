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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.04] bg-[#070b14]/96 backdrop-blur-2xl pb-safe lg:hidden">
      <div className="flex h-14 items-center justify-around">
        {TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-200',
                isActive ? 'text-emerald-400' : 'text-white/30',
              )}
            >
              {/* Active top accent bar */}
              {isActive && (
                <span
                  className="absolute -top-px left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-emerald-400"
                  style={{
                    boxShadow: '0 0 8px rgba(16,185,129,0.5), 0 0 20px rgba(16,185,129,0.2)',
                  }}
                />
              )}

              <Icon
                className={cn(
                  'h-[20px] w-[20px] transition-all duration-200',
                  isActive && 'drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]',
                )}
              />
              <span className="text-[9px] font-mono font-semibold tracking-[0.14em]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
