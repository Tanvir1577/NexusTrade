'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useStore, formatPair, isJPYPair, ALL_PAIRS } from '@/lib/store';
import { Plus, Minus, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

/* ==================================================================== */
/*  TYPES                                                                */
/* ==================================================================== */

interface Candle {
  time: number;       // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
  spread: number;     // ask - bid at candle time
}

type Granularity = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D';

interface ViewState {
  scrollX: number;        // pixel offset (negative = scrolled left)
  zoom: number;           // candle pixel width
  crossX: number;
  crossY: number;
  showCross: boolean;
}

/* ==================================================================== */
/*  CONSTANTS                                                            */
/* ==================================================================== */

const THEME = {
  bg:            '#0b0e14',
  bgPanel:       '#0d1117',
  grid:          'rgba(255,255,255,0.03)',
  gridStrong:    'rgba(255,255,255,0.06)',
  border:        'rgba(255,255,255,0.07)',
  bull:          '#22c55e',
  bullDim:       'rgba(34,197,94,0.35)',
  bear:          '#ef4444',
  bearDim:       'rgba(239,68,68,0.35)',
  text:          'rgba(255,255,255,0.45)',
  textBright:    'rgba(255,255,255,0.7)',
  textMuted:     'rgba(255,255,255,0.25)',
  crosshair:     'rgba(150,170,190,0.3)',
  volBull:       'rgba(34,197,94,0.15)',
  volBear:       'rgba(239,68,68,0.15)',
  sma20:         '#f59e0b',
  sma50:         '#8b5cf6',
  sma20bg:       'rgba(245,158,11,0.12)',
  sma50bg:       'rgba(139,92,246,0.12)',
};

const LAYOUT = {
  headerH:   40,
  priceW:    72,
  timeH:     26,
  ohlcH:     22,
  volRatio:  0.15,  // volume takes 15% of chart height
  rightPad:  4,     // candle slots padding on right
};

const MIN_ZOOM = 2;
const MAX_ZOOM = 28;
const DEFAULT_ZOOM = 8;
const FETCH_COUNT = 500;
const FETCH_MS = 3000;

/* ==================================================================== */
/*  HELPERS                                                              */
/* ==================================================================== */

function calcSMA(data: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
    result.push(sum / period);
  }
  return result;
}

function niceStep(range: number, targetLines: number): number {
  const rough = range / targetLines;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step: number;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * mag;
}

function fmtTime(d: Date, g: Granularity): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  if (g === 'H4' || g === 'D') {
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
    return g === 'D' ? `${dd} ${mo}` : `${mo} ${dd} ${hh}:${mm}`;
  }
  return `${hh}:${mm}`;
}

