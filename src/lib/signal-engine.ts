// ══════════════════════════════════════════════════════════════════════
// HUNTER X QUANTEX v4.0+ — Enhanced Signal Engine
// 55+ Pattern Detectors + Score-Based Consensus
// Categories: Single-Candle, Two-Candle, Three-Candle,
//             Multi-Candle, Technical Indicators, Structural, Continuation
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

const bd = (c: OHLC) => Math.abs(c.cl - c.o);             // body size
const rng = (c: OHLC) => c.h - c.l || 0.0001;              // range (high-low)
const uW = (c: OHLC) => c.h - Math.max(c.cl, c.o);         // upper wick
const lW = (c: OHLC) => Math.min(c.cl, c.o) - c.l;         // lower wick
const bull = (c: OHLC) => c.cl > c.o;                       // is bullish
const bear = (c: OHLC) => c.cl < c.o;                       // is bearish
const dojiLike = (c: OHLC) => bd(c) / rng(c) < 0.1;        // doji-like body

const downTrend = (c: OHLC[], n: number = 5) =>
  c.length >= n + 1 && c[c.length - 1].cl < c[c.length - n - 1].cl;

const upTrend = (c: OHLC[], n: number = 5) =>
  c.length >= n + 1 && c[c.length - 1].cl > c[c.length - n - 1].cl;

function emaCalc(arr: number[], period: number): number {
  const k = 2 / (period + 1);
  let e = arr[0];
  for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
  return e;
}

// ══════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ══════════════════════════════════════════════════════════════════════

