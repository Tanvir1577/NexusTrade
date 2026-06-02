'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  User,
  Check,
  Shield,
  Activity,
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
   1. PROFILE HEADER CARD
   ═══════════════════════════════════════════ */
function ProfileHeaderCard() {
  const profile = useStore((s) => s.profile);
  const memberSince = useStore((s) => s.memberSince);
  const setProfile = useStore((s) => s.setProfile);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const sinceDate = memberSince
    ? new Date(memberSince).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    <motion.div
      custom={0}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="glass-card relative overflow-hidden p-6 sm:p-8"
    >
      {/* Top accent line */}
      <div className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

      {/* Avatar */}
      <div className="flex flex-col items-center">
        <div
          className="relative group cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-20 h-20 rounded-full border-2 border-emerald-500/20 overflow-hidden bg-[#0c1220] flex items-center justify-center shadow-lg shadow-emerald-500/5">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl">👤</span>
            )}
          </div>

          {/* Camera overlay on hover */}
          <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
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

        {/* Name */}
        <h2 className="mt-4 text-xl font-bold text-emerald-400">
          {profile.name}
        </h2>

        {/* Role */}
        <p className="mt-1 text-sm font-mono text-muted-foreground">
          {profile.role}
        </p>

        {/* Since Badge */}
        <div className="mt-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1">
          <span className="text-[10px] font-mono tracking-[0.15em] text-muted-foreground/40">
            Since {sinceDate}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   2. PROFILE SETTINGS CARD
   ═══════════════════════════════════════════ */
function ProfileSettingsCard() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const [localName, setLocalName] = useState(profile.name);
  const [localRole, setLocalRole] = useState(profile.role);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setProfile({ name: localName.trim() || 'TRADER', role: localRole.trim() || 'Trader' });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <motion.div
      custom={1}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="glass-card p-5 sm:p-6"
    >
      {/* Section Title */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
          <User className="h-4 w-4 text-emerald-400" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-emerald-400 uppercase">
          Edit Profile
        </span>
      </div>

      <div className="space-y-4">
        {/* Display Name */}
        <div>
          <label className="mb-2 block text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
            Display Name
          </label>
          <input
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            placeholder="Enter your name"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-mono text-white/90 placeholder:text-muted-foreground/20 transition-colors hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/30"
          />
        </div>

        {/* Role / Title */}
        <div>
          <label className="mb-2 block text-[10px] font-mono tracking-[0.15em] text-muted-foreground/60 uppercase">
            Role / Title
          </label>
          <input
            type="text"
            value={localRole}
            onChange={(e) => setLocalRole(e.target.value)}
            placeholder="e.g. Binary Signal Trader"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-mono text-white/90 placeholder:text-muted-foreground/20 transition-colors hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/30"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl h-11 text-sm font-bold tracking-wider uppercase text-white transition-all active:scale-[0.98]',
            saved
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-500/25'
              : 'bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35'
          )}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" />
              SAVED
            </>
          ) : (
            <>
              <User className="h-4 w-4" />
              SAVE CHANGES
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   3. ALL-TIME STATS CARD
   ═══════════════════════════════════════════ */
function AllTimeStatsCard() {
  const allTimeStats = useStore((s) => s.allTimeStats);
  const memberSince = useStore((s) => s.memberSince);

  const total = allTimeStats.win + allTimeStats.mtg + allTimeStats.loss;
  const winRate = total > 0 ? ((allTimeStats.win + allTimeStats.mtg) / total) * 100 : 0;

  const sinceDate = memberSince
    ? new Date(memberSince).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'N/A';

  return (
    <motion.div
      custom={2}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="glass-card p-5 sm:p-6"
    >
      {/* Section Title */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
          <BarChart3 className="h-4 w-4 text-emerald-400" />
        </div>
        <span className="text-[10px] font-mono tracking-[0.15em] text-emerald-400 uppercase">
          All-Time Performance
        </span>
      </div>

      {/* Stat Rows */}
      <div className="space-y-0 divide-y divide-white/[0.04]">
        <div className="flex items-center justify-between py-3">
          <span className="text-[11px] font-mono text-muted-foreground/60">Total Signals</span>
          <span className="font-mono font-bold tabular-nums text-white/80">{total}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-[11px] font-mono text-muted-foreground/60">Win Rate</span>
          <span className="font-mono font-bold tabular-nums text-emerald-400">
            {winRate.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-[11px] font-mono text-muted-foreground/60">Member Since</span>
          <span className="text-[11px] font-mono text-muted-foreground/50">{sinceDate}</span>
        </div>
      </div>

      {/* Performance Bar */}
      {total > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-mono tracking-[0.15em] text-muted-foreground/50 uppercase">
            Performance Distribution
          </p>
          <div className="flex h-2 w-full overflow-hidden rounded-full">
            {/* Win segment */}
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${(allTimeStats.win / total) * 100}%` }}
            />
            {/* MTG segment */}
            <div
              className="bg-blue-500 transition-all duration-500"
              style={{ width: `${(allTimeStats.mtg / total) * 100}%` }}
            />
            {/* Loss segment */}
            <div
              className="bg-red-500 transition-all duration-500"
              style={{ width: `${(allTimeStats.loss / total) * 100}%` }}
            />
          </div>

          {/* Footer */}
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="text-[11px] font-mono font-bold text-emerald-400">
              {allTimeStats.win}W
            </span>
            <span className="text-[11px] font-mono font-bold text-blue-400">
              {allTimeStats.mtg}MTG
            </span>
            <span className="text-[11px] font-mono font-bold text-red-400">
              {allTimeStats.loss}L
            </span>
          </div>
        </div>
      )}
    </motion.div>
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

      <ProfileHeaderCard />
      <ProfileSettingsCard />
      <AllTimeStatsCard />
    </motion.div>
  );
}