function fmtTimeFull(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yy}-${mo}-${dd} ${hh}:${mm}:${ss}`;
}

/* ==================================================================== */
/*  COMPONENT                                                            */
/* ==================================================================== */

export default function ChartPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pair = useStore(s => s.chartPair);
  const setChartPair = useStore(s => s.setChartPair);
  const currentTab = useStore(s => s.currentTab);
  const tzTime = useStore(s => s.tzTime);
  const tzOffset = useStore(s => s.tzOffset);

  const dec = isJPYPair(pair) ? 3 : 5;

  /* ---- state ---- */
  const [candles, setCandles] = useState<Candle[]>([]);
  const [granularity, setGranularity] = useState<Granularity>('M1');
  const [sma20on, setSma20on] = useState(true);
  const [sma50on, setSma50on] = useState(false);
  const [volOn, setVolOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<ViewState>({
    scrollX: 0, zoom: DEFAULT_ZOOM, crossX: -1, crossY: -1, showCross: false,
  });

  /* ---- refs ---- */
  const viewRef = useRef(view);
  const candlesRef = useRef(candles);
  const sizeRef = useRef({ w: 0, h: 0 });
  const dirtyRef = useRef(true);
  const rafRef = useRef(0);
  const autoFollowRef = useRef(true);
  const isDragRef = useRef(false);
  const dragStartRef = useRef({ x: 0, scrollX: 0 });
  const pinchRef = useRef(0);
  const lastPinchZoomRef = useRef(0);

  useEffect(() => { viewRef.current = view; });
  useEffect(() => { candlesRef.current = candles; }, [candles]);

  /* ---- derived ---- */
  const sma20 = useMemo(() => sma20on ? calcSMA(candles, 20) : [], [candles, sma20on]);
  const sma50 = useMemo(() => sma50on ? calcSMA(candles, 50) : [], [candles, sma50on]);

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const prevCandle = candles.length > 1 ? candles[candles.length - 2] : null;

  /* ---- clamp / auto-follow ---- */
  const getClamp = useCallback(() => {
    const v = viewRef.current;
    const d = candlesRef.current;
    const cw = sizeRef.current.w - LAYOUT.priceW;
    if (cw <= 0 || d.length === 0) return v.scrollX;
    const total = d.length * v.zoom;
    const pad = v.zoom * LAYOUT.rightPad;
    const min = -(total - cw + pad);
    return min;
  }, []);

  const applyClamp = useCallback((force?: 'follow') => {
    const v = viewRef.current;
    const d = candlesRef.current;
    const cw = sizeRef.current.w - LAYOUT.priceW;
    if (cw <= 0 || d.length === 0) return;
    const total = d.length * v.zoom;
    const pad = v.zoom * LAYOUT.rightPad;
    const min = -(total - cw + pad);

    if (force === 'follow' || autoFollowRef.current) {
      v.scrollX = min;
    } else {
      if (v.scrollX < min) v.scrollX = min;
      if (v.scrollX > 0) v.scrollX = 0;
    }
  }, []);

  /* ---- fetch ---- */
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/oanda?pair=${pair}&count=${FETCH_COUNT}&granularity=${granularity}`);
      if (!res.ok) { setError('API error'); return; }
      const json = await res.json();
      const raw = json?.candles;
      if (!Array.isArray(raw) || raw.length === 0) { setError('No data'); return; }

      const mapped: Candle[] = raw.map((c: Record<string, unknown>) => {
        const bid = c.bid as Record<string, string> | undefined;
        const ask = c.ask as Record<string, string> | undefined;
        const mid = c.mid as Record<string, string> | undefined;
        // Use BID for chart — matches binary broker display
        const o = Number(bid?.o ?? mid?.o ?? 0);
        const h = Number(bid?.h ?? mid?.h ?? 0);
        const l = Number(bid?.l ?? mid?.l ?? 0);
        const cl = Number(bid?.c ?? mid?.c ?? 0);
        const ao = Number(ask?.o ?? mid?.o ?? 0);
        const spread = Math.abs(ao - o);
        return {
          time: new Date(String(c.time ?? '')).getTime(),
          open: o, high: h, low: l, close: cl,
          volume: Number(c.volume ?? 0),
          complete: Boolean(c.complete),
          spread,
        };
      });

      setCandles(prev => {
        if (prev.length === 0) {
          autoFollowRef.current = true;
          return mapped;
        }
        // Merge: update last incomplete candle, append new ones
        const lastPrev = prev[prev.length - 1];
        const result = [...prev];
        if (!lastPrev.complete) {
          const matchIdx = mapped.findIndex(m => m.time === lastPrev.time);
          if (matchIdx >= 0) {
            result[result.length - 1] = mapped[matchIdx];
            // Append candles after the matched one
            for (let i = matchIdx + 1; i < mapped.length; i++) {
              result.push(mapped[i]);
            }
          }
        } else {
          const lastTime = lastPrev.time;
          for (const m of mapped) {
            if (m.time > lastTime) result.push(m);
          }
        }
        return result.slice(-FETCH_COUNT);
      });

      setError('');
      setLoading(false);
      dirtyRef.current = true;
    } catch {
      setError('Network error');
    }
  }, [pair, granularity]);

  /* ---- auto-refresh ---- */
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (currentTab !== 'chart') return;
    const id = setInterval(() => fetchData(), FETCH_MS);
    // Delay first fetch to avoid synchronous setState in effect
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      const tid = setTimeout(fetchData, 0);
      return () => { clearTimeout(tid); clearInterval(id); };
    }
    return () => clearInterval(id);
  }, [currentTab, fetchData]);

  /* ---- auto-follow on new candle ---- */
  useEffect(() => {
    if (autoFollowRef.current) {
      applyClamp('follow');
      dirtyRef.current = true;
    }
  }, [candles.length, applyClamp]);

  /* ---- resize ---- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          sizeRef.current = { w: width, h: height };
          applyClamp();
          dirtyRef.current = true;
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyClamp]);

  /* ================================================================== */
  /*  DRAW ENGINE                                                         */
  /* ================================================================== */

  const fmt = useCallback((v: number) => v.toFixed(dec), [dec]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = sizeRef.current;
    if (w < 10 || h < 10) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const v = viewRef.current;
    const data = candlesRef.current;
    const zoom = v.zoom;

    /* ---- regions ---- */
    const chartW = w - LAYOUT.priceW;
    const chartH = h - LAYOUT.headerH - LAYOUT.timeH - LAYOUT.ohlcH;
    const chartTop = LAYOUT.headerH;
    const chartBot = chartTop + chartH;

    const volH = volOn ? chartH * LAYOUT.volRatio : 0;
    const priceH = chartH - volH;

    /* ---- clear ---- */
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, w, h);

    /* ---- loading / empty ---- */
    if (data.length === 0) {
      ctx.fillStyle = THEME.textMuted;
      ctx.font = '13px -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(loading ? 'Loading market data...' : 'No data available', w / 2, h / 2);
      return;
    }

    /* ---- visible range ---- */
    const startIdx = Math.max(0, Math.floor(-v.scrollX / zoom));
    const endIdx = Math.min(data.length, Math.ceil((chartW - v.scrollX) / zoom) + 1);

    /* ---- price range (visible) ---- */
    let pLo = Infinity, pHi = -Infinity;
    for (let i = startIdx; i < endIdx; i++) {
      if (data[i].low < pLo) pLo = data[i].low;
      if (data[i].high > pHi) pHi = data[i].high;
    }
    // Include SMA in range
    const sma20Data = sma20on ? calcSMA(data, 20) : [];
    const sma50Data = sma50on ? calcSMA(data, 50) : [];
    for (let i = startIdx; i < endIdx; i++) {
      if (sma20Data[i] != null) { pHi = Math.max(pHi, sma20Data[i]); pLo = Math.min(pLo, sma20Data[i]); }
      if (sma50Data[i] != null) { pHi = Math.max(pHi, sma50Data[i]); pLo = Math.min(pLo, sma50Data[i]); }
    }
    if (pLo >= pHi) { pLo -= 0.0005; pHi += 0.0005; }
    const rawRange = pHi - pLo;
    const pad = rawRange * 0.06;
    pLo -= pad; pHi += pad;
    const pRange = pHi - pLo;

    const priceToY = (p: number) => chartTop + (1 - (p - pLo) / pRange) * priceH;

    /* ---- nice price grid ---- */
    const step = niceStep(pRange, 8);
    const gridStart = Math.ceil(pLo / step) * step;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '10px monospace';

    for (let p = gridStart; p <= pHi; p += step) {
      const y = Math.round(priceToY(p)) + 0.5;
      ctx.strokeStyle = THEME.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartW, y);
      ctx.stroke();
      ctx.fillStyle = THEME.text;
      ctx.fillText(fmt(p), chartW + 6, y);
    }

    /* ---- time grid + labels ---- */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '10px monospace';

    const timeStepPx = Math.max(60, Math.min(120, zoom * 10));

    for (let i = startIdx; i < endIdx; i++) {
      const cx = i * zoom + v.scrollX + zoom / 2;
      if (cx < 0 || cx > chartW) continue;

      const prevB = Math.floor((cx - chartW + timeStepPx) / timeStepPx);
      const currB = Math.floor((cx - chartW) / timeStepPx);
      if (prevB !== currB) {
        const px = Math.round(cx) + 0.5;
        ctx.strokeStyle = THEME.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, chartTop);
        ctx.lineTo(px, chartBot - volH);
        ctx.stroke();

        const d = new Date(data[i].time);
        ctx.fillStyle = THEME.text;
        ctx.fillText(tzTime(d), cx, chartBot - volH + 4);
      }
    }

    /* ---- volume bars ---- */
    if (volOn && volH > 5) {
      let vMax = 0;
      for (let i = startIdx; i < endIdx; i++) {
        if (data[i].volume > vMax) vMax = data[i].volume;
      }
      if (vMax > 0) {
        for (let i = startIdx; i < endIdx; i++) {
          const c = data[i];
          const cx = i * zoom + v.scrollX;
          if (cx + zoom < 0 || cx > chartW) continue;
          const bull = c.close >= c.open;
          const barH = (c.volume / vMax) * (volH - 4);
          const bx = cx + Math.max(1, zoom * 0.15);
          const bw = Math.max(1, zoom - Math.max(2, zoom * 0.3));
          ctx.fillStyle = bull ? THEME.volBull : THEME.volBear;
          ctx.fillRect(bx, chartBot - barH, bw, barH);
        }
      }
    }

    /* ================================================================ */
    /*  SMA LINES                                                         */
    /* ================================================================ */
    if (sma20on || sma50on) {
      // SMA 50 (behind SMA 20)
      if (sma50on) {
        ctx.beginPath();
        ctx.strokeStyle = THEME.sma50;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.7;
        let started = false;
        for (let i = startIdx; i < endIdx; i++) {
          if (sma50Data[i] == null) continue;
          const cx = i * zoom + v.scrollX + zoom / 2;
          const cy = priceToY(sma50Data[i]!);
          if (!started) { ctx.moveTo(cx, cy); started = true; }
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // SMA 20
      if (sma20on) {
        ctx.beginPath();
        ctx.strokeStyle = THEME.sma20;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.8;
        let started = false;
        for (let i = startIdx; i < endIdx; i++) {
          if (sma20Data[i] == null) continue;
          const cx = i * zoom + v.scrollX + zoom / 2;
          const cy = priceToY(sma20Data[i]!);
          if (!started) { ctx.moveTo(cx, cy); started = true; }
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    /* ================================================================ */
    /*  CANDLESTICKS                                                      */
    /* ================================================================ */
    for (let i = startIdx; i < endIdx; i++) {
      const c = data[i];
      const cx = i * zoom + v.scrollX;
      if (cx + zoom < 0 || cx > chartW) continue;

      const bull = c.close >= c.open;
      const color = bull ? THEME.bull : THEME.bear;

      // Incomplete candle: slightly dimmer
      ctx.globalAlpha = c.complete ? 1 : 0.55;

      const yH = priceToY(c.high);
      const yL = priceToY(c.low);
      const yO = priceToY(c.open);
      const yC = priceToY(c.close);
      const midX = cx + zoom / 2;

      // Wick — crisp 1px line
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(midX) + 0.5, Math.round(yH));
      ctx.lineTo(Math.round(midX) + 0.5, Math.round(yL));
      ctx.stroke();

      // Body
      const bodyTop = Math.min(yO, yC);
      const bodyBot = Math.max(yO, yC);
      const bodyH = Math.max(Math.abs(bodyBot - bodyTop), 1);
      const bw = Math.max(1, zoom * 0.65);
      const bx = Math.round(midX - bw / 2);

      // Bull: filled body. Bear: filled body (standard)
      ctx.fillStyle = color;
      ctx.fillRect(bx, Math.round(bodyTop), Math.round(bw), Math.round(bodyH));

      ctx.globalAlpha = 1;
    }

    /* ================================================================ */
    /*  LAST PRICE LINE                                                   */
    /* ================================================================ */
    const last = data[data.length - 1];
    if (last) {
      const yLast = priceToY(last.close);
      const isBull = last.close >= last.open;
      const lc = isBull ? THEME.bull : THEME.bear;

      // Dashed line
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = lc;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(yLast) + 0.5);
      ctx.lineTo(chartW, Math.round(yLast) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.restore();

      // Price tag
      const tagW = LAYOUT.priceW - 6;
      const tagH = 18;
      const tagX = chartW + 3;
      const tagY = Math.round(yLast - tagH / 2);
      const r = 3;
      ctx.fillStyle = lc;
      ctx.beginPath();
      ctx.moveTo(tagX + r, tagY);
      ctx.lineTo(tagX + tagW - r, tagY);
      ctx.quadraticCurveTo(tagX + tagW, tagY, tagX + tagW, tagY + r);
      ctx.lineTo(tagX + tagW, tagY + tagH - r);
      ctx.quadraticCurveTo(tagX + tagW, tagY + tagH, tagX + tagW - r, tagY + tagH);
      ctx.lineTo(tagX + r, tagY + tagH);
      ctx.quadraticCurveTo(tagX, tagY + tagH, tagX, tagY + tagH - r);
      ctx.lineTo(tagX, tagY + r);
      ctx.quadraticCurveTo(tagX, tagY, tagX + r, tagY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmt(last.close), tagX + tagW / 2, yLast);
    }

    /* ---- separator lines ---- */
    ctx.strokeStyle = THEME.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, LAYOUT.headerH + 0.5);
    ctx.lineTo(w, LAYOUT.headerH + 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(chartW + 0.5, LAYOUT.headerH);
    ctx.lineTo(chartW + 0.5, chartBot);
    ctx.stroke();

    /* ---- bottom OHLC bar bg ---- */
    ctx.fillStyle = THEME.bgPanel;
    ctx.fillRect(0, chartBot, w, LAYOUT.timeH + LAYOUT.ohlcH);

    /* ---- OHLC values ---- */
    let hovered: Candle | null = null;
    let hoverIdx = -1;
    if (v.showCross && data.length > 0) {
      hoverIdx = Math.floor((v.crossX - v.scrollX) / zoom);
      if (hoverIdx >= 0 && hoverIdx < data.length) hovered = data[hoverIdx];
    }
    const info = hovered || last;
    const ohlcY = chartBot + LAYOUT.timeH;

    if (info) {
      ctx.font = '10px monospace';
      ctx.textBaseline = 'middle';
      const cy = ohlcY + LAYOUT.ohlcH / 2;
      let xp = 8;
      const bull = info.close >= info.open;
      const ic = bull ? THEME.bull : THEME.bear;

      ctx.fillStyle = THEME.textBright;
      ctx.textAlign = 'left';
      const pLabel = formatPair(pair);
      ctx.fillText(pLabel, xp, cy);
      xp += ctx.measureText(pLabel).width + 12;

      ctx.fillStyle = ic;
      ctx.fillText(`O ${fmt(info.open)}`, xp, cy);
      xp += 65;
      ctx.fillStyle = THEME.bull;
      ctx.fillText(`H ${fmt(info.high)}`, xp, cy);
      xp += 65;
      ctx.fillStyle = THEME.bear;
      ctx.fillText(`L ${fmt(info.low)}`, xp, cy);
      xp += 65;
      ctx.fillStyle = ic;
      ctx.fillText(`C ${fmt(info.close)}`, xp, cy);
      xp += 65;

      // Change
      if (prevCandle && hovered) {
        const chg = info.close - (hovered === last && prevCandle ? prevCandle.close : info.open);
        const chgPct = ((chg / info.open) * 100);
        const chgColor = chg >= 0 ? THEME.bull : THEME.bear;
        ctx.fillStyle = chgColor;
        ctx.fillText(`${chg >= 0 ? '+' : ''}${chgPct.toFixed(3)}%`, xp, cy);
      }

      // Time
      if (info.time) {
        const td = new Date(info.time);
        ctx.fillStyle = THEME.textMuted;
        ctx.textAlign = 'right';
        const gLabel = granularity === 'M1' ? '1m' : granularity === 'M5' ? '5m' : granularity === 'M15' ? '15m' : granularity === 'H1' ? '1H' : granularity === 'H4' ? '4H' : '1D';
        ctx.fillText(`${gLabel}  ${tzTime(td)}`, chartW - 8, cy);
      }
    }

    /* ================================================================ */
    /*  CROSSHAIR                                                         */
    /* ================================================================ */
    if (v.showCross && v.crossX >= 0 && v.crossX <= chartW && v.crossY >= chartTop && v.crossY <= chartTop + priceH) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = THEME.crosshair;
      ctx.lineWidth = 1;

      // Horizontal
      ctx.beginPath();
      ctx.moveTo(0, Math.round(v.crossY) + 0.5);
      ctx.lineTo(chartW, Math.round(v.crossY) + 0.5);
      ctx.stroke();

      // Vertical
      ctx.beginPath();
      ctx.moveTo(Math.round(v.crossX) + 0.5, chartTop);
      ctx.lineTo(Math.round(v.crossX) + 0.5, chartBot - volH);
      ctx.stroke();

      ctx.setLineDash([]);

      // Y price label
      const crossPrice = pHi - ((v.crossY - chartTop) / priceH) * pRange;
      ctx.fillStyle = 'rgba(20,28,40,0.92)';
      ctx.fillRect(chartW + 3, v.crossY - 9, LAYOUT.priceW - 6, 18);
      ctx.fillStyle = THEME.textBright;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmt(crossPrice), chartW + LAYOUT.priceW / 2, v.crossY);

      // X time label
      if (hoverIdx >= 0 && hoverIdx < data.length) {
        const td = new Date(data[hoverIdx].time);
        const tStr = tzTime(td);
        const tw = ctx.measureText(tStr).width + 12;
        ctx.fillStyle = 'rgba(20,28,40,0.92)';
        ctx.fillRect(v.crossX - tw / 2, chartBot - volH + 2, tw, 18);
        ctx.fillStyle = THEME.textBright;
        ctx.textAlign = 'center';
        ctx.fillText(tStr, v.crossX, chartBot - volH + 11);
      }

      ctx.restore();
    }

    /* ---- header bg (drawn last to cover) ---- */
    ctx.fillStyle = THEME.bgPanel;
    ctx.fillRect(0, 0, w, LAYOUT.headerH);

  }, [pair, dec, fmt, tzTime, granularity, sma20on, sma50on, volOn, sma20, sma50, loading, lastCandle, prevCandle]);

  /* ---- RAF loop ---- */
  useEffect(() => {
    const loop = () => {
      applyClamp();
      if (dirtyRef.current) {
        dirtyRef.current = false;
        draw();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, applyClamp]);

  useEffect(() => { dirtyRef.current = true; }, [view, candles, sma20, sma50, granularity]);

  /* ================================================================== */
  /*  INTERACTION                                                         */
  /* ================================================================== */

  const getPos = useCallback((e: React.MouseEvent | MouseEvent | Touch) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  /* ---- mouse ---- */
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const pos = getPos(e.nativeEvent);
    const chartW = sizeRef.current.w - LAYOUT.priceW;
    const ratio = Math.max(0, Math.min(1, pos.x / chartW));
    const v = viewRef.current;
    const oldZoom = v.zoom;
    const factor = e.deltaY > 0 ? 0.88 : 1.12;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));

    // Zoom toward cursor position
    const totalW = candlesRef.current.length * newZoom;
    const newScrollX = pos.x - ratio * totalW;

    setView(prev => ({ ...prev, zoom: newZoom, scrollX: newScrollX }));
    dirtyRef.current = true;
  }, [getPos]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getPos(e);
    isDragRef.current = true;
    dragStartRef.current = { x: pos.x, scrollX: viewRef.current.scrollX };

    // If near right edge, keep auto-follow
    const clamp = getClamp();
    autoFollowRef.current = viewRef.current.scrollX <= clamp + viewRef.current.zoom;
  }, [getPos, getClamp]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getPos(e);
    if (isDragRef.current) {
      const dx = pos.x - dragStartRef.current.x;
      const newScrollX = dragStartRef.current.scrollX + dx;
      autoFollowRef.current = false;
      setView(prev => ({ ...prev, scrollX: newScrollX, crossX: pos.x, crossY: pos.y, showCross: true }));
    } else {
      const chartH = sizeRef.current.h - LAYOUT.headerH - LAYOUT.timeH - LAYOUT.ohlcH;
      const vis = pos.y >= LAYOUT.headerH && pos.y <= LAYOUT.headerH + chartH * (1 - LAYOUT.volRatio);
      setView(prev => ({ ...prev, crossX: pos.x, crossY: pos.y, showCross: vis }));
    }
    dirtyRef.current = true;
  }, [getPos]);

  const onMouseUp = useCallback(() => {
    if (isDragRef.current) {
      const clamp = getClamp();
      if (viewRef.current.scrollX <= clamp + viewRef.current.zoom) {
        autoFollowRef.current = true;
      }
    }
    isDragRef.current = false;
    setView(prev => ({ ...prev, isDragging: false }));
  }, [getClamp]);

  const onMouseLeave = useCallback(() => {
    isDragRef.current = false;
    setView(prev => ({ ...prev, showCross: false }));
    dirtyRef.current = true;
  }, []);

  /* ---- touch ---- */
  const pinchDist = (t: React.TouchList) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      pinchRef.current = pinchDist(e.touches);
      lastPinchZoomRef.current = viewRef.current.zoom;
      autoFollowRef.current = false;
      return;
    }
    if (e.touches.length === 1) {
      const pos = getPos(e.touches[0]);
      isDragRef.current = true;
      dragStartRef.current = { x: pos.x, scrollX: viewRef.current.scrollX };
      setView(prev => ({ ...prev, crossX: pos.x, crossY: pos.y, showCross: true }));
    }
  }, [getPos]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchRef.current > 0) {
      const d = pinchDist(e.touches);
      const ratio = d / pinchRef.current;
      pinchRef.current = d;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, lastPinchZoomRef.current * ratio));
      setView(prev => ({ ...prev, zoom: newZoom }));
      dirtyRef.current = true;
      return;
    }
    if (e.touches.length === 1 && isDragRef.current) {
      const pos = getPos(e.touches[0]);
      const dx = pos.x - dragStartRef.current.x;
      autoFollowRef.current = false;
      setView(prev => ({ ...prev, scrollX: dragStartRef.current.scrollX + dx, crossX: pos.x, crossY: pos.y }));
      dirtyRef.current = true;
    }
  }, [getPos]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = 0;
    if (e.touches.length === 0) {
      const clamp = getClamp();
      if (viewRef.current.scrollX <= clamp + viewRef.current.zoom) {
        autoFollowRef.current = true;
      }
      isDragRef.current = false;
      setView(prev => ({ ...prev, showCross: false }));
      dirtyRef.current = true;
    }
  }, [getClamp]);

  /* ---- zoom buttons ---- */
  const zoomIn = useCallback(() => {
    setView(prev => ({ ...prev, zoom: Math.min(MAX_ZOOM, prev.zoom * 1.3) }));
    dirtyRef.current = true;
  }, []);
  const zoomOut = useCallback(() => {
    setView(prev => ({ ...prev, zoom: Math.max(MIN_ZOOM, prev.zoom / 1.3) }));
    dirtyRef.current = true;
  }, []);
  const zoomReset = useCallback(() => {
    autoFollowRef.current = true;
    setView(prev => ({ ...prev, zoom: DEFAULT_ZOOM, scrollX: 0 }));
    dirtyRef.current = true;
  }, []);

  /* ---- pair/TF change ---- */
  const changePair = useCallback((p: string) => {
    setChartPair(p);
    setCandles([]);
    autoFollowRef.current = true;
    setView(prev => ({ ...prev, scrollX: 0 }));
    dirtyRef.current = true;
  }, [setChartPair]);

  const changeGranularity = useCallback((g: Granularity) => {
    setGranularity(g);
    setCandles([]);
    autoFollowRef.current = true;
    setView(prev => ({ ...prev, scrollX: 0 }));
    dirtyRef.current = true;
  }, []);

  /* ================================================================== */
  /*  RENDER                                                              */
  /* ================================================================== */

  const isBullLast = lastCandle ? lastCandle.close >= lastCandle.open : true;
  const spreadPips = lastCandle ? (lastCandle.spread * (isJPYPair(pair) ? 100 : 10000)).toFixed(1) : '0';

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" style={{ background: THEME.bg }}>
      {/* ===== HEADER BAR ===== */}
      <div
        className="flex items-center gap-2 px-2 shrink-0"
        style={{ height: LAYOUT.headerH, background: THEME.bgPanel, borderBottom: `1px solid ${THEME.border}` }}
      >
        {/* Pair + price */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-base text-emerald-400">{formatPair(pair)}</span>
          <span className="font-mono font-bold text-base" style={{ color: isBullLast ? THEME.bull : THEME.bear }}>
            {lastCandle ? fmt(lastCandle.close) : '---'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-1">
          {/* Granularity selector */}
          <select
            value={granularity}
            onChange={e => changeGranularity(e.target.value as Granularity)}
            className="rounded px-1.5 py-0.5 text-[11px] font-mono text-white outline-none cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${THEME.border}` }}
          >
            <option value="M1">1m</option>
            <option value="M5">5m</option>
            <option value="M15">15m</option>
            <option value="H1">1H</option>
            <option value="H4">4H</option>
            <option value="D">1D</option>
          </select>

          {/* Pair selector */}
          <select
            value={pair}
            onChange={e => changePair(e.target.value)}
            className="rounded px-1.5 py-0.5 text-[11px] font-mono text-white outline-none cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${THEME.border}` }}
          >
            {ALL_PAIRS.map(p => <option key={p} value={p}>{formatPair(p)}</option>)}
          </select>
        </div>

        <div className="flex-1" />

        {/* Indicator toggles */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            onClick={() => setSma20on(v => !v)}
            className="rounded px-2 py-0.5 text-[10px] font-mono transition-colors"
            style={{
              color: sma20on ? THEME.sma20 : THEME.textMuted,
              background: sma20on ? THEME.sma20bg : 'rgba(255,255,255,0.03)',
              border: `1px solid ${sma20on ? THEME.sma20 : THEME.border}`,
            }}
          >SMA 20</button>
          <button
            onClick={() => setSma50on(v => !v)}
            className="rounded px-2 py-0.5 text-[10px] font-mono transition-colors"
            style={{
              color: sma50on ? THEME.sma50 : THEME.textMuted,
              background: sma50on ? THEME.sma50bg : 'rgba(255,255,255,0.03)',
              border: `1px solid ${sma50on ? THEME.sma50 : THEME.border}`,
            }}
          >SMA 50</button>
          <button
            onClick={() => { setVolOn(v => !v); dirtyRef.current = true; }}
            className="rounded px-2 py-0.5 text-[10px] font-mono transition-colors"
            style={{
              color: volOn ? THEME.textBright : THEME.textMuted,
              background: volOn ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${volOn ? 'rgba(255,255,255,0.15)' : THEME.border}`,
            }}
          >VOL</button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 ml-1">
          <button onClick={zoomIn} className="rounded flex items-center justify-center text-emerald-400 hover:bg-white/[0.06] transition-colors"
            style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.04)', border: `1px solid ${THEME.border}` }}>
            <Plus size={13} />
          </button>
          <button onClick={zoomOut} className="rounded flex items-center justify-center text-emerald-400 hover:bg-white/[0.06] transition-colors"
            style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.04)', border: `1px solid ${THEME.border}` }}>
            <Minus size={13} />
          </button>
          <button onClick={zoomReset} className="rounded flex items-center justify-center text-emerald-400 hover:bg-white/[0.06] transition-colors"
            style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.04)', border: `1px solid ${THEME.border}` }}>
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* ===== CHART CANVAS ===== */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ touchAction: 'none' }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="rounded-lg px-4 py-3 text-sm font-mono" style={{ background: 'rgba(239,68,68,0.15)', color: THEME.bear, border: '1px solid rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM INFO ===== */}
      <div
        className="flex items-center gap-3 px-3 shrink-0 text-[10px] font-mono"
        style={{
          height: LAYOUT.ohlcH + LAYOUT.timeH,
          background: THEME.bgPanel,
          borderTop: `1px solid ${THEME.border}`,
          color: THEME.textMuted,
        }}
      >
        <span style={{ color: THEME.text }}>BID</span>
        <span>Spread: {spreadPips} pips</span>
        <span>{candles.length} candles</span>
        <div className="flex-1" />
        <span>{candles.filter(c => c.complete).length} complete</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: loading ? THEME.textMuted : THEME.bull }} />
          {loading ? 'Connecting...' : 'Live'}
        </span>
      </div>
    </div>
  );
}