export function analyzeCandles(candles: CandleData[], pair: string, minScore: number): SignalResult | null {
  if (!candles || candles.length < 20) return null;
  const closed = candles.filter(c => c.complete);
  if (closed.length < 15) return null;

  const c = closed.map(x => ({
    o: parseFloat(x.mid.o),
    h: parseFloat(x.mid.h),
    l: parseFloat(x.mid.l),
    cl: parseFloat(x.mid.c),
    t: x.time,
  }));

  const res: PatternResult[] = [];
  const cur = () => c[c.length - 1];
  const prev = () => c[c.length - 2];
  const p2 = () => c[c.length - 3];
  const p3 = () => c[c.length - 4];
  const p4 = () => c[c.length - 5];
  const push = (logic: string, dir: 'UP' | 'DOWN', score: number) =>
    res.push({ logic, dir, score });

  // ════════════════════════════════════════════════════════════════════
  // SECTION 1: SINGLE-CANDLE REVERSAL PATTERNS
  // ════════════════════════════════════════════════════════════════════

  // ── 1. ENGULFING (score 8) — bearish→bullish or bullish→bearish ──
  (() => {
    const p = prev(), q = cur();
    const bP = bd(p), bC = bd(q);
    if (bear(p) && bull(q) && bC > bP * 1.2 && q.o <= p.cl && q.cl >= p.o)
      push('ENGULFING', 'UP', 8);
    if (bull(p) && bear(q) && bC > bP * 1.2 && q.o >= p.cl && q.cl <= p.o)
      push('ENGULFING', 'DOWN', 8);
  })();

  // ── 2. HAMMER (score 7) — small body top, long lower wick ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q), u = uW(q), l = lW(q);
    if (l > b * 2.5 && l > u * 2 && b < r * 0.3)
      push('HAMMER', 'UP', 7);
  })();

  // ── 3. SHOOTING_STAR (score 7) — small body bottom, long upper wick ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q), u = uW(q), l = lW(q);
    if (u > b * 2.5 && u > l * 2 && b < r * 0.3)
      push('SHOOTING_STAR', 'DOWN', 7);
  })();

  // ── 4. DOJI_REVERSAL (score 6) — indecision + trend context ──
  (() => {
    const q = cur();
    if (dojiLike(q)) {
      if (downTrend(c, 5)) push('DOJI_REVERSAL', 'UP', 6);
      if (upTrend(c, 5)) push('DOJI_REVERSAL', 'DOWN', 6);
    }
  })();

  // ── 5. PIN_BAR (score 8) — long tail, small body, small nose ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q);
    const nose = bull(q) ? q.h - q.cl : q.o - q.h;
    const tail = bull(q) ? q.o - q.l : q.cl - q.l;
    if (tail > b * 3 && tail > nose * 2 && b < r * 0.25)
      push('PIN_BAR', 'UP', 8);
    if (nose > b * 3 && nose > tail * 2 && b < r * 0.25)
      push('PIN_BAR', 'DOWN', 8);
  })();

  // ── 6. INVERTED_HAMMER (score 6) — small body bottom, long upper wick, downtrend ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q), u = uW(q), l = lW(q);
    if (u > b * 2 && l < b * 0.5 && b < r * 0.3 && downTrend(c, 5))
      push('INVERTED_HAMMER', 'UP', 6);
  })();

  // ── 7. HANGING_MAN (score 6) — hammer shape at top of uptrend ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q), u = uW(q), l = lW(q);
    if (l > b * 2 && l > u * 1.5 && b < r * 0.3 && upTrend(c, 5))
      push('HANGING_MAN', 'DOWN', 6);
  })();

  // ── 8. DRAGONFLY_DOJI (score 6) — doji with long lower wick ──
  (() => {
    const q = cur(), r = rng(q), u = uW(q), l = lW(q);
    if (dojiLike(q) && l > r * 0.6 && u < r * 0.1)
      push('DRAGONFLY_DOJI', 'UP', 6);
  })();

  // ── 9. GRAVESTONE_DOJI (score 6) — doji with long upper wick ──
  (() => {
    const q = cur(), r = rng(q), u = uW(q), l = lW(q);
    if (dojiLike(q) && u > r * 0.6 && l < r * 0.1)
      push('GRAVESTONE_DOJI', 'DOWN', 6);
  })();

  // ── 10. LONG_LEGGED_DOJI (score 5) — long wicks both sides, tiny body ──
  (() => {
    const q = cur(), r = rng(q), u = uW(q), l = lW(q);
    if (dojiLike(q) && u > r * 0.3 && l > r * 0.3) {
      if (downTrend(c, 5)) push('LONG_LEGGED_DOJI', 'UP', 5);
      if (upTrend(c, 5)) push('LONG_LEGGED_DOJI', 'DOWN', 5);
    }
  })();

  // ── 11. SPINNING_TOP (score 5) — small body, moderate wicks ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q), u = uW(q), l = lW(q);
    if (b < r * 0.25 && u > r * 0.15 && l > r * 0.15 && !dojiLike(q)) {
      if (downTrend(c, 5)) push('SPINNING_TOP', 'UP', 5);
      if (upTrend(c, 5)) push('SPINNING_TOP', 'DOWN', 5);
    }
  })();

  // ── 12. BULLISH_MARUBOZU (score 7) — long bullish body, no shadows ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q);
    if (bull(q) && b > r * 0.95 && r > 0)
      push('BULLISH_MARUBOZU', 'UP', 7);
  })();

  // ── 13. BEARISH_MARUBOZU (score 7) — long bearish body, no shadows ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q);
    if (bear(q) && b > r * 0.95 && r > 0)
      push('BEARISH_MARUBOZU', 'DOWN', 7);
  })();

  // ── 14. BULLISH_BELT_HOLD (score 7) — opens at/near low, closes near high ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q);
    if (bull(q) && lW(q) < r * 0.05 && uW(q) < r * 0.25 && bd(q) > r * 0.6 && downTrend(c, 5))
      push('BULLISH_BELT_HOLD', 'UP', 7);
  })();

  // ── 15. BEARISH_BELT_HOLD (score 7) — opens at/near high, closes near low ──
  (() => {
    const q = cur(), b = bd(q), r = rng(q);
    if (bear(q) && uW(q) < r * 0.05 && lW(q) < r * 0.25 && bd(q) > r * 0.6 && upTrend(c, 5))
      push('BEARISH_BELT_HOLD', 'DOWN', 7);
  })();

  // ════════════════════════════════════════════════════════════════════
  // SECTION 2: TWO-CANDLE REVERSAL PATTERNS
  // ════════════════════════════════════════════════════════════════════

  // ── 16. PIERCING_LINE (score 7) — bearish then bullish closes above midpoint ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q || c.length < 5) return;
    if (bear(p) && bull(q) && q.o < p.cl && q.cl > (p.o + p.cl) / 2)
      push('PIERCING_LINE', 'UP', 7);
  })();

  // ── 17. DARK_CLOUD_COVER (score 7) — bullish then bearish closes below midpoint ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q || c.length < 5) return;
    if (bull(p) && bear(q) && q.o > p.cl && q.cl < (p.o + p.cl) / 2)
      push('DARK_CLOUD_COVER', 'DOWN', 7);
  })();

  // ── 18. BULLISH_HARAMI (score 6) — large bearish then small bullish inside ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    if (bear(p) && bull(q) && q.o > p.cl && q.cl < p.o && bd(q) < bd(p) * 0.6)
      push('BULLISH_HARAMI', 'UP', 6);
  })();

  // ── 19. BEARISH_HARAMI (score 6) — large bullish then small bearish inside ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    if (bull(p) && bear(q) && q.o < p.cl && q.cl > p.o && bd(q) < bd(p) * 0.6)
      push('BEARISH_HARAMI', 'DOWN', 6);
  })();

  // ── 20. HARAMI_CROSS_BULL (score 7) — large bearish then doji inside ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    if (bear(p) && dojiLike(q) && q.o > p.cl && q.cl < p.o)
      push('HARAMI_CROSS_BULL', 'UP', 7);
  })();

  // ── 21. HARAMI_CROSS_BEAR (score 7) — large bullish then doji inside ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    if (bull(p) && dojiLike(q) && q.o < p.cl && q.cl > p.o)
      push('HARAMI_CROSS_BEAR', 'DOWN', 7);
  })();

  // ── 22. BULLISH_KICKER (score 8) — bearish then bullish gaps up strongly ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    if (bear(p) && bull(q) && q.o > p.h && q.cl > q.o && bd(q) > bd(p) * 1.5)
      push('BULLISH_KICKER', 'UP', 8);
  })();

  // ── 23. BEARISH_KICKER (score 8) — bullish then bearish gaps down strongly ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    if (bull(p) && bear(q) && q.o < p.l && q.cl < q.o && bd(q) > bd(p) * 1.5)
      push('BEARISH_KICKER', 'DOWN', 8);
  })();

  // ── 24. TWEEZER_BOTTOM (score 7) — two candles with matching lows ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    const tolerance = (p.h - p.l) * 0.15;
    if (Math.abs(q.l - p.l) < tolerance && bull(q) && downTrend(c, 5))
      push('TWEEZER_BOTTOM', 'UP', 7);
  })();

  // ── 25. BEARISH_TWEEZER_TOP (score 7) — two candles with matching highs ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    const tolerance = (p.h - p.l) * 0.15;
    if (Math.abs(q.h - p.h) < tolerance && bear(q) && upTrend(c, 5))
      push('BEARISH_TWEEZER_TOP', 'DOWN', 7);
  })();

  // ── 26. BULLISH_SEPARATING_LINES (score 6) — bearish then bullish opens at same level ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    const tolerance = (p.h - p.l) * 0.1;
    if (bear(p) && bull(q) && Math.abs(q.o - p.o) < tolerance && q.cl > q.o)
      push('BULLISH_SEPARATING_LINES', 'UP', 6);
  })();

  // ── 27. BEARISH_SEPARATING_LINES (score 6) — bullish then bearish opens at same level ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    const tolerance = (p.h - p.l) * 0.1;
    if (bull(p) && bear(q) && Math.abs(q.o - p.o) < tolerance && q.cl < q.o)
      push('BEARISH_SEPARATING_LINES', 'DOWN', 6);
  })();

  // ── 28. MEETING_LINES_BULL (score 6) — long bearish then long bullish closes at same ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    const tolerance = (p.h - p.l) * 0.08;
    if (bear(p) && bull(q) && bd(p) > rng(p) * 0.6 && bd(q) > rng(q) * 0.6
      && Math.abs(q.cl - p.cl) < tolerance)
      push('MEETING_LINES_BULL', 'UP', 6);
  })();

  // ── 29. BEARISH_DOJI_STAR (score 6) — long bullish then doji ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    if (bull(p) && bd(p) > rng(p) * 0.6 && dojiLike(q))
      push('BEARISH_DOJI_STAR', 'DOWN', 6);
  })();

  // ── 30. BULLISH_DOJI_STAR (score 6) — long bearish then doji ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    if (bear(p) && bd(p) > rng(p) * 0.6 && dojiLike(q))
      push('BULLISH_DOJI_STAR', 'UP', 6);
  })();

  // ════════════════════════════════════════════════════════════════════
  // SECTION 3: THREE-CANDLE REVERSAL PATTERNS
  // ════════════════════════════════════════════════════════════════════

  // ── 31. MORNING_STAR (score 8) — bearish, small candle, bullish ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bd(a) > rng(a) * 0.5
      && bd(b) < bd(a) * 0.3
      && bull(q) && bd(q) > rng(q) * 0.5
      && q.cl > (a.o + a.cl) / 2)
      push('MORNING_STAR', 'UP', 8);
  })();

  // ── 32. EVENING_STAR (score 8) — bullish, small candle, bearish ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bd(a) > rng(a) * 0.5
      && bd(b) < bd(a) * 0.3
      && bear(q) && bd(q) > rng(q) * 0.5
      && q.cl < (a.o + a.cl) / 2)
      push('EVENING_STAR', 'DOWN', 8);
  })();

  // ── 33. MORNING_DOJI_STAR (score 8) — bearish, doji, bullish ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bd(a) > rng(a) * 0.5
      && dojiLike(b)
      && bull(q) && bd(q) > rng(q) * 0.5
      && q.cl > (a.o + a.cl) / 2)
      push('MORNING_DOJI_STAR', 'UP', 8);
  })();

  // ── 34. EVENING_DOJI_STAR (score 8) — bullish, doji, bearish ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bd(a) > rng(a) * 0.5
      && dojiLike(b)
      && bear(q) && bd(q) > rng(q) * 0.5
      && q.cl < (a.o + a.cl) / 2)
      push('EVENING_DOJI_STAR', 'DOWN', 8);
  })();

  // ── 35. THREE_WHITE_SOLDIERS (score 7) — three strong bullish candles ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bull(b) && bull(q)
      && bd(a) > rng(a) * 0.6 && bd(b) > rng(b) * 0.6 && bd(q) > rng(q) * 0.6
      && b.o > a.cl * 0.998 && q.o > b.cl * 0.998
      && q.cl > b.cl && b.cl > a.cl)
      push('THREE_WHITE_SOLDIERS', 'UP', 7);
  })();

  // ── 36. THREE_BLACK_CROWS (score 7) — three strong bearish candles ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bear(b) && bear(q)
      && bd(a) > rng(a) * 0.6 && bd(b) > rng(b) * 0.6 && bd(q) > rng(q) * 0.6
      && b.o < a.cl * 1.002 && q.o < b.cl * 1.002
      && q.cl < b.cl && b.cl < a.cl)
      push('THREE_BLACK_CROWS', 'DOWN', 7);
  })();

  // ── 37. THREE_INSIDE_UP (score 7) — bearish, bullish inside, bullish above first open ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bull(b) && bull(q)
      && b.o > a.cl && b.cl < a.o
      && q.cl > a.o)
      push('THREE_INSIDE_UP', 'UP', 7);
  })();

  // ── 38. THREE_INSIDE_DOWN (score 7) — bullish, bearish inside, bearish below first open ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bear(b) && bear(q)
      && b.o < a.cl && b.cl > a.o
      && q.cl < a.o)
      push('THREE_INSIDE_DOWN', 'DOWN', 7);
  })();

  // ── 39. THREE_OUTSIDE_UP (score 8) — bearish, bullish engulfs, bullish higher ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bull(b) && bull(q)
      && b.o <= a.cl && b.cl >= a.o
      && q.cl > b.cl)
      push('THREE_OUTSIDE_UP', 'UP', 8);
  })();

  // ── 40. THREE_OUTSIDE_DOWN (score 8) — bullish, bearish engulfs, bearish lower ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bear(b) && bear(q)
      && b.o >= a.cl && b.cl <= a.o
      && q.cl < b.cl)
      push('THREE_OUTSIDE_DOWN', 'DOWN', 8);
  })();

  // ── 41. UPSIDE_GAP_TWO_CROWS (score 6) — green, two small reds gap up ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bear(b) && bear(q)
      && b.l > a.h && q.l > a.h
      && q.cl < b.cl)
      push('UPSIDE_GAP_TWO_CROWS', 'DOWN', 6);
  })();

  // ── 42. BULLISH_ABANDONED_BABY (score 8) — bearish, doji gaps down, bullish gaps up ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && dojiLike(b) && bull(q)
      && b.h < a.l && q.l > b.h)
      push('BULLISH_ABANDONED_BABY', 'UP', 8);
  })();

  // ── 43. BEARISH_ABANDONED_BABY (score 8) — bullish, doji gaps up, bearish gaps down ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && dojiLike(b) && bear(q)
      && b.l > a.h && q.h < b.l)
      push('BEARISH_ABANDONED_BABY', 'DOWN', 8);
  })();

  // ════════════════════════════════════════════════════════════════════
  // SECTION 4: MULTI-CANDLE PATTERNS (4-5 candles)
  // ════════════════════════════════════════════════════════════════════

  // ── 44. RISING_THREE_METHODS (score 7) — bullish, 3 small bearish, bullish ──
  (() => {
    if (c.length < 5) return;
    const a = c[c.length - 5], b = c[c.length - 4], d = c[c.length - 3],
      e = c[c.length - 2], q = cur();
    if (bull(a) && bd(a) > rng(a) * 0.5
      && bear(b) && bear(d) && bear(e)
      && bd(b) < bd(a) * 0.5 && bd(d) < bd(a) * 0.5 && bd(e) < bd(a) * 0.5
      && b.l > a.l && d.l > a.l && e.l > a.l
      && b.h < a.h && d.h < a.h && e.h < a.h
      && bull(q) && q.cl > a.h)
      push('RISING_THREE_METHODS', 'UP', 7);
  })();

  // ── 45. FALLING_THREE_METHODS (score 7) — bearish, 3 small bullish, bearish ──
  (() => {
    if (c.length < 5) return;
    const a = c[c.length - 5], b = c[c.length - 4], d = c[c.length - 3],
      e = c[c.length - 2], q = cur();
    if (bear(a) && bd(a) > rng(a) * 0.5
      && bull(b) && bull(d) && bull(e)
      && bd(b) < bd(a) * 0.5 && bd(d) < bd(a) * 0.5 && bd(e) < bd(a) * 0.5
      && b.h < a.h && d.h < a.h && e.h < a.h
      && b.l > a.l && d.l > a.l && e.l > a.l
      && bear(q) && q.cl < a.l)
      push('FALLING_THREE_METHODS', 'DOWN', 7);
  })();

  // ── 46. BULLISH_MAT_HOLD (score 7) — bullish, 3 small bearish moving lower, bullish ──
  (() => {
    if (c.length < 5) return;
    const a = c[c.length - 5], b = c[c.length - 4], d = c[c.length - 3],
      e = c[c.length - 2], q = cur();
    if (bull(a) && bd(a) > rng(a) * 0.5
      && bear(b) && bear(d) && bear(e)
      && bd(b) < bd(a) * 0.4 && bd(d) < bd(a) * 0.4 && bd(e) < bd(a) * 0.4
      && b.cl < b.o && d.cl < d.o && e.cl < e.o
      && b.cl > a.l && d.cl > a.l && e.cl > a.l
      && bull(q) && q.cl > a.h)
      push('BULLISH_MAT_HOLD', 'UP', 7);
  })();

  // ── 47. BEARISH_MAT_HOLD (score 7) — bearish, 3 small bullish, bearish lower ──
  (() => {
    if (c.length < 5) return;
    const a = c[c.length - 5], b = c[c.length - 4], d = c[c.length - 3],
      e = c[c.length - 2], q = cur();
    if (bear(a) && bd(a) > rng(a) * 0.5
      && bull(b) && bull(d) && bull(e)
      && bd(b) < bd(a) * 0.4 && bd(d) < bd(a) * 0.4 && bd(e) < bd(a) * 0.4
      && b.cl < a.h && d.cl < a.h && e.cl < a.h
      && bear(q) && q.cl < a.l)
      push('BEARISH_MAT_HOLD', 'DOWN', 7);
  })();

  // ── 48. THREE_LINE_STRIKE_BULL (score 7) — 3 bullish then long bearish (bullish cont.) ──
  (() => {
    if (c.length < 4) return;
    const a = c[c.length - 4], b = c[c.length - 3],
      d = c[c.length - 2], q = cur();
    if (bull(a) && bull(b) && bull(d)
      && bear(q) && bd(q) > rng(q) * 0.6
      && q.o > d.h && q.cl < a.o)
      push('THREE_LINE_STRIKE_BULL', 'UP', 7);
  })();

  // ── 49. BEARISH_THREE_LINE_STRIKE (score 7) — 3 bearish then long bullish (bearish cont.) ──
  (() => {
    if (c.length < 4) return;
    const a = c[c.length - 4], b = c[c.length - 3],
      d = c[c.length - 2], q = cur();
    if (bear(a) && bear(b) && bear(d)
      && bull(q) && bd(q) > rng(q) * 0.6
      && q.o < d.l && q.cl > a.o)
      push('BEARISH_THREE_LINE_STRIKE', 'DOWN', 7);
  })();

  // ── 50. LADDER_BOTTOM (score 7) — 3 bearish, small candle, bullish ──
  (() => {
    if (c.length < 5) return;
    const a = c[c.length - 5], b = c[c.length - 4], d = c[c.length - 3],
      e = c[c.length - 2], q = cur();
    if (bear(a) && bear(b) && bear(d)
      && bd(a) > rng(a) * 0.4 && bd(b) > rng(b) * 0.4 && bd(d) > rng(d) * 0.4
      && d.cl < b.cl && b.cl < a.cl
      && bd(e) < bd(d) * 0.5
      && bull(q) && bd(q) > rng(q) * 0.5 && q.cl > d.o)
      push('LADDER_BOTTOM', 'UP', 7);
  })();

  // ── 51. CONCEALING_BABY_SWALLOW (score 7) — 2 bearish, small gap-down, bearish engulfs ──
  (() => {
    if (c.length < 4) return;
    const a = c[c.length - 4], b = c[c.length - 3],
      d = c[c.length - 2], q = cur();
    if (bear(a) && bear(b)
      && bd(a) > rng(a) * 0.5 && bd(b) > rng(b) * 0.5
      && d.l < b.l
      && bear(q) && q.o >= d.h && q.cl <= d.l
      && bd(q) > rng(q) * 0.5)
      push('CONCEALING_BABY_SWALLOW', 'UP', 7);
  })();

  // ── 52. THREE_BLIND_MICE (score 7) — 3 progressively smaller bearish candles ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bear(b) && bear(q)
      && bd(a) > bd(b) * 1.3 && bd(b) > bd(q) * 1.3
      && q.cl > b.cl && b.cl > a.cl)
      push('THREE_BLIND_MICE', 'UP', 7);
  })();

  // ════════════════════════════════════════════════════════════════════
  // SECTION 5: TECHNICAL INDICATORS
  // ════════════════════════════════════════════════════════════════════

  // ── 53. EMA_CROSS (score 7) — EMA5/EMA13 crossover ──
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
    if (eFp < eSp && eF > eS) push('EMA_CROSS', 'UP', 7);
    if (eFp > eSp && eF < eS) push('EMA_CROSS', 'DOWN', 7);
  })();

  // ── 54. RSI_OVERSOLD / OVERBOUGHT (score 7) ──
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
    if (rsi < 28) push('RSI_OVERSOLD', 'UP', 7);
    if (rsi > 72) push('RSI_OVERBOUGHT', 'DOWN', 7);
  })();

  // ── 55. MACD_CROSS (score 7) ──
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
    if (mp < 0 && m > 0) push('MACD_CROSS', 'UP', 7);
    if (mp > 0 && m < 0) push('MACD_CROSS', 'DOWN', 7);
  })();

  // ── 56. BB_SQUEEZE (score 7) — Bollinger bandwidth narrowing ──
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

    if (bw2 > bw * 1.3 && q.cl > sma) push('BB_SQUEEZE', 'UP', 7);
    if (bw2 > bw * 1.3 && q.cl < sma) push('BB_SQUEEZE', 'DOWN', 7);
  })();

  // ════════════════════════════════════════════════════════════════════
  // SECTION 6: STRUCTURAL PATTERNS
  // ════════════════════════════════════════════════════════════════════

  // ── 57. BREAKOUT (score 7) — 20-bar high/low break ──
  (() => {
    if (c.length < 22) return;
    const r20 = c.slice(-22, -2);
    const hi = Math.max(...r20.map(x => x.h));
    const lo = Math.min(...r20.map(x => x.l));
    const q = cur();
    if (q.cl > hi * 1.0002) push('BREAKOUT', 'UP', 7);
    if (q.cl < lo * 0.9998) push('BREAKOUT', 'DOWN', 7);
  })();

  // ── 58. SUPPORT_BOUNCE (score 8) — close crosses above support ──
  (() => {
    if (c.length < 30) return;
    const r30 = c.slice(-30);
    const sup = [...r30.map(x => x.l)].sort((a, b) => a - b)[2];
    const p = prev(), q = cur();
    if (p && q && p.cl <= sup * 1.001 && q.cl > sup * 1.001)
      push('SUPPORT_BOUNCE', 'UP', 8);
  })();

  // ── 59. RESIST_REJECT (score 8) — close crosses below resistance ──
  (() => {
    if (c.length < 30) return;
    const r30 = c.slice(-30);
    const rs = [...r30.map(x => x.h)].sort((a, b) => b - a)[2];
    const p = prev(), q = cur();
    if (p && q && p.cl >= rs * 0.999 && q.cl < rs * 0.999)
      push('RESIST_REJECT', 'DOWN', 8);
  })();

  // ── 60. INSIDE_BAR (score 6) — cur inside prev, trend continuation ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    if (q.h < p.h && q.l > p.l) {
      const trend = p.cl - c[Math.max(0, c.length - 5)].cl;
      if (trend > 0) push('INSIDE_BAR', 'DOWN', 6);
      if (trend < 0) push('INSIDE_BAR', 'UP', 6);
    }
  })();

  // ════════════════════════════════════════════════════════════════════
  // SECTION 7: MOMENTUM & CONTINUATION
  // ════════════════════════════════════════════════════════════════════

  // ── 61. MOMENTUM_UP / DOWN (score 6) — 3/5 bullish reversal from prior ──
  (() => {
    if (c.length < 10) return;
    const sl = c.slice(-5);
    const sl2 = c.slice(-10, -5);
    const uN = sl.filter(x => x.cl > x.o).length;
    const uP = sl2.filter(x => x.cl > x.o).length;
    const dN = sl.filter(x => x.cl < x.o).length;
    if (uP <= 1 && uN >= 3) push('MOMENTUM_UP', 'UP', 6);
    if (uP >= 4 && dN >= 3) push('MOMENTUM_DN', 'DOWN', 6);
  })();

  // ── 62. DOWNSIDE_GAP_THREE_METHODS (score 6) — gap down, consolidation, continue down ──
  (() => {
    if (c.length < 4) return;
    const a = c[c.length - 4], b = c[c.length - 3],
      d = c[c.length - 2], q = cur();
    if (bear(a) && b.l > a.h && d.l > a.h
      && bear(q) && q.cl < b.cl)
      push('DOWNSIDE_GAP_THREE_METHODS', 'DOWN', 6);
  })();

  // ── 63. TASUKI_GAP_UP (score 6) — bullish gap then small bearish doesn't fill gap ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bull(a) && bull(b) && b.l > a.h
      && bear(q) && q.o < b.cl && q.cl > a.h)
      push('TASUKI_GAP_UP', 'UP', 6);
  })();

  // ── 64. TASUKI_GAP_DOWN (score 6) — bearish gap then small bullish doesn't fill gap ──
  (() => {
    if (c.length < 3) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (bear(a) && bear(b) && b.h < a.l
      && bull(q) && q.o > b.cl && q.cl < a.l)
      push('TASUKI_GAP_DOWN', 'DOWN', 6);
  })();

  // ════════════════════════════════════════════════════════════════════
  // SECTION 8: ADVANCED TREND-FOLLOWING
  // ════════════════════════════════════════════════════════════════════

  // ── 65. STRONG_BULL_TREND (score 6) — 4 of last 5 bullish, higher highs ──
  (() => {
    if (c.length < 6) return;
    const sl = c.slice(-5);
    const bullCount = sl.filter(x => bull(x)).length;
    if (bullCount >= 4 && sl[sl.length - 1].cl > sl[0].cl)
      push('STRONG_BULL_TREND', 'UP', 6);
  })();

  // ── 66. STRONG_BEAR_TREND (score 6) — 4 of last 5 bearish, lower lows ──
  (() => {
    if (c.length < 6) return;
    const sl = c.slice(-5);
    const bearCount = sl.filter(x => bear(x)).length;
    if (bearCount >= 4 && sl[sl.length - 1].cl < sl[0].cl)
      push('STRONG_BEAR_TREND', 'DOWN', 6);
  })();

  // ── 67. HIGHER_HIGH_HIGHER_LOW (score 5) — consecutive HH/HL ──
  (() => {
    if (c.length < 6) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (b.h > a.h && b.l > a.l && q.h > b.h && q.l > b.l)
      push('HIGHER_HIGH_HIGHER_LOW', 'UP', 5);
  })();

  // ── 68. LOWER_HIGH_LOWER_LOW (score 5) — consecutive LH/LL ──
  (() => {
    if (c.length < 6) return;
    const a = c[c.length - 3], b = c[c.length - 2], q = cur();
    if (b.h < a.h && b.l < a.l && q.h < b.h && q.l < b.l)
      push('LOWER_HIGH_LOWER_LOW', 'DOWN', 5);
  })();

  // ── 69. DOUBLE_BOTTOM_BOUNCE (score 7) — price hits same low twice ──
  (() => {
    if (c.length < 15) return;
    const r10 = c.slice(-15, -5);
    const r5 = c.slice(-5);
    const min10 = Math.min(...r10.map(x => x.l));
    const min5 = Math.min(...r5.map(x => x.l));
    const tolerance = min10 * 0.001;
    if (Math.abs(min10 - min5) < tolerance && bull(cur()) && cur().cl > min5)
      push('DOUBLE_BOTTOM_BOUNCE', 'UP', 7);
  })();

  // ── 70. DOUBLE_TOP_REJECT (score 7) — price hits same high twice ──
  (() => {
    if (c.length < 15) return;
    const r10 = c.slice(-15, -5);
    const r5 = c.slice(-5);
    const max10 = Math.max(...r10.map(x => x.h));
    const max5 = Math.max(...r5.map(x => x.h));
    const tolerance = max10 * 0.001;
    if (Math.abs(max10 - max5) < tolerance && bear(cur()) && cur().cl < max5)
      push('DOUBLE_TOP_REJECT', 'DOWN', 7);
  })();

  // ════════════════════════════════════════════════════════════════════
  // SECTION 9: VOLUME & WICK REJECTION (works on M1 candle shapes)
  // ════════════════════════════════════════════════════════════════════

  // ── 71. LONG_LOWER_WICK_REJECTION (score 6) — strong lower wick at support ──
  (() => {
    const q = cur(), r = rng(q);
    if (lW(q) > r * 0.6 && uW(q) < r * 0.2 && downTrend(c, 8))
      push('LONG_LOWER_WICK_REJECTION', 'UP', 6);
  })();

  // ── 72. LONG_UPPER_WICK_REJECTION (score 6) — strong upper wick at resistance ──
  (() => {
    const q = cur(), r = rng(q);
    if (uW(q) > r * 0.6 && lW(q) < r * 0.2 && upTrend(c, 8))
      push('LONG_UPPER_WICK_REJECTION', 'DOWN', 6);
  })();

  // ── 73. NO_SPIN_REJECTION_UP (score 5) — tiny body at bottom of range, bullish next ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    const b = bd(p), r = rng(p);
    if (b < r * 0.15 && p.cl > (p.h + p.l) / 2 && bull(q) && q.cl > p.h)
      push('NO_SPIN_REJECTION_UP', 'UP', 5);
  })();

  // ── 74. NO_SPIN_REJECTION_DN (score 5) — tiny body at top of range, bearish next ──
  (() => {
    const p = prev(), q = cur();
    if (!p || !q) return;
    const b = bd(p), r = rng(p);
    if (b < r * 0.15 && p.cl < (p.h + p.l) / 2 && bear(q) && q.cl < p.l)
      push('NO_SPIN_REJECTION_DN', 'DOWN', 5);
  })();

  // ════════════════════════════════════════════════════════════════════
  // CONSENSUS — Simple score-based (from original HXQ)
  // ════════════════════════════════════════════════════════════════════

  if (res.length === 0) return null;

  const upS = res.filter(r => r.dir === 'UP').reduce((a, r) => a + r.score, 0);
  const dnS = res.filter(r => r.dir === 'DOWN').reduce((a, r) => a + r.score, 0);
  const dir: 'UP' | 'DOWN' = upS >= dnS ? 'UP' : 'DOWN';
  const totalScore = Math.max(upS, dnS);

  if (totalScore < minScore) return null;

  const matchLogics = res.filter(r => r.dir === dir);

  return {
    pair,
    dir,
    score: Math.min(10, Math.round(totalScore / 2)),
    logic: matchLogics[0].logic,
    logics: matchLogics.map(r => r.logic),
    price: c[c.length - 1].cl,
    time: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════
// TIMING — from original HXQ
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
// RESULT CHECK — from original HXQ
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
