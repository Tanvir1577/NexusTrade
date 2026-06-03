'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore, formatPair, ALL_PAIRS } from '@/lib/store';

/* ==================================================================== */
/*  HELPERS                                                              */
/* ==================================================================== */

/** Convert OANDA pair format to TradingView symbol format */
function oandaToTV(pair: string): string {
  return `FX:${pair.replace('_', '')}`;
}

/* ==================================================================== */
/*  COMPONENT                                                            */
/* ==================================================================== */

export default function ChartPage() {
  const pair = useStore(s => s.chartPair);
  const setChartPair = useStore(s => s.setChartPair);
  const currentTab = useStore(s => s.currentTab);

  const tvContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<ReturnType<any>>(null);
  const pairRef = useRef(pair); // Track current pair for effect deps

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  // Keep pairRef in sync
  useEffect(() => { pairRef.current = pair; }, [pair]);

  /* ---- Load TradingView script dynamically ---- */
  useEffect(() => {
    const handleLoaded = () => setScriptLoaded(true);
    const handleError = () => setScriptError(true);

    // Already loaded (e.g. tab was visited before)
    if ((window as any).TradingView) {
      const id = setTimeout(handleLoaded, 0);
      return () => clearTimeout(id);
    }

    // Script tag exists from previous render but may not have loaded yet
    const existing = document.getElementById('tv-chart-script');
    if (existing) {
      existing.addEventListener('load', handleLoaded);
      existing.addEventListener('error', handleError);
      return () => {
        existing.removeEventListener('load', handleLoaded);
        existing.removeEventListener('error', handleError);
      };
    }

    // Create new script tag
    const script = document.createElement('script');
    script.id = 'tv-chart-script';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.addEventListener('load', handleLoaded);
    script.addEventListener('error', handleError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener('load', handleLoaded);
      script.removeEventListener('error', handleError);
    };
  }, []);

  /* ---- Create / recreate widget on pair or script load ---- */
  useEffect(() => {
    if (!scriptLoaded || currentTab !== 'chart') return;
    if (!tvContainerRef.current) return;

    // Destroy previous widget (clear iframe + reset ref)
    tvContainerRef.current.innerHTML = '';
    widgetRef.current = null;

    const widget = new (window as any).TradingView.widget({
      autosize: true,
      symbol: oandaToTV(pairRef.current),
      interval: '1',           // 1 minute
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',              // Candlestick
      locale: 'en',
      toolbar_bg: '#0b0e14',
      enable_publishing: false,
      hide_side_toolbar: true,   // Hide left drawing panel
      allow_symbol_change: false, // We control symbol changes
      hide_top_toolbar: true,    // Hide top toolbar (timeframes, chart types)
      withdateranges: false,
      details: false,            // Hide symbol details panel
      hotlist: false,
      calendar: false,
      show_popup_button: false,
      popup_width: '1000',
      popup_height: '650',
      backgroundColor: '#0b0e14',
      gridColor: 'rgba(255,255,255,0.03)',
      container_id: 'tv-chart-container',

      /* ---- Studies: SMA 20 & SMA 50 ---- */
      studies: [
        { id: 'MASimple@tv-basicstudies', inputs: { length: 20 } },
        { id: 'MASimple@tv-basicstudies', inputs: { length: 50 } },
      ],
      studies_overrides: {
        'ma studies.overlay': true,
      },

      /* ---- Chart visual overrides (dark theme, green/red candles) ---- */
      overrides: {
        'mainSeriesProperties.candleStyle.upColor': '#22c55e',
        'mainSeriesProperties.candleStyle.downColor': '#ef4444',
        'mainSeriesProperties.candleStyle.borderUpColor': '#22c55e',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
        'mainSeriesProperties.candleStyle.wickUpColor': '#22c55e',
        'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
        'paneProperties.background': '#0b0e14',
        'paneProperties.vertGridProperties.color': 'rgba(255,255,255,0.03)',
        'paneProperties.horzGridProperties.color': 'rgba(255,255,255,0.03)',
        'scalesProperties.textColor': 'rgba(255,255,255,0.45)',
      },

      loading_screen: {
        backgroundColor: '#0b0e14',
        foregroundColor: '#22c55e',
      },
    });

    widgetRef.current = widget;
  }, [scriptLoaded, currentTab, pair]); // Re-run on pair change to recreate widget

  /* ---- Cleanup on unmount ---- */
  useEffect(() => {
    return () => {
      widgetRef.current = null;
    };
  }, []);

  /* ---- Pair change handler ---- */
  const changePair = (p: string) => {
    if (p === pair) return;
    setChartPair(p);
  };

  /* ================================================================== */
  /*  RENDER                                                              */
  /* ================================================================== */

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" style={{ background: '#0b0e14' }}>

      {/* ===== HEADER BAR ===== */}
      <div
        className="flex items-center gap-2 px-2 shrink-0"
        style={{
          height: 40,
          background: '#0d1117',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Pair name */}
        <span className="font-mono font-bold text-base text-emerald-400">
          {formatPair(pair)}
        </span>

        {/* Pair selector dropdown */}
        <div className="relative">
          <select
            value={pair}
            onChange={e => changePair(e.target.value)}
            className="appearance-none rounded px-2.5 py-1 text-xs font-mono text-emerald-300 outline-none cursor-pointer pr-6"
            style={{
              background: '#111827',
              border: '1px solid rgba(34,197,94,0.25)',
              minWidth: '90px',
            }}
          >
            {ALL_PAIRS.map(p => (
              <option
                key={p}
                value={p}
                style={{ background: '#111827', color: '#6ee7b7', padding: '4px 8px' }}
              >
                {formatPair(p)}
              </option>
            ))}
          </select>
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-400 text-[10px]">
            ▾
          </span>
        </div>

        <div className="flex-1" />

        {/* Indicator label */}
        <span
          className="text-[10px] font-mono hidden sm:block"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          1M · SMA(20, 50)
        </span>
      </div>

      {/* ===== CHART AREA ===== */}
      <div className="flex-1 relative overflow-hidden">
        {/* TradingView widget container */}
        <div
          id="tv-chart-container"
          ref={tvContainerRef}
          className="w-full h-full"
        />

        {/* Loading state while script loads */}
        {!scriptLoaded && !scriptError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-3">
            <div className="flex items-center gap-2 text-sm font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <span className="inline-block w-3 h-3 border border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />
              Loading chart...
            </div>
          </div>
        )}

        {/* Error state if script fails */}
        {scriptError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-3">
            <div
              className="rounded-lg px-5 py-4 text-sm font-mono text-center"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.25)',
              }}
            >
              <p className="mb-1">Failed to load TradingView chart.</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
                Please check your internet connection and refresh.
              </p>
            </div>
          </div>
        )}

        {/* Attempt to hide TradingView watermark/logo (bottom-right overlay) */}
        {scriptLoaded && !scriptError && (
          <div
            className="absolute bottom-1 right-0 pointer-events-none z-20"
            style={{
              width: 185,
              height: 34,
              background: 'linear-gradient(to left, #0b0e14 60%, transparent)',
            }}
          />
        )}
      </div>
    </div>
  );
}
