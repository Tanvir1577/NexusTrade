'use client';

import { useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  User,
  Check,
  BarChart3,
  Trophy,
  Flame,
  Timer,
  CalendarDays,
  TrendingUp,
  Activity,
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
   1. AVATAR SECTION
   ═══════════════════════════════════════════ */
function AvatarSection() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localName, setLocalName] = useState(profile.name);
  const [localRole, setLocalRole] = useState(profile.role);
  const [saved, setSaved] = useState(false);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setProfile({ avatar: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setProfile({ name: localName.trim() || 'TRADER', role: localRole.trim() || 'Trader' });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Get initials from name
  const initials = profile.name
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="glass-card relative overflow-hidden p-6 sm:p-8">
      {/* Top accent line */}
      <div className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

      {/* Section Divider */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
          <User className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-emerald-400 uppercase">
          Profile
        </span>
      </div>

      <div className="flex flex-col items-center">
        {/* Avatar circle - 96px */}
        <div
          className="relative group cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-24 h-24 rounded-full border-2 border-emerald-500/20 overflow-hidden bg-[#0c1220] flex items-center justify-center shadow-lg shadow-emerald-500/5">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold bg-gradient-to-br from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
                {initials || 'NT'}
              </span>
            )}
          </div>

          {/* Camera overlay on hover */}
          <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <Camera className="h-5 w-5 text-white/80" />
          </div>

          {/* Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>

        {/* Name Input */}
        <div className="mt-5 w-full max-w-xs">
          <label className="mb-1.5 block text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase text-center">
            Display Name
          </label>
          <input
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            placeholder="Enter your name"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-mono text-white/90 text-center placeholder:text-muted-foreground/20 transition-colors hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/30"
          />
        </div>

        {/* Role Input */}
        <div className="mt-3 w-full max-w-xs">
          <label className="mb-1.5 block text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase text-center">
            Role / Subtitle
          </label>
          <input
            type="text"
            value={localRole}
            onChange={(e) => setLocalRole(e.target.value)}
            placeholder="e.g. Binary Signal Trader"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-mono text-white/90 text-center placeholder:text-muted-foreground/20 transition-colors hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/30"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className={cn(
            'mt-4 flex items-center justify-center gap-2 rounded-xl px-8 h-10 text-xs font-bold tracking-[0.15em] uppercase text-white transition-all duration-300 active:scale-[0.98]',
            'bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30'
          )}
        >
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5" />
              SAVED
            </>
          ) : (
            'SAVE CHANGES'
          )}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   2. ALL-TIME STATS GRID
   ═══════════════════════════════════════════ */
function AllTimeStatsGrid() {
  const allTimeStats = useStore((s) => s.allTimeStats);
  const history = useStore((s) => s.history);

  const total = allTimeStats.win + allTimeStats.mtg + allTimeStats.loss;
  const winRate = total > 0 ? ((allTimeStats.win + allTimeStats.mtg) / total) * 100 : 0;

  // Calculate best win streak from history
  const bestStreak = useMemo(() => {
    let streak = 0;
    let best = 0;
    for (const entry of history) {
      if (entry.result === 'WIN' || entry.result === 'MTG') {
        streak++;
        if (streak > best) best = streak;
      } else {
        streak = 0;
      }
    }
    return best;
  }, [history]);

  // Session count = unique dates in history
  const sessionCount = useMemo(() => {
    const dates = new Set(history.map((h) => h.time?.slice(0, 10)));
    return dates.size;
  }, [history]);

  const statCards = [
    {
      icon: BarChart3,
      label: 'Total Trades',
      value: String(total),
      color: 'text-white/80',
      bgColor: 'bg-white/[0.04]',
    },
    {
      icon: TrendingUp,
      label: 'Win Rate',
      value: `${winRate.toFixed(1)}%`,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      icon: Flame,
      label: 'Best Streak',
      value: String(bestStreak),
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      icon: Timer,
      label: 'Sessions',
      value: String(sessionCount),
      color: 'text-emerald-300',
      bgColor: 'bg-emerald-300/10',
    },
  ];

  return (
    <div className="glass-card p-5 sm:p-6">
      {/* Section Divider */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-emerald-400 uppercase">
          All-Time Performance
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-4 transition-colors hover:bg-white/[0.025]"
            >
              <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', stat.bgColor)}>
                <Icon className={cn('h-4 w-4', stat.color)} />
              </div>
              <p className={cn('font-mono font-bold tabular-nums text-lg leading-tight', stat.color)}>
                {stat.value}
              </p>
              <p className="mt-1 text-[10px] font-mono tracking-wider text-muted-foreground/40 uppercase">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Performance Bar (horizontal gradient) */}
      {total > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-mono tracking-[0.15em] text-muted-foreground/50 uppercase">
            Performance Distribution
          </p>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${(allTimeStats.win / total) * 100}%` }}
            />
            <div
              className="bg-emerald-300 transition-all duration-500"
              style={{ width: `${(allTimeStats.mtg / total) * 100}%` }}
            />
            <div
              className="bg-rose-500 transition-all duration-500"
              style={{ width: `${(allTimeStats.loss / total) * 100}%` }}
            />
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center justify-center gap-4">
            <span className="text-[11px] font-mono font-bold text-emerald-400 tabular-nums">
              {allTimeStats.win}W
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-300 tabular-nums">
              {allTimeStats.mtg}MTG
            </span>
            <span className="text-[11px] font-mono font-bold text-rose-400 tabular-nums">
              {allTimeStats.loss}L
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   3. ACCOUNT INFO
   ═══════════════════════════════════════════ */
function AccountInfo() {
  const memberSince = useStore((s) => s.memberSince);
  const allTimeStats = useStore((s) => s.allTimeStats);
  const history = useStore((s) => s.history);

  const total = allTimeStats.win + allTimeStats.mtg + allTimeStats.loss;

  const sinceDate = memberSince
    ? new Date(memberSince).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown';

  const daysSince = memberSince
    ? Math.max(1, Math.floor((Date.now() - new Date(memberSince).getTime()) / 86400000))
    : 0;

  const avgPerDay = daysSince > 0 ? (total / daysSince).toFixed(1) : '0.0';

  return (
    <div className="glass-card p-5 sm:p-6">
      {/* Section Divider */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04]">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/60" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
          Account Info
        </span>
      </div>

      <div className="space-y-0 divide-y divide-white/[0.04]">
        <div className="flex items-center justify-between py-3">
          <span className="text-[11px] font-mono text-muted-foreground/50">Member Since</span>
          <span className="text-[11px] font-mono text-white/70">{sinceDate}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-[11px] font-mono text-muted-foreground/50">Active Days</span>
          <span className="font-mono font-bold tabular-nums text-emerald-400 text-xs">{daysSince}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-[11px] font-mono text-muted-foreground/50">Avg Trades/Day</span>
          <span className="font-mono font-bold tabular-nums text-white/70 text-xs">{avgPerDay}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-[11px] font-mono text-muted-foreground/50">History Records</span>
          <span className="font-mono font-bold tabular-nums text-white/70 text-xs">{history.length}/100</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PROFILE PAGE (EXPORT)
   ═══════════════════════════════════════════ */
export default function ProfilePage() {
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
            <span className="text-emerald-400">PROFILE</span>
          </h1>
        </div>
        <p className="text-[11px] font-mono text-muted-foreground/40">
          Manage your identity and view lifetime performance
        </p>
      </motion.div>

      <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
        <AvatarSection />
      </motion.div>
      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
        <AllTimeStatsGrid />
      </motion.div>
      <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
        <AccountInfo />
      </motion.div>
    </motion.div>
  );
}
