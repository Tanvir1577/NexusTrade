// ══════════════════════════════════════════════════════════════════════
// HUNTER X QUANTEX v5.0 — SMART CONTEXT-GATED Signal Engine
//
// Architecture:
//   LAYER 1: PRE-FILTER GATES (kill noise before pattern detection)
//     - ATR Gate: candle must be significant relative to average range
//     - Dead Zone: skip when volatility is too low (flat market)
//     - Consolidation: skip when market is ranging sideways
//   LAYER 2: CONTEXT ANALYSIS
//     - Trend direction + strength via EMA20
//     - Support/Resistance from 30-candle extremes
//     - Market phase classification
//   LAYER 3: PATTERN DETECTION (all 74 patterns)
//   LAYER 4: SMART CONSENSUS
//     - Minimum 3 patterns must agree
//     - 1.8x domination required
//     - Trend alignment bonus
//     - Multi-category confirmation
//     - Minimum raw score threshold
// ══════════════════════════════════════════════════════════════════════

interface CandleData {
  mid: { o: string; h: string; l: string; c: string };
  time: string;
  complete: boolean;
}

interface OHLC {
  o: number; h: number; l: number; cl: number; t: string;
}

interface PatternResult {
  logic: string;
  dir: 'UP' | 'DOWN';
  score: number;
  category: 'reversal' | 'continuation' | 'momentum' | 'technical' | 'structural' | 'wick';
}

interface SignalResult {
  pair: string;
  dir: 'UP' | 'DOWN';
  score: number;
  logic: string;
  logics: string[];
  price: number;
  time: string;
}

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════

const bd = (c: OHLC) => Math.abs(c.cl - c.o);
const rng = (c: OHLC) => c.h - c.l || 0.0001;
const uW = (c: OHLC) => c.h - Math.max(c.cl, c.o);
const lW = (c: OHLC) => Math.min(c.cl, c.o) - c.l;
const bull = (c: OHLC) => c.cl > c.o;
const bear = (c: OHLC) => c.cl < c.o;
const dojiLike = (c: OHLC) => bd(c) / rng(c) < 0.1;

// ══════════════════════════════════════════════════════════════════════
// LAYER 1: PRE-FILTER GATES
// ══════════════════════════════════════════════════════════════════════

function computeATR(candles: OHLC[], period: number = 14): number {
  if (candles.length < period + 1) return 0;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];
    const tr = Math.max(cur.h - cur.l, Math.abs(cur.h - prev.cl), Math.abs(cur.l - prev.cl));
    sum += tr;
  }
  return sum / period;
}

function isConsolidation(candles: OHLC[]): boolean {
  if (candles.length < 15) return false;
  const last15 = candles.slice(-15);
  const highs = last15.map(x => x.h);
  const lows = last15.map(x => x.l);
  const range = Math.max(...highs) - Math.min(...lows);
  const atr = computeATR(candles, 14);
  if (atr === 0) return true;
  // If the 15-candle range is less than 3x ATR, market is ranging
  return range < atr * 3;
}

function isDeadZone(candles: OHLC[]): boolean {
  const atr = computeATR(candles, 14);
  // ATR too small = flat/dead market — patterns are meaningless
  // For non-JPY pairs: ATR < 0.0003 (0.3 pips)
  // For JPY pairs: ATR < 0.03 (3 pips)
  // We use relative check: ATR / price < 0.00002
  if (candles.length < 15) return true;
  const price = candles[candles.length - 1].cl;
  return (atr / price) < 0.000015;
}

interface MarketContext {
  atr: number;
  trendDir: 'UP' | 'DOWN' | 'NEUTRAL';
  trendStrength: number; // 0-1
  isRanging: boolean;
  isDead: boolean;
  ema20: number;
  support: number;
  resistance: number;
}

function analyzeContext(candles: OHLC[]): MarketContext {
  const atr = computeATR(candles, 14);

  // EMA20 for trend
  const ema = (arr: number[], p: number) => {
    const k = 2 / (p + 1);
    let e = arr[0];
    for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
    return e;
  };
  const closes = candles.map(x => x.cl);
  const ema20val = ema(closes.slice(-20), 20);
  const ema20prev = ema(closes.slice(-21, -1).slice(-20), 20);

  // Trend direction from EMA20 slope
  const slope = ema20val - ema20prev;
  const slopeStrength = Math.min(1, Math.abs(slope) / (atr * 0.3));
  const trendDir: 'UP' | 'DOWN' | 'NEUTRAL' = slope > atr * 0.05 ? 'UP' : slope < -atr * 0.05 ? 'DOWN' : 'NEUTRAL';

  // Support/Resistance from 30-candle extremes
  const r30 = candles.slice(-30);
  const sortedLows = [...r30.map(x => x.l)].sort((a, b) => a - b);
  const sortedHighs = [...r30.map(x => x.h)].sort((a, b) => b - a);
  const support = sortedLows[2];
  const resistance = sortedHighs[2];

  return {
    atr,
    trendDir,
    trendStrength: slopeStrength,
    isRanging: isConsolidation(candles),
    isDead: isDeadZone(candles),
    ema20: ema20val,
    support,
    resistance,
  };
}

// ══════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ══════════════════════════════════════════════════════════════════════

