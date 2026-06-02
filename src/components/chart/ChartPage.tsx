'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useStore, formatPair, isJPYPair, ALL_PAIRS } from '@/lib/store';
import { Plus, Minus, RotateCcw } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
  priceScale: number;
  isDragging: boolean;
  dragStartX: number;
  dragStartOffset: number;
  velocity: number;
  crosshairX: number;
  crosshairY: number;
  crosshairVisible: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BG = '#0a0e17';
const GRID = 'rgba(255,255,255,0.04)';
const BULL = '#10b981';
const BEAR = '#ef4444';
const CROSSHAIR_COLOR = 'rgba(200,215,230,0.25)';
const PRICE_AXIS_W = 68;
const TIME_AXIS_H = 24;
const OHLC_BAR_H = 22;
const HEADER_H = 40;
const BASE_WIDTH = 6;
const GAP = 2;
const MOMENTUM_DECAY = 0.92;
const MIN_SCALE = 0.3;
const MAX_SCALE = 8;
const REFRESH_MS = 5000;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
    priceScale: 1,
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chartRef = useRef(chart);
  const firstLoadRef = useRef(true); // tracks first data load for scroll-to-end
  useEffect(() => { chartRef.current = chart; });

  const dec = isJPYPair(pair) ? 3 : 5;

  /* ---- helpers ---- */
  const fmt = useCallback(
    (v: number) => v.toFixed(dec),
    [dec],
  );

  const clampOffset = useCallback(() => {
    const c = chartRef.current;
    const cw = (BASE_WIDTH + GAP) * c.scale;
    const chartW = sizeRef.current.w - PRICE_AXIS_W;

    // If container size not ready, skip
    if (chartW <= 0) return c.offset;

    const totalW = c.data.length * cw;
    const minOffset = -(totalW - chartW);
    const maxOffset = 0;

    // First load: scroll to end (show latest candles on the right)
    if (firstLoadRef.current && totalW > chartW) {
      c.offset = minOffset + 10; // 10px padding from right edge
      firstLoadRef.current = false;
    } else {
      if (c.offset < minOffset) c.offset = minOffset;
      if (c.offset > maxOffset) c.offset = maxOffset;
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
          // Mark first load — clampOffset will compute correct offset once size is ready
          firstLoadRef.current = true;
          return { ...prev, data: mapped, offset: 0 };
        }
        return { ...prev, data: mapped };
      });
      dirtyRef.current = true;
    } catch {
      // silently ignore fetch errors
    }
  }, [pair]);

  /* ---- auto-refresh (only when chart tab active) ---- */
  useEffect(() => {
    if (currentTab !== 'chart') return;
    const id = setInterval(fetchData, REFRESH_MS);
    // Initial data fetch on mount
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

  /* ---- draw function ---- */
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

    const chartLeft = 0;
    const chartTop = HEADER_H;
    const chartW = w - PRICE_AXIS_W;
    const chartH = h - HEADER_H - TIME_AXIS_H - OHLC_BAR_H;
    const chartRight = chartLeft + chartW;
    const chartBottom = chartTop + chartH;

    /* background */
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    if (data.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Loading chart data...', w / 2, h / 2);
      return;
    }

    const cw = (BASE_WIDTH + GAP) * scale;
    const candleW = BASE_WIDTH * scale;

    /* price range from visible candles */
    let visMin = Infinity;
    let visMax = -Infinity;
    for (let i = 0; i < data.length; i++) {
      const cx = i * cw + offset;
      if (cx + cw / 2 >= 0 && cx - cw / 2 <= chartW) {
        if (data[i].l < visMin) visMin = data[i].l;
        if (data[i].h > visMax) visMax = data[i].h;
      }
    }
    if (visMin === Infinity) {
      visMin = data[0].l;
      visMax = data[0].h;
    }
    const rawRange = visMax - visMin;
    const padRange = Math.max(rawRange * 0.1, rawRange === 0 ? 0.001 : 0);
    visMin -= padRange;
    visMax += padRange;
    const range = visMax - visMin;

    /* price-to-y mapping */
    const priceToY = (p: number) => chartTop + (1 - (p - visMin) / range) * chartH;

    /* ---- grid lines (horizontal) ---- */
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    const hLines = 7;
    for (let i = 0; i <= hLines; i++) {
      const y = Math.round(chartTop + (i / hLines) * chartH) + 0.5;
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
    }

    /* ---- grid lines (vertical) ---- */
    const vStep = Math.max(60, Math.round(80 * scale));
    const vStart = Math.ceil(-offset / vStep) * vStep;
    for (let x = vStart; x < chartW; x += vStep) {
      const px = Math.round(x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, chartTop);
      ctx.lineTo(px, chartBottom);
      ctx.stroke();
    }

    /* ---- candles (TradingView-style rendering) ---- */
    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      const cx = i * cw + offset + candleW / 2;
      if (cx + candleW / 2 < 0 || cx - candleW / 2 > chartW) continue;

      const bull = candle.cl >= candle.o;
      const color = bull ? BULL : BEAR;
      const alpha = candle.complete ? 1 : 0.55;
      ctx.globalAlpha = alpha;

      const yHigh = priceToY(candle.h);
      const yLow = priceToY(candle.l);
      const yOpen = priceToY(candle.o);
      const yClose = priceToY(candle.cl);

      /* Wick: always 1px hairline, exactly like TradingView */
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, yHigh);
      ctx.lineTo(cx, yLow);
      ctx.stroke();

      /* Body: ~60% of slot width, centered — TradingView proportion */
      const bodyWidth = Math.max(Math.round(candleW * 0.6), 1);
      const bodyLeft = cx - bodyWidth / 2;

      if (bull) {
        /* BULLISH: Close > Open
           Body top = Close (higher price = lower Y)
           Body bottom = Open (lower price = higher Y) */
        const bodyTop = yClose;
        const bodyBot = yOpen;
        const bodyH = Math.max(bodyBot - bodyTop, 1); // 1px for doji

        ctx.fillStyle = color;
        ctx.fillRect(
          Math.round(bodyLeft) + 0.5,
          Math.round(bodyTop) + 0.5,
          bodyWidth,
          Math.round(bodyH)
        );
      } else {
        /* BEARISH: Open > Close
           Body top = Open (higher price = lower Y)
           Body bottom = Close (lower price = higher Y) */
        const bodyTop = yOpen;
        const bodyBot = yClose;
        const bodyH = Math.max(bodyBot - bodyTop, 1); // 1px for doji

        ctx.fillStyle = color;
        ctx.fillRect(
          Math.round(bodyLeft) + 0.5,
          Math.round(bodyTop) + 0.5,
          bodyWidth,
          Math.round(bodyH)
        );
      }

      ctx.globalAlpha = 1;
    }

    /* ---- last price line ---- */
    const lastCandle = data[data.length - 1];
    if (lastCandle) {
      const lastY = priceToY(lastCandle.cl);
      const isBull = lastCandle.cl >= lastCandle.o;
      const lineColor = isBull ? BULL : BEAR;

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(chartLeft, lastY);
      ctx.lineTo(chartRight, lastY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      /* price tag on axis */
      ctx.fillStyle = lineColor;
      const tagW = PRICE_AXIS_W - 4;
      const tagH = 18;
      const tagX = chartRight + 2;
      const tagY = lastY - tagH / 2;
      const radius = 4;
      ctx.beginPath();
      ctx.moveTo(tagX + radius, tagY);
      ctx.lineTo(tagX + tagW - radius, tagY);
      ctx.quadraticCurveTo(tagX + tagW, tagY, tagX + tagW, tagY + radius);
      ctx.lineTo(tagX + tagW, tagY + tagH - radius);
      ctx.quadraticCurveTo(tagX + tagW, tagY + tagH, tagX + tagW - radius, tagY + tagH);
      ctx.lineTo(tagX + radius, tagY + tagH);
      ctx.quadraticCurveTo(tagX, tagY + tagH, tagX, tagY + tagH - radius);
      ctx.lineTo(tagX, tagY + radius);
      ctx.quadraticCurveTo(tagX, tagY, tagX + radius, tagY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmt(lastCandle.cl), tagX + tagW / 2, lastY);
      ctx.restore();
    }

    /* ---- price axis labels ---- */
    ctx.fillStyle = 'rgba(150,175,190,0.5)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= hLines; i++) {
      const frac = i / hLines;
      const price = visMax - frac * range;
      const y = chartTop + frac * chartH;
      ctx.fillText(fmt(price), chartRight + 6, y);
    }

    /* ---- time axis labels ---- */
    ctx.fillStyle = 'rgba(150,175,190,0.5)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const timeY = chartBottom + 4;
    for (let x = vStart; x < chartW; x += vStep) {
      const idx = Math.round((x - offset) / cw);
      if (idx >= 0 && idx < data.length) {
        try {
          const d = new Date(data[idx].t);
          ctx.fillText(tzTime(d), x, timeY);
        } catch {
          // ignore parse errors
        }
      }
    }

    /* ---- time axis bg ---- */
    ctx.fillStyle = 'rgba(10,14,23,0.95)';
    ctx.fillRect(0, chartBottom, w, TIME_AXIS_H + OHLC_BAR_H);

    /* ---- OHLC info bar ---- */
    let hoveredCandle: OHLC | null = null;
    if (crosshairVisible && data.length > 0) {
      const idx = Math.round((crosshairX - offset) / cw);
      if (idx >= 0 && idx < data.length) {
        hoveredCandle = data[idx];
      }
    }
    const infoCandle = hoveredCandle || lastCandle;
    const ohlcY = chartBottom + TIME_AXIS_H + 2;

    if (infoCandle) {
      ctx.font = '10px monospace';
      ctx.textBaseline = 'middle';
      let xPos = 8;

      ctx.fillStyle = BULL;
      ctx.textAlign = 'left';
      ctx.fillText(`O ${fmt(infoCandle.o)}`, xPos, ohlcY + OHLC_BAR_H / 2);
      xPos += 80;

      ctx.fillStyle = BULL;
      ctx.fillText(`H ${fmt(infoCandle.h)}`, xPos, ohlcY + OHLC_BAR_H / 2);
      xPos += 80;

      ctx.fillStyle = BEAR;
      ctx.fillText(`L ${fmt(infoCandle.l)}`, xPos, ohlcY + OHLC_BAR_H / 2);
      xPos += 80;

      const isBullC = infoCandle.cl >= infoCandle.o;
      ctx.fillStyle = isBullC ? BULL : BEAR;
      ctx.fillText(`C ${fmt(infoCandle.cl)}`, xPos, ohlcY + OHLC_BAR_H / 2);
      xPos += 80;

      if (infoCandle.t) {
        try {
          const td = new Date(infoCandle.t);
          ctx.fillStyle = 'rgba(150,175,190,0.4)';
          ctx.textAlign = 'right';
          ctx.fillText(`M1  ${tzTime(td)} UTC`, w - PRICE_AXIS_W - 8, ohlcY + OHLC_BAR_H / 2);
        } catch {
          // ignore
        }
      }
    }

    /* ---- crosshair ---- */
    if (
      crosshairVisible &&
      crosshairX >= chartLeft &&
      crosshairX <= chartRight &&
      crosshairY >= chartTop &&
      crosshairY <= chartBottom
    ) {
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = CROSSHAIR_COLOR;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(chartLeft, crosshairY);
      ctx.lineTo(chartRight, crosshairY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(crosshairX, chartTop);
      ctx.lineTo(crosshairX, chartBottom);
      ctx.stroke();

      ctx.setLineDash([]);

      /* price label on crosshair Y */
      const crossPrice = visMax - ((crosshairY - chartTop) / chartH) * range;
      ctx.fillStyle = 'rgba(20,30,50,0.85)';
      const lblW = 56;
      const lblH = 16;
      ctx.fillRect(chartRight + 2, crosshairY - lblH / 2, lblW, lblH);
      ctx.fillStyle = 'rgba(200,215,230,0.8)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmt(crossPrice), chartRight + 2 + lblW / 2, crosshairY);

      ctx.restore();

      /* tooltip */
      const tooltip = tooltipRef.current;
      if (tooltip && hoveredCandle) {
        const bull = hoveredCandle.cl >= hoveredCandle.o;
        const color = bull ? BULL : BEAR;
        tooltip.innerHTML = `
          <div style="color:${color};font-weight:bold;font-size:11px;margin-bottom:2px;">
            ${formatPair(pair)}
          </div>
          <div style="color:rgba(200,215,230,0.7);font-size:10px;line-height:1.6;">
            <span style="color:#aaa">O</span> ${fmt(hoveredCandle.o)}
            <span style="color:#aaa;margin-left:6px">H</span> ${fmt(hoveredCandle.h)}<br/>
            <span style="color:#aaa">L</span> ${fmt(hoveredCandle.l)}
            <span style="color:#aaa;margin-left:6px">C</span> ${fmt(hoveredCandle.cl)}
          </div>
          <div style="color:rgba(150,175,190,0.4);font-size:9px;margin-top:2px;">
            ${hoveredCandle.t ? new Date(hoveredCandle.t).toISOString().slice(0, 19).replace('T', ' ') : ''}
          </div>
        `;
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

    /* ---- header bg ---- */
    ctx.fillStyle = 'rgba(10,14,23,0.92)';
    ctx.fillRect(0, 0, w, HEADER_H);
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

  /* ---- sync clampOffset ---- */
  useEffect(() => {
    clampOffset();
    dirtyRef.current = true;
  }, [chart.data, chart.scale, clampOffset]);

  /* ---- mark dirty when state changes ---- */
  useEffect(() => {
    dirtyRef.current = true;
  }, [chart]);

  /* ---- mouse / touch handlers ---- */
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
    const mouseRatio = Math.max(0, Math.min(1, x / chartW));

    setChart(prev => {
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * zoomFactor));
      const stepW = BASE_WIDTH + GAP;
      const newTotalW = prev.data.length * stepW * newScale;
      const newOffset = x - mouseRatio * newTotalW;
      return { ...prev, scale: newScale, offset: newOffset };
    });
    dirtyRef.current = true;
  }, [getPos]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getPos(e);
    setChart(prev => ({
      ...prev,
      isDragging: true,
      dragStartX: pos.x,
      dragStartOffset: prev.offset,
      velocity: 0,
    }));
    lastDragXRef.current = pos.x;
    lastDragTimeRef.current = Date.now();
  }, [getPos]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getPos(e);
    setChart(prev => {
      if (prev.isDragging) {
        const dx = pos.x - prev.dragStartX;
        const now = Date.now();
        const dt = now - lastDragTimeRef.current;
        if (dt > 0) {
          const newVel = (pos.x - lastDragXRef.current) / dt * 16;
          chartRef.current.velocity = newVel;
        }
        lastDragXRef.current = pos.x;
        lastDragTimeRef.current = now;
        return {
          ...prev,
          offset: prev.dragStartOffset + dx,
          crosshairX: pos.x,
          crosshairY: pos.y,
          crosshairVisible: true,
        };
      }
      const cTop = HEADER_H;
      const cH = sizeRef.current.h - HEADER_H - TIME_AXIS_H - OHLC_BAR_H;
      const cBottom = cTop + cH;
      const visible = pos.y >= cTop && pos.y <= cBottom;
      return {
        ...prev,
        crosshairX: pos.x,
        crosshairY: pos.y,
        crosshairVisible: visible,
      };
    });
    dirtyRef.current = true;
  }, [getPos]);

  const onMouseUp = useCallback(() => {
    setChart(prev => ({ ...prev, isDragging: false }));
  }, []);

  const onMouseLeave = useCallback(() => {
    setChart(prev => ({
      ...prev,
      isDragging: false,
      crosshairVisible: false,
    }));
    const tooltip = tooltipRef.current;
    if (tooltip) tooltip.style.display = 'none';
    dirtyRef.current = true;
  }, []);

  /* ---- touch handlers ---- */
  const getTouchDist = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      pinchDistRef.current = getTouchDist(e.touches);
      return;
    }
    if (e.touches.length === 1) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;
      setChart(prev => ({
        ...prev,
        isDragging: true,
        dragStartX: x,
        dragStartOffset: prev.offset,
        velocity: 0,
        crosshairX: x,
        crosshairY: y,
        crosshairVisible: true,
      }));
      lastDragXRef.current = x;
      lastDragTimeRef.current = Date.now();
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchDistRef.current > 0) {
      const dist = getTouchDist(e.touches);
      const ratio = dist / pinchDistRef.current;
      pinchDistRef.current = dist;
      setChart(prev => {
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * ratio));
        return { ...prev, scale: newScale };
      });
      dirtyRef.current = true;
      return;
    }
    if (e.touches.length === 1) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;
      const now = Date.now();
      const dt = now - lastDragTimeRef.current;
      setChart(prev => {
        if (prev.isDragging) {
          const dx = x - prev.dragStartX;
          if (dt > 0) {
            chartRef.current.velocity = (x - lastDragXRef.current) / dt * 16;
          }
          lastDragXRef.current = x;
          lastDragTimeRef.current = now;
          return {
            ...prev,
            offset: prev.dragStartOffset + dx,
            crosshairX: x,
            crosshairY: y,
          };
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
      const tooltip = tooltipRef.current;
      if (tooltip) tooltip.style.display = 'none';
      dirtyRef.current = true;
    }
  }, []);

  /* ---- zoom buttons ---- */
  const zoomIn = useCallback(() => {
    setChart(prev => ({ ...prev, scale: Math.min(MAX_SCALE, prev.scale * 1.3) }));
    dirtyRef.current = true;
  }, []);

  const zoomOut = useCallback(() => {
    setChart(prev => ({ ...prev, scale: Math.max(MIN_SCALE, prev.scale / 1.3) }));
    dirtyRef.current = true;
  }, []);

  const zoomReset = useCallback(() => {
    setChart(prev => {
      const stepW = (BASE_WIDTH + GAP) * 1; // at scale 1
      const chartW = sizeRef.current.w - PRICE_AXIS_W;
      const totalW = prev.data.length * stepW;
      const endOffset = Math.min(0, -(totalW - chartW + 10));
      return { ...prev, scale: 1, offset: endOffset, velocity: 0 };
    });
    dirtyRef.current = true;
  }, []);

  const lastPrice = chart.data.length > 0 ? chart.data[chart.data.length - 1].cl : 0;
  const isBullLast = chart.data.length > 0
    ? chart.data[chart.data.length - 1].cl >= chart.data[chart.data.length - 1].o
    : true;

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
      {/* Chart header bar */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-3"
        style={{
          height: HEADER_H,
          background: 'rgba(10,14,23,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Pair name + live price */}
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-lg text-emerald-400">
            {formatPair(pair)}
          </span>
          <span
            className="font-mono font-bold text-lg"
            style={{ color: isBullLast ? BULL : BEAR }}
          >
            {lastPrice > 0 ? fmt(lastPrice) : '---'}
          </span>
          <span className="rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-2 py-0.5">
            M1
          </span>
        </div>

        <div className="flex-1" />

        {/* Pair selector dropdown */}
        <select
          value={pair}
          onChange={e => {
            setChartPair(e.target.value);
            firstLoadRef.current = true;
            setChart(prev => ({ ...prev, data: [], offset: 0, velocity: 0 }));
            dirtyRef.current = true;
          }}
          className="rounded-lg px-3 py-1.5 text-sm font-mono text-white outline-none cursor-pointer"
          style={{
            background: '#0c1220',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {ALL_PAIRS.map(p => (
            <option key={p} value={p}>
              {formatPair(p)}
            </option>
          ))}
        </select>

        {/* Zoom buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomIn}
            className="rounded-lg flex items-center justify-center text-emerald-400 hover:bg-white/[0.06] transition-colors"
            style={{
              width: 32,
              height: 32,
              background: 'rgba(12,18,32,0.9)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Plus size={14} />
          </button>
          <button
            onClick={zoomOut}
            className="rounded-lg flex items-center justify-center text-emerald-400 hover:bg-white/[0.06] transition-colors"
            style={{
              width: 32,
              height: 32,
              background: 'rgba(12,18,32,0.9)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Minus size={14} />
          </button>
          <button
            onClick={zoomReset}
            className="rounded-lg flex items-center justify-center text-emerald-400 hover:bg-white/[0.06] transition-colors"
            style={{
              width: 32,
              height: 32,
              background: 'rgba(12,18,32,0.9)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Floating tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-30 pointer-events-none rounded-lg px-2.5 py-2"
        style={{
          display: 'none',
          background: 'rgba(12,18,32,0.92)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          whiteSpace: 'nowrap',
        }}
      />
    </div>
  );
}
