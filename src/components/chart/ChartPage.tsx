'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useStore, formatPair, isJPYPair, ALL_PAIRS } from '@/lib/store';
import { Plus, Minus, RotateCcw } from 'lucide-react';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface OHLC {
  o: number;
  h: number;
  l: number;
  cl: number;
  t: string;
  complete: boolean;
}

interface ChartState {
  data: OHLC[];
  offset: number;
  scale: number;
  isDragging: boolean;
  dragStartX: number;
  dragStartOffset: number;
  velocity: number;
  crosshairX: number;
  crosshairY: number;
  crosshairVisible: boolean;
}

/* ================================================================== */
/*  TradingView-style constants                                         */
/* ================================================================== */

const BG = '#0a0e17';
const GRID_COLOR = 'rgba(255,255,255,0.035)';
const GRID_COLOR_STRONG = 'rgba(255,255,255,0.06)';
const BULL = '#10b981';
const BEAR = '#ef4444';
const CROSSHAIR_COLOR = 'rgba(200,215,230,0.22)';

const PRICE_AXIS_W = 70;
const TIME_AXIS_H = 28;
const OHLC_BAR_H = 24;
const HEADER_H = 42;

// Core candle geometry — TradingView proportions
// At scale=1: each candle slot = BODY + GAP = 7px
// Body fills ~71% of slot, gap fills ~14% right side
const CANDLE_BODY = 5;
const CANDLE_GAP = 2;
const CANDLE_SLOT = CANDLE_BODY + CANDLE_GAP; // 7px per candle at scale 1

