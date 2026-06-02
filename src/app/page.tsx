'use client';

import { Header } from '@/components/layout/Header';
import { TickerBar } from '@/components/layout/TickerBar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DesktopSidebar } from '@/components/layout/DesktopSidebar';
import DashboardPage from '@/components/dashboard/DashboardPage';
import ChartPage from '@/components/chart/ChartPage';
import SettingsPage from '@/components/settings/SettingsPage';
import SignalsPage from '@/components/signals/SignalsPage';
import HistoryPage from '@/components/history/HistoryPage';
import ProfilePage from '@/components/profile/ProfilePage';
import { useStore } from '@/lib/store';
import { useSignalEngine } from '@/hooks/use-signal-engine';

export default function Home() {
  const currentTab = useStore((s) => s.currentTab);

  // Initialize the signal scanning engine
  useSignalEngine();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />
      <TickerBar />

      <div className="flex flex-1 overflow-hidden">
        <DesktopSidebar />

        {/* Main Content */}
        <main className="flex-1 overflow-hidden lg:pl-60">
          <div className="h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 pb-20 lg:pb-6">
            {currentTab === 'dashboard' && <DashboardPage />}
            {currentTab === 'chart' && (
              <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-5 lg:-mx-0 lg:-mt-0 h-full min-h-0">
                <ChartPage />
              </div>
            )}
            {currentTab === 'signal' && <SignalsPage />}
            {currentTab === 'history' && <HistoryPage />}
            {currentTab === 'setup' && <SettingsPage />}
            {currentTab === 'profile' && <ProfilePage />}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