export function analyzeCandles(candles: CandleData[], pair: string, minScore: number): SignalResult | null {
  if (!candles || candles.length < 20) return null;
  const closed = candles.filter(c => c.complete);
  if (closed.length < 20) return null; // increased from 15

  const c = closed.map(x => ({
    o: parseFloat(x.mid.o),
    h: parseFloat(x.mid.h),
    l: parseFloat(x.mid.l),
    cl: parseFloat(x.mid.c),
    t: x.time,
  }));

  // ──────────────────────────────────────────────────────────────
  // LAYER 1: PRE-FILTER GATES — kill noise BEFORE pattern detection
  // ──────────────────────────────────────────────────────────────

  const ctx = analyzeContext(c);

  // GATE 1: Dead zone — market is completely flat, no point analyzing
  if (ctx.isDead) return null;

  // GATE 2: Consolidation — ranging market, patterns will fail
  if (ctx.isRanging) return null;

  // GATE 3: ATR significance — the current candle must be at least 50% of ATR
  const curCandle = c[c.length - 1];
  const curRange = curCandle.h - curCandle.l;
  if (curRange < ctx.atr * 0.5) return null;

  // ──────────────────────────────────────────────────────────────
  // LAYER 2: CONTEXT is now available — we have trend, ATR, levels
  // ──────────────────────────────────────────────────────────────

  const res: PatternResult[] = [];
  const cur = () => c[c.length - 1];
  const prev = () => c[c.length - 2];

  const push = (logic: string, dir: 'UP' | 'DOWN', score: number, category: PatternResult['category']) =>
    res.push({ logic, dir, score, category });

  // ════════════════════════════════════════════════════════════════════
  // LAYER 3: PATTERN DETECTION — All 74 patterns
  // ════════════════════════════════════════════════════════════════════

  // ──────────────────────────────────────────────────────────
  // CATEGORY: REVERSAL — Single-Candle Patterns
  // ──────────────────────────────────────────────────────────

  // ── 1. ENGULFING (score 8) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    const bP = bd(p), bC = bd(q);
    if (bear(p) && bull(q) && bC > bP * 1.5 && q.o <= p.cl && q.cl >= p.o)
      push('ENGULFING', 'UP', 8, 'reversal');
    if (bull(p) && bear(q) && bC > bP * 1.5 && q.o >= p.cl && q.cl <= p.o)
      push('ENGULFING', 'DOWN', 8, 'reversal');
  })();

  // ── 2. HAMMER (score 7) — requires downtrend context ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q), u = uW(q), l = lW(q);
    if (l > b * 3 && l > u * 2.5 && b < r * 0.3 && ctx.trendDir === 'DOWN')
      push('HAMMER', 'UP', 7, 'reversal');
  })();

  // ── 3. SHOOTING_STAR (score 7) — requires uptrend context ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q), u = uW(q), l = lW(q);
    if (u > b * 3 && u > l * 2.5 && b < r * 0.3 && ctx.trendDir === 'UP')
      push('SHOOTING_STAR', 'DOWN', 7, 'reversal');
  })();

  // ── 4. DOJI_REVERSAL (score 6) ──
  (() => {
    const q = cur();
    if (dojiLike(q) && ctx.trendDir === 'DOWN') push('DOJI_REVERSAL', 'UP', 6, 'reversal');
    if (dojiLike(q) && ctx.trendDir === 'UP') push('DOJI_REVERSAL', 'DOWN', 6, 'reversal');
  })();

  // ── 5. PIN_BAR (score 8) ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q);
    const nose = bull(q) ? q.h - q.cl : q.o - q.h;
    const tail = bull(q) ? q.o - q.l : q.cl - q.l;
    if (tail > b * 3 && tail > nose * 2.5 && b < r * 0.25)
      push('PIN_BAR', 'UP', 8, 'reversal');
    if (nose > b * 3 && nose > tail * 2.5 && b < r * 0.25)
      push('PIN_BAR', 'DOWN', 8, 'reversal');
  })();

  // ── 6. INVERTED_HAMMER (score 6) ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q), u = uW(q), l = lW(q);
    if (u > b * 2 && l < b * 0.5 && b < r * 0.3 && ctx.trendDir === 'DOWN')
      push('INVERTED_HAMMER', 'UP', 6, 'reversal');
  })();

  // ── 7. HANGING_MAN (score 6) ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q), u = uW(q), l = lW(q);
    if (l > b * 2.5 && l > u * 1.5 && b < r * 0.3 && ctx.trendDir === 'UP')
      push('HANGING_MAN', 'DOWN', 6, 'reversal');
  })();

  // ── 8. DRAGONFLY_DOJI (score 6) ──
  (() => {
    const q = cur(), r = rng(q), u = uW(q), l = lW(q);
    if (dojiLike(q) && l > r * 0.6 && u < r * 0.1 && ctx.trendDir === 'DOWN')
      push('DRAGONFLY_DOJI', 'UP', 6, 'reversal');
  })();

  // ── 9. GRAVESTONE_DOJI (score 6) ──
  (() => {
    const q = cur(), r = rng(q), u = uW(q), l = lW(q);
    if (dojiLike(q) && u > r * 0.6 && l < r * 0.1 && ctx.trendDir === 'UP')
      push('GRAVESTONE_DOJI', 'DOWN', 6, 'reversal');
  })();

  // ── 10. BULLISH_MARUBOZU (score 7) ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q);
    if (bull(q) && b > r * 0.95 && r > ctx.atr * 0.8)
      push('BULLISH_MARUBOZU', 'UP', 7, 'reversal');
  })();

  // ── 11. BEARISH_MARUBOZU (score 7) ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q);
    if (bear(q) && b > r * 0.95 && r > ctx.atr * 0.8)
      push('BEARISH_MARUBOZU', 'DOWN', 7, 'reversal');
  })();

  // ── 12. BULLISH_BELT_HOLD (score 7) ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q);
    if (bull(q) && lW(q) < r * 0.05 && uW(q) < r * 0.25 && bd(q) > r * 0.6 && ctx.trendDir === 'DOWN')
      push('BULLISH_BELT_HOLD', 'UP', 7, 'reversal');
  })();

  // ── 13. BEARISH_BELT_HOLD (score 7) ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q);
    if (bear(q) && uW(q) < r * 0.05 && lW(q) < r * 0.25 && bd(q) > r * 0.6 && ctx.trendDir === 'UP')
      push('BEARISH_BELT_HOLD', 'DOWN', 7, 'reversal');
  })();

  // ──────────────────────────────────────────────────────────
  // CATEGORY: REVERSAL — Two-Candle Patterns
  // ──────────────────────────────────────────────────────────

  // ── 14. PIERCING_LINE (score 7) ──
  (() => {
    const p = prev(), q = cur();
    if (!p || c.length < 5) return;
    if (bear(p) && bull(q) && q.o < p.cl && q.cl > (p.o + p.cl) / 2 && bd(q) > ctx.atr * 0.5)
      push('PIERCING_LINE', 'UP', 7, 'reversal');
  })();

  // ── 15. DARK_CLOUD_COVER (score 7) ──
  (() => {
    const p = prev(), q = cur();
    if (!p || c.length < 5) return;
    if (bull(p) && bear(q) && q.o > p.cl && q.cl < (p.o + p.cl) / 2 && bd(q) > ctx.atr * 0.5)
      push('DARK_CLOUD_COVER', 'DOWN', 7, 'reversal');
  })();

  // ── 16. BULLISH_HARAMI (score 6) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    if (bear(p) && bull(q) && q.o > p.cl && q.cl < p.o && bd(q) < bd(p) * 0.5)
      push('BULLISH_HARAMI', 'UP', 6, 'reversal');
  })();

  // ── 17. BEARISH_HARAMI (score 6) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    if (bull(p) && bear(q) && q.o < p.cl && q.cl > p.o && bd(q) < bd(p) * 0.5)
      push('BEARISH_HARAMI', 'DOWN', 6, 'reversal');
  })();

  // ── 18. HARAMI_CROSS_BULL (score 7) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    if (bear(p) && dojiLike(q) && q.o > p.cl && q.cl < p.o && bd(p) > ctx.atr * 0.6)
      push('HARAMI_CROSS_BULL', 'UP', 7, 'reversal');
  })();

  // ── 19. HARAMI_CROSS_BEAR (score 7) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    if (bull(p) && dojiLike(q) && q.o < p.cl && q.cl > p.o && bd(p) > ctx.atr * 0.6)
      push('HARAMI_CROSS_BEAR', 'DOWN', 7, 'reversal');
  })();

  // ── 20. BULLISH_KICKER (score 8) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    if (bear(p) && bull(q) && q.o > p.h && q.cl > q.o && bd(q) > bd(p) * 1.5)
      push('BULLISH_KICKER', 'UP', 8, 'reversal');
  })();

  // ── 21. BEARISH_KICKER (score 8) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    if (bull(p) && bear(q) && q.o < p.l && q.cl < q.o && bd(q) > bd(p) * 1.5)
      push('BEARISH_KICKER', 'DOWN', 8, 'reversal');
  })();

  // ── 22. TWEEZER_BOTTOM (score 7) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    const tolerance = ctx.atr * 0.2;
    if (Math.abs(q.l - p.l) < tolerance && bull(q) && ctx.trendDir === 'DOWN')
      push('TWEEZER_BOTTOM', 'UP', 7, 'reversal');
  })();

  // ── 23. BEARISH_TWEEZER_TOP (score 7) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    const tolerance = ctx.atr * 0.2;
    if (Math.abs(q.h - p.h) < tolerance && bear(q) && ctx.trendDir === 'UP')
      push('BEARISH_TWEEZER_TOP', 'DOWN', 7, 'reversal');
  })();

  // ── 24. MEETING_LINES_BULL (score 6) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    const tolerance = ctx.atr * 0.15;
    if (bear(p) && bull(q) && bd(p) > rng(p) * 0.6 && bd(q) > rng(q) * 0.6
      && Math.abs(q.cl - p.cl) < tolerance)
      push('MEETING_LINES_BULL', 'UP', 6, 'reversal');
  })();

  // ── 25. BEARISH_DOJI_STAR (score 6) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    if (bull(p) && bd(p) > rng(p) * 0.6 && dojiLike(q))
      push('BEARISH_DOJI_STAR', 'DOWN', 6, 'reversal');
  })();

  // ── 26. BULLISH_DOJI_STAR (score 6) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    if (bear(p) && bd(p) > rng(p) * 0.6 && dojiLike(q))
      push('BULLISH_DOJI_STAR', 'UP', 6, 'reversal');
  })();

  // ── 27. BULLISH_SEPARATING_LINES (score 6) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    const tolerance = ctx.atr * 0.1;
    if (bear(p) && bull(q) && Math.abs(q.o - p.o) < tolerance && bd(q) > ctx.atr * 0.5)
      push('BULLISH_SEPARATING_LINES', 'UP', 6, 'reversal');
  })();

  // ── 28. BEARISH_SEPARATING_LINES (score 6) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    const tolerance = ctx.atr * 0.1;
    if (bull(p) && bear(q) && Math.abs(q.o - p.o) < tolerance && bd(q) > ctx.atr * 0.5)
      push('BEARISH_SEPARATING_LINES', 'DOWN', 6, 'reversal');
  })();

  // ──────────────────────────────────────────────────────────
  // CATEGORY: REVERSAL — Three-Candle Patterns
  // ──────────────────────────────────────────────────────────

  // ── 29. MORNING_STAR (score 8) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bd(a) > ctx.atr * 0.6
      && bd(b) < bd(a) * 0.3
      && bull(q) && bd(q) > ctx.atr * 0.6
      && q.cl > (a.o + a.cl) / 2)
      push('MORNING_STAR', 'UP', 8, 'reversal');
  })();

  // ── 30. EVENING_STAR (score 8) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bd(a) > ctx.atr * 0.6
      && bd(b) < bd(a) * 0.3
      && bear(q) && bd(q) > ctx.atr * 0.6
      && q.cl < (a.o + a.cl) / 2)
      push('EVENING_STAR', 'DOWN', 8, 'reversal');
  })();

  // ── 31. MORNING_DOJI_STAR (score 8) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bd(a) > ctx.atr * 0.6
      && dojiLike(b)
      && bull(q) && bd(q) > ctx.atr * 0.6
      && q.cl > (a.o + a.cl) / 2)
      push('MORNING_DOJI_STAR', 'UP', 8, 'reversal');
  })();

  // ── 32. EVENING_DOJI_STAR (score 8) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bd(a) > ctx.atr * 0.6
      && dojiLike(b)
      && bear(q) && bd(q) > ctx.atr * 0.6
      && q.cl < (a.o + a.cl) / 2)
      push('EVENING_DOJI_STAR', 'DOWN', 8, 'reversal');
  })();

  // ── 33. THREE_WHITE_SOLDIERS (score 7) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bull(b) && bull(q)
      && bd(a) > ctx.atr * 0.5 && bd(b) > ctx.atr * 0.5 && bd(q) > ctx.atr * 0.5
      && b.o > a.cl * 0.998 && q.o > b.cl * 0.998
      && q.cl > b.cl && b.cl > a.cl)
      push('THREE_WHITE_SOLDIERS', 'UP', 7, 'reversal');
  })();

  // ── 34. THREE_BLACK_CROWS (score 7) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bear(b) && bear(q)
      && bd(a) > ctx.atr * 0.5 && bd(b) > ctx.atr * 0.5 && bd(q) > ctx.atr * 0.5
      && b.o < a.cl * 1.002 && q.o < b.cl * 1.002
      && q.cl < b.cl && b.cl < a.cl)
      push('THREE_BLACK_CROWS', 'DOWN', 7, 'reversal');
  })();

  // ── 35. THREE_INSIDE_UP (score 7) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bull(b) && bull(q)
      && b.o > a.cl && b.cl < a.o
      && q.cl > a.o && bd(q) > ctx.atr * 0.4)
      push('THREE_INSIDE_UP', 'UP', 7, 'reversal');
  })();

  // ── 36. THREE_INSIDE_DOWN (score 7) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bear(b) && bear(q)
      && b.o < a.cl && b.cl > a.o
      && q.cl < a.o && bd(q) > ctx.atr * 0.4)
      push('THREE_INSIDE_DOWN', 'DOWN', 7, 'reversal');
  })();

  // ── 37. THREE_OUTSIDE_UP (score 8) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bull(b) && bull(q)
      && b.o <= a.cl && b.cl >= a.o && bd(b) > ctx.atr * 0.5
      && q.cl > b.cl)
      push('THREE_OUTSIDE_UP', 'UP', 8, 'reversal');
  })();

  // ── 38. THREE_OUTSIDE_DOWN (score 8) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bear(b) && bear(q)
      && b.o >= a.cl && b.cl <= a.o && bd(b) > ctx.atr * 0.5
      && q.cl < b.cl)
      push('THREE_OUTSIDE_DOWN', 'DOWN', 8, 'reversal');
  })();

  // ── 39. BULLISH_ABANDONED_BABY (score 8) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && dojiLike(b) && bull(q) && b.h < a.l && q.l > b.h)
      push('BULLISH_ABANDONED_BABY', 'UP', 8, 'reversal');
  })();

  // ── 40. BEARISH_ABANDONED_BABY (score 8) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && dojiLike(b) && bear(q) && b.l > a.h && q.h < b.l)
      push('BEARISH_ABANDONED_BABY', 'DOWN', 8, 'reversal');
  })();

  // ── 41. UPSIDE_GAP_TWO_CROWS (score 6) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bear(b) && bear(q) && b.l > a.h && q.l > a.h && q.cl < b.cl)
      push('UPSIDE_GAP_TWO_CROWS', 'DOWN', 6, 'reversal');
  })();

  // ──────────────────────────────────────────────────────────
  // CATEGORY: CONTINUATION — Multi-Candle Patterns
  // ──────────────────────────────────────────────────────────

  // ── 42. RISING_THREE_METHODS (score 7) ──
  (() => {
    if (c.length < 5) return;
    const a = c[c.length - 5], b = c[c.length - 4], d = c[c.length - 3],
      e = c[c.length - 2], q = cur();
    if (bull(a) && bd(a) > ctx.atr * 0.8
      && bear(b) && bear(d) && bear(e)
      && bd(b) < bd(a) * 0.4 && bd(d) < bd(a) * 0.4 && bd(e) < bd(a) * 0.4
      && b.l > a.l && d.l > a.l && e.l > a.l
      && bull(q) && q.cl > a.h)
      push('RISING_THREE_METHODS', 'UP', 7, 'continuation');
  })();

  // ── 43. FALLING_THREE_METHODS (score 7) ──
  (() => {
    if (c.length < 5) return;
    const a = c[c.length - 5], b = c[c.length - 4], d = c[c.length - 3],
      e = c[c.length - 2], q = cur();
    if (bear(a) && bd(a) > ctx.atr * 0.8
      && bull(b) && bull(d) && bull(e)
      && bd(b) < bd(a) * 0.4 && bd(d) < bd(a) * 0.4 && bd(e) < bd(a) * 0.4
      && b.h < a.h && d.h < a.h && e.h < a.h
      && bear(q) && q.cl < a.l)
      push('FALLING_THREE_METHODS', 'DOWN', 7, 'continuation');
  })();

  // ── 44. BULLISH_MAT_HOLD (score 7) ──
  (() => {
    if (c.length < 5) return;
    const a = c[c.length - 5], b = c[c.length - 4], d = c[c.length - 3],
      e = c[c.length - 2], q = cur();
    if (bull(a) && bd(a) > ctx.atr * 0.6
      && bear(b) && bear(d) && bear(e)
      && bd(b) < bd(a) * 0.4 && bd(d) < bd(a) * 0.4 && bd(e) < bd(a) * 0.4
      && b.cl > a.l && d.cl > a.l && e.cl > a.l
      && bull(q) && q.cl > a.h)
      push('BULLISH_MAT_HOLD', 'UP', 7, 'continuation');
  })();

  // ── 45. BEARISH_MAT_HOLD (score 7) ──
  (() => {
    if (c.length < 5) return;
    const a = c[c.length - 5], b = c[c.length - 4], d = c[c.length - 3],
      e = c[c.length - 2], q = cur();
    if (bear(a) && bd(a) > ctx.atr * 0.6
      && bull(b) && bull(d) && bull(e)
      && bd(b) < bd(a) * 0.4 && bd(d) < bd(a) * 0.4 && bd(e) < bd(a) * 0.4
      && b.cl < a.h && d.cl < a.h && e.cl < a.h
      && bear(q) && q.cl < a.l)
      push('BEARISH_MAT_HOLD', 'DOWN', 7, 'continuation');
  })();

  // ── 46. THREE_LINE_STRIKE_BULL (score 7) ──
  (() => {
    if (c.length < 4) return;
    const a = c[c.length - 4], b = c[c.length - 3],
      d = c[c.length - 2], q = cur();
    if (bull(a) && bull(b) && bull(d)
      && bear(q) && bd(q) > ctx.atr * 0.8 && q.o > d.h && q.cl < a.o)
      push('THREE_LINE_STRIKE_BULL', 'UP', 7, 'continuation');
  })();

  // ── 47. BEARISH_THREE_LINE_STRIKE (score 7) ──
  (() => {
    if (c.length < 4) return;
    const a = c[c.length - 4], b = c[c.length - 3],
      d = c[c.length - 2], q = cur();
    if (bear(a) && bear(b) && bear(d)
      && bull(q) && bd(q) > ctx.atr * 0.8 && q.o < d.l && q.cl > a.o)
      push('BEARISH_THREE_LINE_STRIKE', 'DOWN', 7, 'continuation');
  })();

  // ── 48. LADDER_BOTTOM (score 7) ──
  (() => {
    if (c.length < 5) return;
    const a = c[c.length - 5], b = c[c.length - 4], d = c[c.length - 3],
      e = c[c.length - 2], q = cur();
    if (bear(a) && bear(b) && bear(d)
      && bd(a) > ctx.atr * 0.4 && bd(b) > ctx.atr * 0.4 && bd(d) > ctx.atr * 0.4
      && d.cl < b.cl && b.cl < a.cl
      && bd(e) < bd(d) * 0.5
      && bull(q) && bd(q) > ctx.atr * 0.5 && q.cl > d.o)
      push('LADDER_BOTTOM', 'UP', 7, 'continuation');
  })();

  // ── 49. CONCEALING_BABY_SWALLOW (score 7) ──
  (() => {
    if (c.length < 4) return;
    const a = c[c.length - 4], b = c[c.length - 3],
      d = c[c.length - 2], q = cur();
    if (bear(a) && bear(b) && bd(a) > ctx.atr * 0.5 && bd(b) > ctx.atr * 0.5
      && d.l < b.l
      && bear(q) && q.o >= d.h && q.cl <= d.l && bd(q) > ctx.atr * 0.5)
      push('CONCEALING_BABY_SWALLOW', 'UP', 7, 'continuation');
  })();

  // ── 50. THREE_BLIND_MICE (score 7) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bear(b) && bear(q)
      && bd(a) > bd(b) * 1.5 && bd(b) > bd(q) * 1.5
      && q.cl > b.cl && b.cl > a.cl
      && ctx.trendDir === 'DOWN')
      push('THREE_BLIND_MICE', 'UP', 7, 'continuation');
  })();

  // ──────────────────────────────────────────────────────────
  // CATEGORY: TECHNICAL — Indicator-Based
  // ──────────────────────────────────────────────────────────

  // ── 51. EMA_CROSS (score 7) ──
  (() => {
    const ef = (arr: { cl: number }[], p: number) => {
      const k = 2 / (p + 1);
      let e = arr[0].cl;
      arr.forEach(x => e = x.cl * k + e * (1 - k));
      return e;
    };
    if (c.length < 14) return;
    const eF = ef(c.slice(-5), 5);
    const eS = ef(c.slice(-13), 13);
    const eFp = ef(c.slice(-6, -1).slice(-5), 5);
    const eSp = ef(c.slice(-14, -1).slice(-13), 13);
    const gap = Math.abs(eF - eS);
    // Only fire if EMA gap is meaningful (not tiny crossover)
    if (gap > ctx.atr * 0.1) {
      if (eFp < eSp && eF > eS) push('EMA_CROSS', 'UP', 7, 'technical');
      if (eFp > eSp && eF < eS) push('EMA_CROSS', 'DOWN', 7, 'technical');
    }
  })();

  // ── 52. RSI_OVERSOLD / OVERBOUGHT (score 7) ──
  (() => {
    if (c.length < 15) return;
    const cls = c.slice(-15).map(x => x.cl);
    const gains: number[] = [], losses: number[] = [];
    for (let i = 1; i < cls.length; i++) {
      const d = cls[i] - cls[i - 1];
      gains.push(d > 0 ? d : 0);
      losses.push(d < 0 ? -d : 0);
    }
    const aG = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const aL = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const rsi = aL === 0 ? 100 : 100 - (100 / (1 + (aG / aL)));
    // Tighter thresholds for M1
    if (rsi < 25) push('RSI_OVERSOLD', 'UP', 7, 'technical');
    if (rsi > 75) push('RSI_OVERBOUGHT', 'DOWN', 7, 'technical');
  })();

  // ── 53. MACD_CROSS (score 7) ──
  (() => {
    if (c.length < 30) return;
    const ef = (arr: number[], p: number) => {
      const k = 2 / (p + 1);
      let e = arr[0];
      arr.slice(1).forEach(v => e = v * k + e * (1 - k));
      return e;
    };
    const cls = c.slice(-30).map(x => x.cl);
    const m = ef(cls.slice(-12), 12) - ef(cls.slice(-26), 26);
    const mp = ef(cls.slice(-13, -1).slice(-12), 12) - ef(cls.slice(-27, -1).slice(-26), 26);
    if (Math.abs(m) > ctx.atr * 0.05) {
      if (mp < 0 && m > 0) push('MACD_CROSS', 'UP', 7, 'technical');
      if (mp > 0 && m < 0) push('MACD_CROSS', 'DOWN', 7, 'technical');
    }
  })();

  // ── 54. BB_SQUEEZE (score 7) ──
  (() => {
    if (c.length < 28) return;
    const cls = c.slice(-22).map(x => x.cl);
    const sma = cls.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sd = Math.sqrt(cls.slice(-20).map(x => (x - sma) ** 2).reduce((a, b) => a + b, 0) / 20);
    const bw = (sd * 4) / sma;
    const cls2 = c.slice(-28, -6).map(x => x.cl);
    const sma2 = cls2.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sd2 = Math.sqrt(cls2.slice(-20).map(x => (x - sma2) ** 2).reduce((a, b) => a + b, 0) / 20);
    const bw2 = (sd2 * 4) / sma2;
    const q = cur();
    if (bw2 > bw * 1.4 && q.cl > sma) push('BB_SQUEEZE', 'UP', 7, 'technical');
    if (bw2 > bw * 1.4 && q.cl < sma) push('BB_SQUEEZE', 'DOWN', 7, 'technical');
  })();

  // ──────────────────────────────────────────────────────────
  // CATEGORY: STRUCTURAL — Support/Resistance/Breakout
  // ──────────────────────────────────────────────────────────

  // ── 55. BREAKOUT (score 7) ──
  (() => {
    if (c.length < 22) return;
    const r20 = c.slice(-22, -2);
    const hi = Math.max(...r20.map(x => x.h));
    const lo = Math.min(...r20.map(x => x.l));
    const q = cur();
    const breakDist = q.cl > hi ? (q.cl - hi) / ctx.atr : (lo - q.cl) / ctx.atr;
    // Must break by at least 0.3 ATR
    if (q.cl > hi && breakDist > 0.3) push('BREAKOUT', 'UP', 7, 'structural');
    if (q.cl < lo && breakDist > 0.3) push('BREAKOUT', 'DOWN', 7, 'structural');
  })();

  // ── 56. SUPPORT_BOUNCE (score 8) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    if (p.cl <= ctx.support * 1.001 && q.cl > ctx.support * 1.001 && bd(q) > ctx.atr * 0.4)
      push('SUPPORT_BOUNCE', 'UP', 8, 'structural');
  })();

  // ── 57. RESIST_REJECT (score 8) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    if (p.cl >= ctx.resistance * 0.999 && q.cl < ctx.resistance * 0.999 && bd(q) > ctx.atr * 0.4)
      push('RESIST_REJECT', 'DOWN', 8, 'structural');
  })();

  // ── 58. INSIDE_BAR (score 6) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    if (q.h < p.h && q.l > p.l && rng(p) > ctx.atr * 0.8) {
      if (ctx.trendDir === 'UP') push('INSIDE_BAR', 'UP', 6, 'structural');
      if (ctx.trendDir === 'DOWN') push('INSIDE_BAR', 'DOWN', 6, 'structural');
    }
  })();

  // ── 59. DOUBLE_BOTTOM_BOUNCE (score 7) ──
  (() => {
    if (c.length < 15) return;
    const r10 = c.slice(-15, -5);
    const r5 = c.slice(-5);
    const min10 = Math.min(...r10.map(x => x.l));
    const min5 = Math.min(...r5.map(x => x.l));
    if (Math.abs(min10 - min5) < ctx.atr * 0.3 && bull(cur()) && cur().cl > min5 + ctx.atr * 0.2)
      push('DOUBLE_BOTTOM_BOUNCE', 'UP', 7, 'structural');
  })();

  // ── 60. DOUBLE_TOP_REJECT (score 7) ──
  (() => {
    if (c.length < 15) return;
    const r10 = c.slice(-15, -5);
    const r5 = c.slice(-5);
    const max10 = Math.max(...r10.map(x => x.h));
    const max5 = Math.max(...r5.map(x => x.h));
    if (Math.abs(max10 - max5) < ctx.atr * 0.3 && bear(cur()) && cur().cl < max5 - ctx.atr * 0.2)
      push('DOUBLE_TOP_REJECT', 'DOWN', 7, 'structural');
  })();

  // ──────────────────────────────────────────────────────────
  // CATEGORY: MOMENTUM — Trend & Direction
  // ──────────────────────────────────────────────────────────

  // ── 61. MOMENTUM_UP (score 6) ──
  (() => {
    if (c.length < 10) return;
    const sl = c.slice(-5);
    const sl2 = c.slice(-10, -5);
    const uN = sl.filter(x => x.cl > x.o).length;
    const uP = sl2.filter(x => x.cl > x.o).length;
    if (uP <= 1 && uN >= 4) push('MOMENTUM_UP', 'UP', 6, 'momentum');
  })();

  // ── 62. MOMENTUM_DN (score 6) ──
  (() => {
    if (c.length < 10) return;
    const sl = c.slice(-5);
    const sl2 = c.slice(-10, -5);
    const dN = sl.filter(x => x.cl < x.o).length;
    const dP = sl2.filter(x => x.cl < x.o).length;
    if (dP <= 1 && dN >= 4) push('MOMENTUM_DN', 'DOWN', 6, 'momentum');
  })();

  // ── 63. STRONG_BULL_TREND (score 6) ──
  (() => {
    if (c.length < 6) return;
    const sl = c.slice(-5);
    const bullCount = sl.filter(x => bull(x)).length;
    if (bullCount >= 4 && sl[sl.length - 1].cl > sl[0].cl + ctx.atr * 0.5)
      push('STRONG_BULL_TREND', 'UP', 6, 'momentum');
  })();

  // ── 64. STRONG_BEAR_TREND (score 6) ──
  (() => {
    if (c.length < 6) return;
    const sl = c.slice(-5);
    const bearCount = sl.filter(x => bear(x)).length;
    if (bearCount >= 4 && sl[sl.length - 1].cl < sl[0].cl - ctx.atr * 0.5)
      push('STRONG_BEAR_TREND', 'DOWN', 6, 'momentum');
  })();

  // ── 65. HIGHER_HIGH_HIGHER_LOW (score 5) ──
  (() => {
    if (c.length < 4) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (b.h > a.h + ctx.atr * 0.1 && b.l > a.l + ctx.atr * 0.1
      && q.h > b.h && q.l > b.l)
      push('HIGHER_HIGH_HIGHER_LOW', 'UP', 5, 'momentum');
  })();

  // ── 66. LOWER_HIGH_LOWER_LOW (score 5) ──
  (() => {
    if (c.length < 4) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (b.h < a.h - ctx.atr * 0.1 && b.l < a.l - ctx.atr * 0.1
      && q.h < b.h && q.l < b.l)
      push('LOWER_HIGH_LOWER_LOW', 'DOWN', 5, 'momentum');
  })();

  // ── 67. DOWNSIDE_GAP_THREE_METHODS (score 6) ──
  (() => {
    if (c.length < 4) return;
    const a = c[c.length - 4], b = c[c.length - 3],
      d = c[c.length - 2], q = cur();
    if (bear(a) && b.l > a.h && d.l > a.h && bear(q) && q.cl < b.cl)
      push('DOWNSIDE_GAP_THREE_METHODS', 'DOWN', 6, 'momentum');
  })();

  // ── 68. TASUKI_GAP_UP (score 6) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bull(b) && b.l > a.h && bear(q) && q.cl > a.h)
      push('TASUKI_GAP_UP', 'UP', 6, 'momentum');
  })();

  // ── 69. TASUKI_GAP_DOWN (score 6) ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bear(b) && b.h < a.l && bull(q) && q.cl < a.l)
      push('TASUKI_GAP_DOWN', 'DOWN', 6, 'momentum');
  })();

  // ──────────────────────────────────────────────────────────
  // CATEGORY: WICK — Rejection & Wick Analysis
  // ──────────────────────────────────────────────────────────

  // ── 70. LONG_LOWER_WICK_REJECTION (score 7) ──
  (() => {
    const q = cur(), r = rng(q);
    if (lW(q) > r * 0.65 && uW(q) < r * 0.15 && ctx.trendDir === 'DOWN' && r > ctx.atr * 0.6)
      push('LONG_LOWER_WICK_REJECTION', 'UP', 7, 'wick');
  })();

  // ── 71. LONG_UPPER_WICK_REJECTION (score 7) ──
  (() => {
    const q = cur(), r = rng(q);
    if (uW(q) > r * 0.65 && lW(q) < r * 0.15 && ctx.trendDir === 'UP' && r > ctx.atr * 0.6)
      push('LONG_UPPER_WICK_REJECTION', 'DOWN', 7, 'wick');
  })();

  // ── 72. LONG_LEGGED_DOJI (score 5) ──
  (() => {
    const q = cur(), r = rng(q), u = uW(q), l = lW(q);
    if (dojiLike(q) && u > r * 0.35 && l > r * 0.35 && r > ctx.atr * 0.6) {
      if (ctx.trendDir === 'DOWN') push('LONG_LEGGED_DOJI', 'UP', 5, 'wick');
      if (ctx.trendDir === 'UP') push('LONG_LEGGED_DOJI', 'DOWN', 5, 'wick');
    }
  })();

  // ── 73. SPINNING_TOP (score 5) ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q), u = uW(q), l = lW(q);
    if (b < r * 0.2 && u > r * 0.2 && l > r * 0.2 && !dojiLike(q) && r > ctx.atr * 0.6) {
      if (ctx.trendDir === 'DOWN') push('SPINNING_TOP', 'UP', 5, 'wick');
      if (ctx.trendDir === 'UP') push('SPINNING_TOP', 'DOWN', 5, 'wick');
    }
  })();

  // ── 74. NO_SPIN_REJECTION_UP (score 6) ──
  (() => {
    const p = prev(), q = cur();
    if (!p) return;
    const b = bd(p), r = rng(p);
    if (b < r * 0.12 && p.cl > (p.h + p.l) / 2 && bull(q) && q.cl > p.h && r > ctx.atr * 0.6)
      push('NO_SPIN_REJECTION_UP', 'UP', 6, 'wick');
  })();

  // ════════════════════════════════════════════════════════════════════
  // LAYER 4: SMART CONSENSUS — Not just score sum
  // ════════════════════════════════════════════════════════════════════

  if (res.length === 0) return null;

  const upS = res.filter(r => r.dir === 'UP').reduce((a, r) => a + r.score, 0);
  const dnS = res.filter(r => r.dir === 'DOWN').reduce((a, r) => a + r.score, 0);
  const dir: 'UP' | 'DOWN' = upS >= dnS ? 'UP' : 'DOWN';
  const totalScore = Math.max(upS, dnS);
  const loserScore = Math.min(upS, dnS);
  const matchLogics = res.filter(r => r.dir === dir);

  // CONSENSUS RULE 1: Minimum 3 patterns must agree on direction
  if (matchLogics.length < 3) return null;

  // CONSENSUS RULE 2: Winner must dominate loser by at least 1.8x
  if (loserScore > 0 && totalScore / loserScore < 1.8) return null;

  // CONSENSUS RULE 3: Minimum raw score (pattern quality floor)
  if (totalScore < 18) return null; // was minScore, now hardcoded higher floor

  // CONSENSUS RULE 4: Must pass the user's minScore threshold
  const normalizedScore = Math.min(10, Math.round(totalScore / 2));
  if (normalizedScore < minScore) return null;

  // CONSENSUS RULE 5: Multi-category bonus check
  const categories = new Set(matchLogics.map(r => r.category));
  // Bonus: if patterns agree across 2+ categories, it's stronger
  const categoryBonus = categories.size >= 2 ? 1 : 0;
  // (We don't reject on this, but it affects confidence)

  // CONSENSUS RULE 6: Trend alignment
  if (ctx.trendDir !== 'NEUTRAL' && ctx.trendDir !== dir) {
    // Counter-trend signal: require even stronger consensus
    if (matchLogics.length < 5 || totalScore < 25) return null;
  }

  return {
    pair,
    dir,
    score: normalizedScore,
    logic: matchLogics[0].logic,
    logics: matchLogics.map(r => r.logic),
    price: c[c.length - 1].cl,
    time: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════
// TIMING
// ══════════════════════════════════════════════════════════════════════

export function getNextMinuteTiming(tzOffset: number) {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(now.getMinutes() + 1);

  const sendAt = new Date(next.getTime() - 30000);
  const local = new Date(next.getTime() + tzOffset * 3600000);
  const entryStr = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;

  return { entryTime: next.toISOString(), sendAt: sendAt.getTime(), entryStr };
}

// ══════════════════════════════════════════════════════════════════════
// RESULT CHECK
// ══════════════════════════════════════════════════════════════════════

export function checkCandleResult(
  candles: CandleData[],
  entryTimeISO: string,
  dir: 'UP' | 'DOWN'
): { win: boolean; doji: boolean } | null {
  if (!candles || candles.length < 3) return null;

  const et = new Date(entryTimeISO);
  const target = candles.find(c => {
    const t = new Date(c.time);
    return (
      t.getUTCFullYear() === et.getUTCFullYear() &&
      t.getUTCMonth() === et.getUTCMonth() &&
      t.getUTCDate() === et.getUTCDate() &&
      t.getUTCHours() === et.getUTCHours() &&
      t.getUTCMinutes() === et.getUTCMinutes() &&
      c.complete
    );
  });

  if (!target) return null;

  const o = parseFloat(target.mid.o);
  const cl = parseFloat(target.mid.c);
  const h = parseFloat(target.mid.h);
  const l = parseFloat(target.mid.l);
  const body = Math.abs(cl - o);
  const range = h - l || 0.0001;

  if (body / range < 0.1) return { win: true, doji: true };

  return {
    win: dir === 'UP' ? cl > o : cl < o,
    doji: false,
  };
}
