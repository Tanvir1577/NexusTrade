import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Signal {
  id: string;
  pair: string;
  dir: 'UP' | 'DOWN';
  score: number;
  logic: string;
  logics: string[];
  price: number;
  entryTime: string;
  entryStr: string;
  mtgChecked?: boolean;
  mtgEntry?: string;
}

export interface HistoryEntry {
  id: string;
  pair: string;
  dir: 'UP' | 'DOWN';
  logic: string;
  entryStr: string;
  result: 'WIN' | 'MTG' | 'LOSS';
  time: string;
  score: number;
}

export interface SessionEntry {
  pair: string;
  dir: 'UP' | 'DOWN';
  result: 'WIN' | 'MTG' | 'LOSS';
  time: string;
}

export const ALL_PAIRS = [
  'EUR_USD', 'EUR_JPY', 'EUR_CHF', 'EUR_AUD', 'EUR_CAD', 'EUR_GBP',
  'GBP_USD', 'GBP_JPY', 'GBP_AUD', 'GBP_CAD', 'GBP_CHF',
  'AUD_USD', 'AUD_JPY', 'AUD_CAD', 'AUD_CHF',
  'USD_JPY', 'USD_CAD', 'USD_CHF',
  'CAD_JPY', 'CHF_JPY',
] as const;

export type PairName = typeof ALL_PAIRS[number];

export function formatPair(p: string): string {
  return p.replace('_', '/');
}

export function isJPYPair(p: string): boolean {
  return p.includes('JPY');
}

export function priceDecimals(p: string): number {
  return isJPYPair(p) ? 3 : 5;
}

export function priceDecimalsDisplay(price: number): number {
  return price >= 10 ? 3 : 5;
}

interface AppState {
  // Engine
  running: boolean;

  // Pairs
  selectedPairs: string[];

  // Signal settings
  minScore: number;
  mtgEnabled: boolean;
  tzOffset: number;

  // Current signal
  pendingSignal: Signal | null;

  // History
  history: HistoryEntry[];
  sessionLog: SessionEntry[];

  // Stats
  stats: { win: number; mtg: number; loss: number };
  allTimeStats: { win: number; mtg: number; loss: number };

  // Profile
  profile: { name: string; role: string; tg: string; avatar: string };
  memberSince: string;

  // UI
  currentTab: string;
  lastPrices: Record<string, number>;

  // Chart
  chartPair: string;

  // Actions
  setRunning: (running: boolean) => void;
  setSelectedPairs: (pairs: string[]) => void;
  togglePair: (pair: string) => void;
  setMinScore: (score: number) => void;
  setMtgEnabled: (enabled: boolean) => void;
  setTzOffset: (offset: number) => void;
  setCurrentTab: (tab: string) => void;
  setPendingSignal: (signal: Signal | null) => void;
  addHistoryEntry: (entry: HistoryEntry) => void;
  addSessionEntry: (entry: SessionEntry) => void;
  incrementStat: (type: 'win' | 'mtg' | 'loss') => void;
  clearHistory: () => void;
  resetSession: () => void;
  setChartPair: (pair: string) => void;
  setLastPrice: (pair: string, price: number) => void;
  setProfile: (profile: Partial<AppState['profile']>) => void;
  setMemberSince: (date: string) => void;
  exportHistoryCSV: () => string;
  tzTime: (date: Date) => string;
  tzLabel: () => string;
  tzDateStr: (date: Date) => string;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      running: false,
      selectedPairs: ['EUR_USD', 'USD_JPY', 'EUR_JPY', 'GBP_USD', 'AUD_USD'],
      minScore: 6,
      mtgEnabled: true,
      tzOffset: 6,
      pendingSignal: null,
      history: [],
      sessionLog: [],
      stats: { win: 0, mtg: 0, loss: 0 },
      allTimeStats: { win: 0, mtg: 0, loss: 0 },
      profile: { name: 'TRADER', role: 'Binary Signal Trader', tg: '', avatar: '' },
      memberSince: new Date().toISOString(),
      currentTab: 'dashboard',
      lastPrices: {},
      chartPair: 'EUR_USD',

      setRunning: (running) => set({ running }),
      setSelectedPairs: (selectedPairs) => set({ selectedPairs }),
      togglePair: (pair) => {
        const { selectedPairs } = get();
        if (selectedPairs.includes(pair)) {
          set({ selectedPairs: selectedPairs.filter(p => p !== pair) });
        } else {
          set({ selectedPairs: [...selectedPairs, pair] });
        }
      },
      setMinScore: (minScore) => set({ minScore }),
      setMtgEnabled: (mtgEnabled) => set({ mtgEnabled }),
      setTzOffset: (tzOffset) => set({ tzOffset }),
      setCurrentTab: (currentTab) => set({ currentTab }),
      setPendingSignal: (pendingSignal) => set({ pendingSignal }),
      addHistoryEntry: (entry) => set((state) => ({
        history: [entry, ...state.history].slice(0, 100),
      })),
      addSessionEntry: (entry) => set((state) => ({
        sessionLog: [...state.sessionLog, entry].slice(-50),
      })),
      incrementStat: (type) => set((state) => ({
        stats: { ...state.stats, [type]: state.stats[type] + 1 },
        allTimeStats: { ...state.allTimeStats, [type]: state.allTimeStats[type] + 1 },
      })),
      clearHistory: () => set({
        history: [],
        stats: { win: 0, mtg: 0, loss: 0 },
        allTimeStats: { win: 0, mtg: 0, loss: 0 },
        sessionLog: [],
      }),
      resetSession: () => set({
        sessionLog: [],
        stats: { win: 0, mtg: 0, loss: 0 },
      }),
      setChartPair: (chartPair) => set({ chartPair }),
      setLastPrice: (pair, price) => set((state) => ({
        lastPrices: { ...state.lastPrices, [pair]: price },
      })),
      setProfile: (profile) => set((state) => ({
        profile: { ...state.profile, ...profile },
      })),
      setMemberSince: (memberSince) => set({ memberSince }),

      exportHistoryCSV: () => {
        const { history } = get();
        const header = 'Pair,Direction,Logic,EntryTime,Result,Score,Date';
        const rows = history.map(h =>
          `${formatPair(h.pair)},${h.dir},${h.logic},${h.entryStr},${h.result},${h.score},${h.time}`
        );
        return [header, ...rows].join('\n');
      },

      tzTime: (date: Date) => {
        const offset = get().tzOffset;
        const local = new Date(date.getTime() + offset * 3600000);
        return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
      },
      tzLabel: () => {
        const offset = get().tzOffset;
        if (offset === 0) return 'UTC';
        const h = Math.floor(Math.abs(offset));
        const m = (Math.abs(offset) % 1) * 60;
        return `UTC${offset >= 0 ? '+' : '-'}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
      },
      tzDateStr: (date: Date) => {
        const offset = get().tzOffset;
        const local = new Date(date.getTime() + offset * 3600000);
        return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
      },
    }),
    {
      name: 'nexustrade-store',
      partialize: (state) => ({
        selectedPairs: state.selectedPairs,
        minScore: state.minScore,
        mtgEnabled: state.mtgEnabled,
        tzOffset: state.tzOffset,
        profile: state.profile,
        memberSince: state.memberSince,
        allTimeStats: state.allTimeStats,
        history: state.history,
        chartPair: state.chartPair,
      }),
    }
  )
);
