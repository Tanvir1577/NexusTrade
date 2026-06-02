'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useStore, type Signal, type HistoryEntry, type SessionEntry } from '@/lib/store';
import { fetchCandles } from '@/lib/oanda';
import { analyzeCandles, getNextMinuteTiming, checkCandleResult } from '@/lib/signal-engine';
import { playAlertSound } from '@/hooks/use-alert-sound';

const SCAN_INTERVAL = 15000; // 15 seconds
const RESULT_CHECK_INTERVAL = 15000; // 15 seconds

export function useSignalEngine() {
  const running = useStore((s) => s.running);
  const selectedPairs = useStore((s) => s.selectedPairs);
  const minScore = useStore((s) => s.minScore);
  const mtgEnabled = useStore((s) => s.mtgEnabled);
  const tzOffset = useStore((s) => s.tzOffset);
  const pendingSignal = useStore((s) => s.pendingSignal);
  const setPendingSignal = useStore((s) => s.setPendingSignal);
  const addHistoryEntry = useStore((s) => s.addHistoryEntry);
  const addSessionEntry = useStore((s) => s.addSessionEntry);
  const incrementStat = useStore((s) => s.incrementStat);
  const setLastPrice = useStore((s) => s.setLastPrice);
  const resetSession = useStore((s) => s.resetSession);

  const scanRunningRef = useRef(false);
  const signalScheduledRef = useRef(false);
  const finalizedIdsRef = useRef(new Set<string>());
  const bgWorkerRef = useRef<Worker | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const noSleepAudioRef = useRef<{ ctx: AudioContext; src: AudioContext['createConstantSource'] } | null>(null);

  // ── Finalize signal result ──
  const finalizeResult = useCallback(async (sig: Signal, result: 'WIN' | 'MTG' | 'LOSS') => {
    if (finalizedIdsRef.current.has(sig.id)) return;
    finalizedIdsRef.current.add(sig.id);

    const historyEntry: HistoryEntry = {
      id: sig.id,
      pair: sig.pair,
      dir: sig.dir,
      logic: sig.logic,
      entryStr: sig.entryStr,
      result,
      time: new Date().toISOString(),
      score: sig.score,
    };

    const sessionEntry: SessionEntry = {
      pair: sig.pair,
      dir: sig.dir,
      result,
      time: new Date().toISOString(),
    };

    addHistoryEntry(historyEntry);
    addSessionEntry(sessionEntry);

    if (result === 'WIN') incrementStat('win');
    else if (result === 'MTG') incrementStat('mtg');
    else incrementStat('loss');

    setPendingSignal(null);
    signalScheduledRef.current = false;

    // Play alert sound for result
    try { playAlertSound(); } catch { /* ignore */ }
  }, [addHistoryEntry, addSessionEntry, incrementStat, setPendingSignal]);

  // ── Check pending signal result ──
  const checkPendingResult = useCallback(async () => {
    const sig = useStore.getState().pendingSignal;
    if (!sig) return;

    const now = Date.now();
    const entryTime = new Date(sig.entryTime).getTime();
    const entryEnd = entryTime + 63000; // wait 3s after candle close for API delay

    if (now < entryEnd) return;

    const candles = await fetchCandles(sig.pair, 5, 'M1');
    if (!candles || candles.length < 2) return;

    // Update last price
    const lastPrice = parseFloat(candles[candles.length - 1]?.mid?.c || '0');
    if (lastPrice > 0) setLastPrice(sig.pair, lastPrice);

    const result = checkCandleResult(candles, sig.entryTime, sig.dir);
    if (!result) return;

    if (result.win) {
      await finalizeResult(sig, 'WIN');
    } else if (mtgEnabled && !sig.mtgChecked) {
      // Try MTG on next candle
      const mtgEntryTime = new Date(entryTime + 60000).toISOString();
      const mtgResult = checkCandleResult(candles, mtgEntryTime, sig.dir);
      if (mtgResult) {
        await finalizeResult(sig, mtgResult.win ? 'MTG' : 'LOSS');
      } else {
        // MTG candle not ready yet, mark as checked
        setPendingSignal({ ...sig, mtgChecked: true, mtgEntry: mtgEntryTime });
      }
    } else if (sig.mtgChecked && sig.mtgEntry) {
      const mtgResult = checkCandleResult(candles, sig.mtgEntry, sig.dir);
      if (mtgResult) {
        await finalizeResult(sig, mtgResult.win ? 'MTG' : 'LOSS');
      }
      // If MTG result not ready, wait for next check
    } else {
      await finalizeResult(sig, 'LOSS');
    }
  }, [finalizeResult, mtgEnabled, setLastPrice, setPendingSignal]);

  // ── Scan for new signals ──
  const scanForSignals = useCallback(async () => {
    const state = useStore.getState();
    if (!state.running || scanRunningRef.current) return;
    if (state.pendingSignal) {
      // Check pending result instead of scanning
      await checkPendingResult();
      return;
    }
    if (signalScheduledRef.current) return;

    scanRunningRef.current = true;
    try {
      const now = new Date();
      // Only schedule signals in the last 15 seconds of each minute
      if (now.getSeconds() > 45) return;

      for (const pair of state.selectedPairs) {
        if (!useStore.getState().running) break;
        if (useStore.getState().pendingSignal) break;

        const candles = await fetchCandles(pair, 50, 'M1');
        if (!candles || candles.length < 20) continue;

        // Update last price
        const lastPrice = parseFloat(candles[candles.length - 1]?.mid?.c || '0');
        if (lastPrice > 0) setLastPrice(pair, lastPrice);

        const sig = analyzeCandles(candles, pair, state.minScore);
        if (!sig) continue;

        const timing = getNextMinuteTiming(state.tzOffset);
        const fullSignal: Signal = {
          ...sig,
          entryTime: timing.entryTime,
          entryStr: timing.entryStr,
          id: `${Date.now()}_${pair}`,
          mtgChecked: false,
        };

        const delay = timing.sendAt - Date.now();
        if (delay > 0 && delay < 62000) {
          signalScheduledRef.current = true;

          setTimeout(async () => {
            signalScheduledRef.current = false;
            if (!useStore.getState().running) return;
            if (useStore.getState().pendingSignal) return;

            setPendingSignal(fullSignal);
            // Play alert sound for new signal
            try { playAlertSound(); } catch { /* ignore */ }
          }, Math.max(0, delay));

          break; // Only one signal per scan cycle
        }
      }
    } finally {
      scanRunningRef.current = false;
    }
  }, [checkPendingResult, setLastPrice, setPendingSignal]);

  // ── Background worker for wake lock ──
  const startBgWorker = useCallback(() => {
    if (bgWorkerRef.current) return;
    const code = `
      let iv = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (!iv) iv = setInterval(() => self.postMessage('tick'), 15000);
        } else if (e.data === 'stop') {
          if (iv) { clearInterval(iv); iv = null; }
        }
      };
    `;
    try {
      const blob = new Blob([code], { type: 'application/javascript' });
      bgWorkerRef.current = new Worker(URL.createObjectURL(blob));
      bgWorkerRef.current.onmessage = () => {
        if (useStore.getState().running) scanForSignals();
      };
      bgWorkerRef.current.postMessage('start');
    } catch { /* Web Worker not available */ }
  }, [scanForSignals]);

  const stopBgWorker = useCallback(() => {
    if (bgWorkerRef.current) {
      bgWorkerRef.current.postMessage('stop');
      bgWorkerRef.current.terminate();
      bgWorkerRef.current = null;
    }
  }, []);

  // ── Wake Lock ──
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          if (useStore.getState().running) requestWakeLock();
        });
      }
    } catch { /* not supported */ }
  }, []);

  const releaseWakeLock = useCallback(() => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch { /* ignore */ }
  }, []);

  // ── No-sleep audio ──
  const startNoSleepAudio = useCallback(() => {
    try {
      if (noSleepAudioRef.current) return;
      const ctx = new AudioContext();
      const src = ctx.createConstantSource();
      const gain = ctx.createGain();
      gain.gain.value = 0.000001;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      noSleepAudioRef.current = { ctx, src };
    } catch { /* not supported */ }
  }, []);

  const stopNoSleepAudio = useCallback(() => {
    try {
      if (noSleepAudioRef.current) {
        noSleepAudioRef.current.src.stop();
        noSleepAudioRef.current.ctx.close();
        noSleepAudioRef.current = null;
      }
    } catch { /* ignore */ }
  }, []);

  // ── Main engine loop ──
  useEffect(() => {
    if (!running) {
      stopBgWorker();
      releaseWakeLock();
      stopNoSleepAudio();
      scanRunningRef.current = false;
      signalScheduledRef.current = false;
      finalizedIdsRef.current.clear();
      return;
    }

    // Reset session when starting
    resetSession();
    finalizedIdsRef.current.clear();

    // Start engine services
    requestWakeLock();
    startNoSleepAudio();
    startBgWorker();

    // Initial scan
    scanForSignals();

    // Periodic scan
    const interval = setInterval(() => {
      if (useStore.getState().running) {
        scanForSignals();
      }
    }, SCAN_INTERVAL);

    // Result check interval
    const resultInterval = setInterval(() => {
      if (useStore.getState().running && useStore.getState().pendingSignal) {
        checkPendingResult();
      }
    }, RESULT_CHECK_INTERVAL);

    return () => {
      clearInterval(interval);
      clearInterval(resultInterval);
    };
  }, [running]);

  // Re-acquire wake lock on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && useStore.getState().running) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [requestWakeLock]);
}