const MOMENTUM_DECAY = 0.92;
const MIN_SCALE = 0.4;
const MAX_SCALE = 10;
const REFRESH_MS = 5000;

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function ChartPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const pair = useStore(s => s.chartPair);
  const setChartPair = useStore(s => s.setChartPair);
  const currentTab = useStore(s => s.currentTab);
  const tzTime = useStore(s => s.tzTime);

  const [chart, setChart] = useState<ChartState>({
    data: [],
    offset: 0,
    scale: 1,
    isDragging: false,
    dragStartX: 0,
    dragStartOffset: 0,
    velocity: 0,
    crosshairX: -1,
    crosshairY: -1,
    crosshairVisible: false,
  });

  const dirtyRef = useRef(true);
  const rafRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const pinchDistRef = useRef(0);
  const lastDragXRef = useRef(0);
  const lastDragTimeRef = useRef(0);
  const chartRef = useRef(chart);
  const firstLoadRef = useRef(true);
  useEffect(() => { chartRef.current = chart; });

  const dec = isJPYPair(pair) ? 3 : 5;

  /* ---- helpers ---- */
  const fmt = useCallback((v: number) => v.toFixed(dec), [dec]);

  const clampOffset = useCallback(() => {
    const c = chartRef.current;
    const slotW = CANDLE_SLOT * c.scale;
    const chartW = sizeRef.current.w - PRICE_AXIS_W;

    if (chartW <= 0 || c.data.length === 0) return c.offset;

    const totalW = c.data.length * slotW;
    const minOffset = -(totalW - chartW);

    if (firstLoadRef.current && totalW > chartW) {
      c.offset = minOffset + 20;
      firstLoadRef.current = false;
    } else {
      if (c.offset < minOffset) c.offset = minOffset;
      if (c.offset > 0) c.offset = 0;
    }
    return c.offset;
  }, []);

  /* ---- fetch data ---- */
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/oanda?pair=${pair}&count=300&granularity=M1`);
      if (!res.ok) return;
      const json = await res.json();
      const raw = json?.candles;
      if (!Array.isArray(raw)) return;
      const mapped: OHLC[] = raw.map((c: Record<string, unknown>) => ({
        o: Number((c.mid as Record<string, string>)?.o ?? 0),
        h: Number((c.mid as Record<string, string>)?.h ?? 0),
        l: Number((c.mid as Record<string, string>)?.l ?? 0),
        cl: Number((c.mid as Record<string, string>)?.c ?? 0),
        t: String(c.time ?? ''),
        complete: Boolean(c.complete),
      }));
      setChart(prev => {
        if (prev.data.length === 0 && mapped.length > 0) {
          firstLoadRef.current = true;
          return { ...prev, data: mapped, offset: 0 };
        }
        return { ...prev, data: mapped };
      });
      dirtyRef.current = true;
    } catch {
      // silent
    }
  }, [pair]);

  /* ---- auto-refresh ---- */
  useEffect(() => {
    if (currentTab !== 'chart') return;
    const id = setInterval(fetchData, REFRESH_MS);
    fetchData();
    return () => clearInterval(id);
  }, [currentTab, fetchData]);

  /* ---- ResizeObserver ---- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          sizeRef.current = { w: width, h: height };
          dirtyRef.current = true;
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  /* ================================================================== */
  /*  DRAW — TradingView-accurate candlestick rendering                  */
  /* ================================================================== */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const c = chartRef.current;
    const { data, scale, offset, crosshairX, crosshairY, crosshairVisible } = c;

    /* ---- layout regions ---- */
    const chartTop = HEADER_H;
    const chartW = w - PRICE_AXIS_W;
    const chartH = h - HEADER_H - TIME_AXIS_H - OHLC_BAR_H;
    const chartBottom = chartTop + chartH;
    const chartRight = chartW;

    /* ---- clear ---- */
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    if (data.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Loading chart data...', w / 2, h / 2);
      return;
    }

    /* ---- scaled dimensions ---- */
    const slotW = CANDLE_SLOT * scale;
    const bodyW = CANDLE_BODY * scale;

    /* ---- visible slot range ---- */
    const startSlot = Math.max(0, Math.floor(-offset / slotW));
    const endSlot = Math.min(data.length, Math.ceil((chartW - offset) / slotW) + 1);

    /* ---- price range from VISIBLE candles only (TradingView-style) ---- */
    let priceLow = Infinity;
    let priceHigh = -Infinity;
    for (let i = startSlot; i < endSlot; i++) {
      if (data[i].l < priceLow) priceLow = data[i].l;
      if (data[i].h > priceHigh) priceHigh = data[i].h;
    }
    // Ensure minimum range for stability
    if (priceLow >= priceHigh) {
      priceLow -= 0.0005;
      priceHigh += 0.0005;
    }
    // 8% padding per side — TradingView-style
    const rawRange = priceHigh - priceLow;
    const pad = rawRange * 0.08;
    priceLow -= pad;
    priceHigh += pad;
    const priceRange = priceHigh - priceLow;

    /* ---- price → Y mapping ---- */
    const priceToY = (p: number) =>
      chartTop + (1 - (p - priceLow) / priceRange) * chartH;

    /* ---- horizontal grid lines + price labels ---- */
    const gridRows = 8;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '10px monospace';

    for (let i = 0; i <= gridRows; i++) {
      const frac = i / gridRows;
      const y = Math.round(chartTop + frac * chartH) + 0.5;
      const price = priceHigh - frac * priceRange;

      // Grid line
      ctx.strokeStyle = i === 0 || i === gridRows ? GRID_COLOR_STRONG : GRID_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();

      // Price label
      ctx.fillStyle = 'rgba(150,175,190,0.45)';
      ctx.fillText(fmt(price), chartRight + 8, y);
    }

    /* ---- vertical grid + time labels ---- */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '10px monospace';

    // Space time labels every ~80px of chart width
    const timeStepPx = 80;

    for (let s = startSlot; s < endSlot; s++) {
      const cx = s * slotW + offset + slotW / 2;
      // Place label when crossing a timeStepPx boundary
      const prevBoundary = Math.floor((cx - chartRight + timeStepPx) / timeStepPx);
      const currBoundary = Math.floor((cx - chartRight) / timeStepPx);
      if (cx >= 0 && cx <= chartRight && prevBoundary !== currBoundary) {
        // Vertical grid
        const px = Math.round(cx) + 0.5;
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, chartTop);
        ctx.lineTo(px, chartBottom);
        ctx.stroke();
        // Time label
        try {
          const d = new Date(data[s].t);
          ctx.fillStyle = 'rgba(150,175,190,0.45)';
          ctx.fillText(tzTime(d), cx, chartBottom + 6);
        } catch { /* ignore */ }
      }
    }

    /* ================================================================ */
    /*  CANDLESTICKS — TradingView rendering (visible only)             */
    /* ================================================================ */
    for (let i = startSlot; i < endSlot; i++) {
      const candle = data[i];
      const cx = i * slotW + offset + slotW / 2;

      // Skip off-screen candles
      if (cx + slotW < 0 || cx - slotW > chartW) continue;

      const bull = candle.cl >= candle.o;
      const color = bull ? BULL : BEAR;
      ctx.globalAlpha = candle.complete ? 1 : 0.5;

      const yH = priceToY(candle.h);
      const yL = priceToY(candle.l);
      const yO = priceToY(candle.o);
      const yC = priceToY(candle.cl);

      // Wick: 1px hairline from high to low
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(cx) + 0.5, Math.round(yH));
      ctx.lineTo(Math.round(cx) + 0.5, Math.round(yL));
      ctx.stroke();

      // Body: filled rectangle
      const bodyTop = Math.min(yO, yC);
      const bodyBot = Math.max(yO, yC);
      const bodyHeight = Math.max(Math.abs(bodyBot - bodyTop), 1);
      const bx = Math.round(cx - bodyW / 2);
      const by = Math.round(bodyTop);

      ctx.fillStyle = color;
      ctx.fillRect(bx, by, Math.round(bodyW), bodyHeight);

      ctx.globalAlpha = 1;
    }

    /* ---- last price line ---- */
    const last = data[data.length - 1];
    if (last) {
      const yLast = priceToY(last.cl);
      const isBull = last.cl >= last.o;
      const lc = isBull ? BULL : BEAR;

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = lc;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(yLast) + 0.5);
      ctx.lineTo(chartRight, Math.round(yLast) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Price tag on right axis
      ctx.fillStyle = lc;
      const tagW = PRICE_AXIS_W - 6;
      const tagH = 18;
      const tagX = chartRight + 3;
      const tagY = yLast - tagH / 2;
      const r = 3;
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
      ctx.fillText(fmt(last.cl), tagX + tagW / 2, yLast);
      ctx.restore();
    }

    /* ---- bottom info bar background ---- */
    ctx.fillStyle = 'rgba(10,14,23,0.95)';
    ctx.fillRect(0, chartBottom, w, TIME_AXIS_H + OHLC_BAR_H);

    /* ---- OHLC info bar ---- */
    let hovered: OHLC | null = null;
    if (crosshairVisible && data.length > 0) {
      const idx = Math.round((crosshairX - offset) / slotW);
      if (idx >= 0 && idx < data.length) hovered = data[idx];
    }
    const info = hovered || last;
    const ohlcY = chartBottom + TIME_AXIS_H + 2;

    if (info) {
      ctx.font = '10px monospace';
      ctx.textBaseline = 'middle';
      const cy = ohlcY + OHLC_BAR_H / 2;
      let xp = 10;

      const isBullInfo = info.cl >= info.o;
      const infoColor = isBullInfo ? BULL : BEAR;

      // Pair
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'left';
      ctx.fillText(formatPair(pair), xp, cy);
      xp += ctx.measureText(formatPair(pair)).width + 14;

      // O
      ctx.fillStyle = infoColor;
      ctx.fillText(`O ${fmt(info.o)}`, xp, cy);
      xp += 72;

      // H
      ctx.fillStyle = BULL;
      ctx.fillText(`H ${fmt(info.h)}`, xp, cy);
      xp += 72;

      // L
      ctx.fillStyle = BEAR;
      ctx.fillText(`L ${fmt(info.l)}`, xp, cy);
      xp += 72;

      // C
      ctx.fillStyle = infoColor;
      ctx.fillText(`C ${fmt(info.cl)}`, xp, cy);
      xp += 72;

      // Time
      if (info.t) {
        try {
          const td = new Date(info.t);
          ctx.fillStyle = 'rgba(150,175,190,0.3)';
          ctx.textAlign = 'right';
          ctx.fillText(`M1 · ${tzTime(td)}`, w - PRICE_AXIS_W - 10, cy);
        } catch { /* ignore */ }
      }
    }

    /* ---- crosshair ---- */
    if (
      crosshairVisible &&
      crosshairX >= 0 && crosshairX <= chartRight &&
      crosshairY >= chartTop && crosshairY <= chartBottom
    ) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = CROSSHAIR_COLOR;
      ctx.lineWidth = 1;

      // Horizontal
      ctx.beginPath();
      ctx.moveTo(0, Math.round(crosshairY) + 0.5);
      ctx.lineTo(chartRight, Math.round(crosshairY) + 0.5);
      ctx.stroke();

      // Vertical
      ctx.beginPath();
      ctx.moveTo(Math.round(crosshairX) + 0.5, chartTop);
      ctx.lineTo(Math.round(crosshairX) + 0.5, chartBottom);
      ctx.stroke();

      ctx.setLineDash([]);

      // Price label on Y axis
      const crossPrice = priceHigh - ((crosshairY - chartTop) / chartH) * priceRange;
      ctx.fillStyle = 'rgba(20,30,50,0.9)';
      ctx.fillRect(chartRight + 3, crosshairY - 9, PRICE_AXIS_W - 6, 18);
      ctx.fillStyle = 'rgba(200,215,230,0.8)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmt(crossPrice), chartRight + PRICE_AXIS_W / 2, crosshairY);
      ctx.restore();

      // Tooltip
      const tooltip = tooltipRef.current;
      if (tooltip && hovered) {
        const tBull = hovered.cl >= hovered.o;
        const tColor = tBull ? BULL : BEAR;
        tooltip.innerHTML = `
          <div style="color:${tColor};font-weight:bold;font-size:11px;margin-bottom:2px">${formatPair(pair)}</div>
          <div style="color:rgba(200,215,230,0.7);font-size:10px;line-height:1.7">
            <span style="color:#888">O</span> ${fmt(hovered.o)}
            <span style="color:#888;margin-left:6px">H</span> ${fmt(hovered.h)}<br/>
            <span style="color:#888">L</span> ${fmt(hovered.l)}
            <span style="color:#888;margin-left:6px">C</span> ${fmt(hovered.cl)}
          </div>
          <div style="color:rgba(150,175,190,0.35);font-size:9px;margin-top:2px">
            ${hovered.t ? new Date(hovered.t).toISOString().slice(0, 19).replace('T', ' ') : ''}
          </div>`;
        let tx = crosshairX + 16;
        let ty = crosshairY - 60;
        if (tx + 140 > chartRight) tx = crosshairX - 150;
        if (ty < chartTop) ty = crosshairY + 16;
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
        tooltip.style.display = 'block';
      }
    } else {
      const tooltip = tooltipRef.current;
      if (tooltip) tooltip.style.display = 'none';
    }

    /* ---- header bg (painted last so it covers) ---- */
    ctx.fillStyle = 'rgba(10,14,23,0.95)';
    ctx.fillRect(0, 0, w, HEADER_H);

    // Separator line
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HEADER_H - 0.5);
    ctx.lineTo(w, HEADER_H - 0.5);
    ctx.stroke();
  }, [pair, dec, fmt, tzTime]);

  /* ---- RAF loop ---- */
  useEffect(() => {
    const loop = () => {
      const c = chartRef.current;
      if (!c.isDragging && Math.abs(c.velocity) > 0.3) {
        clampOffset();
        c.velocity *= MOMENTUM_DECAY;
        setChart(prev => ({ ...prev, offset: chartRef.current.offset }));
        dirtyRef.current = true;
      }
      if (dirtyRef.current) {
        dirtyRef.current = false;
        draw();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [clampOffset, draw]);

  /* ---- clamp on data/scale change ---- */
  useEffect(() => {
    clampOffset();
    dirtyRef.current = true;
  }, [chart.data, chart.scale, clampOffset]);

  useEffect(() => { dirtyRef.current = true; }, [chart]);

  /* ---- interaction handlers ---- */
  const getPos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const { x } = getPos(e.nativeEvent);
    const chartW = sizeRef.current.w - PRICE_AXIS_W;
    const ratio = Math.max(0, Math.min(1, x / chartW));
    setChart(prev => {
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * factor));
      const newTotalW = prev.data.length * CANDLE_SLOT * newScale;
      return { ...prev, scale: newScale, offset: x - ratio * newTotalW };
    });
    dirtyRef.current = true;
  }, [getPos]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getPos(e);
    setChart(prev => ({
      ...prev, isDragging: true, dragStartX: pos.x, dragStartOffset: prev.offset, velocity: 0,
    }));
    lastDragXRef.current = pos.x;
    lastDragTimeRef.current = Date.now();
  }, [getPos]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getPos(e);
    setChart(prev => {
      if (prev.isDragging) {
        const dx = pos.x - prev.dragStartX;
        const dt = Date.now() - lastDragTimeRef.current;
        if (dt > 0) chartRef.current.velocity = (pos.x - lastDragXRef.current) / dt * 16;
        lastDragXRef.current = pos.x;
        lastDragTimeRef.current = Date.now();
        return { ...prev, offset: prev.dragStartOffset + dx, crosshairX: pos.x, crosshairY: pos.y, crosshairVisible: true };
      }
      const vis = pos.y >= HEADER_H && pos.y <= sizeRef.current.h - TIME_AXIS_H - OHLC_BAR_H;
      return { ...prev, crosshairX: pos.x, crosshairY: pos.y, crosshairVisible: vis };
    });
    dirtyRef.current = true;
  }, [getPos]);

  const onMouseUp = useCallback(() => { setChart(prev => ({ ...prev, isDragging: false })); }, []);
  const onMouseLeave = useCallback(() => {
    setChart(prev => ({ ...prev, isDragging: false, crosshairVisible: false }));
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    dirtyRef.current = true;
  }, []);

  /* ---- touch ---- */
  const touchDist = (t: React.TouchList) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) { pinchDistRef.current = touchDist(e.touches); return; }
    if (e.touches.length === 1) {
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;
      const x = e.touches[0].clientX - r.left, y = e.touches[0].clientY - r.top;
      setChart(prev => ({ ...prev, isDragging: true, dragStartX: x, dragStartOffset: prev.offset, velocity: 0, crosshairX: x, crosshairY: y, crosshairVisible: true }));
      lastDragXRef.current = x;
      lastDragTimeRef.current = Date.now();
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchDistRef.current > 0) {
      const d = touchDist(e.touches);
      const ratio = d / pinchDistRef.current;
      pinchDistRef.current = d;
      setChart(prev => ({ ...prev, scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * ratio)) }));
      dirtyRef.current = true;
      return;
    }
    if (e.touches.length === 1) {
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;
      const x = e.touches[0].clientX - r.left, y = e.touches[0].clientY - r.top;
      const dt = Date.now() - lastDragTimeRef.current;
      setChart(prev => {
        if (prev.isDragging && dt > 0) {
          chartRef.current.velocity = (x - lastDragXRef.current) / dt * 16;
          lastDragXRef.current = x;
          lastDragTimeRef.current = Date.now();
          return { ...prev, offset: prev.dragStartOffset + (x - prev.dragStartX), crosshairX: x, crosshairY: y };
        }
        return { ...prev, crosshairX: x, crosshairY: y };
      });
      dirtyRef.current = true;
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchDistRef.current = 0;
    if (e.touches.length === 0) {
      setChart(prev => ({ ...prev, isDragging: false, crosshairVisible: false }));
      if (tooltipRef.current) tooltipRef.current.style.display = 'none';
      dirtyRef.current = true;
    }
  }, []);

  /* ---- zoom buttons ---- */
  const zoomIn = useCallback(() => { setChart(prev => ({ ...prev, scale: Math.min(MAX_SCALE, prev.scale * 1.3) })); dirtyRef.current = true; }, []);
  const zoomOut = useCallback(() => { setChart(prev => ({ ...prev, scale: Math.max(MIN_SCALE, prev.scale / 1.3) })); dirtyRef.current = true; }, []);
  const zoomReset = useCallback(() => {
    setChart(prev => {
      const tw = prev.data.length * CANDLE_SLOT;
      const cw = sizeRef.current.w - PRICE_AXIS_W;
      return { ...prev, scale: 1, offset: Math.min(0, -(tw - cw + 20)), velocity: 0 };
    });
    dirtyRef.current = true;
  }, []);

  const lastPrice = chart.data.length > 0 ? chart.data[chart.data.length - 1].cl : 0;
  const isBullLast = chart.data.length > 0 ? chart.data[chart.data.length - 1].cl >= chart.data[chart.data.length - 1].o : true;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: 'none', background: BG }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header bar */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-3"
        style={{ height: HEADER_H, background: 'rgba(10,14,23,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-lg text-emerald-400">{formatPair(pair)}</span>
          <span className="font-mono font-bold text-lg" style={{ color: isBullLast ? BULL : BEAR }}>
            {lastPrice > 0 ? fmt(lastPrice) : '---'}
          </span>
          <span className="rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-2 py-0.5">M1</span>
        </div>
        <div className="flex-1" />
        <select
          value={pair}
          onChange={e => { setChartPair(e.target.value); firstLoadRef.current = true; setChart(prev => ({ ...prev, data: [], offset: 0, velocity: 0 })); dirtyRef.current = true; }}
          className="rounded-lg px-3 py-1.5 text-sm font-mono text-white outline-none cursor-pointer"
          style={{ background: '#0c1220', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {ALL_PAIRS.map(p => <option key={p} value={p}>{formatPair(p)}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <button onClick={zoomIn} className="rounded-lg flex items-center justify-center text-emerald-400 hover:bg-white/[0.06] transition-colors"
            style={{ width: 32, height: 32, background: 'rgba(12,18,32,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Plus size={14} />
          </button>
          <button onClick={zoomOut} className="rounded-lg flex items-center justify-center text-emerald-400 hover:bg-white/[0.06] transition-colors"
            style={{ width: 32, height: 32, background: 'rgba(12,18,32,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Minus size={14} />
          </button>
          <button onClick={zoomReset} className="rounded-lg flex items-center justify-center text-emerald-400 hover:bg-white/[0.06] transition-colors"
            style={{ width: 32, height: 32, background: 'rgba(12,18,32,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div ref={tooltipRef} className="absolute z-30 pointer-events-none rounded-lg px-2.5 py-2"
        style={{ display: 'none', background: 'rgba(12,18,32,0.92)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }} />
    </div>
  );
}
