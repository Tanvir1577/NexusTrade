interface CandleData {
  mid: { o: string; h: string; l: string; c: string };
  time: string;
  complete: boolean;
}

interface OHLC {
  o: number;
  h: number;
  l: number;
  cl: number;
  t: string;
  complete: boolean;
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

function parseCandles(candles: CandleData[]): OHLC[] {
  return candles.map(c => ({
    o: parseFloat(c.mid.o),
    h: parseFloat(c.mid.h),
    l: parseFloat(c.mid.l),
    cl: parseFloat(c.mid.c),
    t: c.time,
    complete: c.complete,
  }));
}

function ema(arr: number[], period: number): number {
  const k = 2 / (period + 1);
  // Proper EMA: seed with SMA of first `period` values
  let e = arr.length >= period
    ? arr.slice(0, period).reduce((a, b) => a + b, 0) / period
    : arr[0];
  for (let i = period; i < arr.length; i++) {
    e = arr[i] * k + e * (1 - k);
  }
  return e;
}

// ─── Helper functions for pattern detection ──────────────────────────────────

function candleBody(c: OHLC): number {
  return Math.abs(c.cl - c.o);
}

function candleRange(c: OHLC): number {
  return c.h - c.l;
}

function upperShadow(c: OHLC): number {
  return c.h - Math.max(c.cl, c.o);
}

function lowerShadow(c: OHLC): number {
  return Math.min(c.cl, c.o) - c.l;
}

function isBullish(c: OHLC): boolean {
  return c.cl > c.o;
}

function isBearish(c: OHLC): boolean {
  return c.cl < c.o;
}

function isDoji(c: OHLC): boolean {
  const r = candleRange(c);
  return r > 0 && candleBody(c) / r < 0.1;
}

function pipTolerance(price: number): number {
  return price > 50 ? 0.01 : 0.0001;
}

function isUptrend(d: OHLC[], lookback: number): boolean {
  if (d.length < lookback) return false;
  return d[d.length - 1].cl > d[d.length - lookback].cl;
}

function isDowntrend(d: OHLC[], lookback: number): boolean {
  if (d.length < lookback) return false;
  return d[d.length - 1].cl < d[d.length - lookback].cl;
}

function isLongCandle(c: OHLC): boolean {
  const b = candleBody(c);
  const r = candleRange(c);
  return r > 0 && b > r * 0.6;
}

function isSmallCandle(c: OHLC): boolean {
  const r = candleRange(c);
  return r > 0 && candleBody(c) < r * 0.3;
}

// ─── MASSIVE Pattern Detection Engine ─────────────────────────────────────────

function detectPatterns(c: OHLC[]): PatternResult[] {
  const results: PatternResult[] = [];
  const len = c.length;

  if (len < 20) return results;

  const closed = c.filter(x => x.complete);
  if (closed.length < 15) return results;

  const d = closed;
  const dLen = d.length;
  const cur = d[dLen - 1];
  const prev = d[dLen - 2];
  const pip = pipTolerance(cur.cl);

  // ── ORIGINAL PATTERNS (kept exactly as-is) ──────────────────────────────

  // 1. ENGULFING
  const bP = Math.abs(prev.cl - prev.o);
  const bC = Math.abs(cur.cl - cur.o);
  if (prev.cl < prev.o && cur.cl > cur.o && bC > bP * 1.2 && cur.o <= prev.cl && cur.cl >= prev.o) {
    results.push({ logic: 'ENGULFING', dir: 'UP', score: 8 });
  }
  if (prev.cl > prev.o && cur.cl < cur.o && bC > bP * 1.2 && cur.o >= prev.cl && cur.cl <= prev.o) {
    results.push({ logic: 'ENGULFING', dir: 'DOWN', score: 8 });
  }

  // 2. HAMMER / SHOOTING STAR
  const body = Math.abs(cur.cl - cur.o);
  const range = cur.h - cur.l;
  const upper = cur.h - Math.max(cur.cl, cur.o);
  const lower = Math.min(cur.cl, cur.o) - cur.l;
  // HAMMER: requires downtrend context (prevents overlap with HANGING_MAN)
  if (range > 0 && lower > body * 2 && lower > upper * 2 && body < range * 0.3 && isDowntrend(d, 6)) {
    results.push({ logic: 'HAMMER', dir: 'UP', score: 7 });
  }
  // SHOOTING_STAR: requires uptrend context (prevents overlap with INVERTED_HAMMER)
  if (range > 0 && upper > body * 2 && upper > lower * 2 && body < range * 0.3 && isUptrend(d, 6)) {
    results.push({ logic: 'SHOOTING_STAR', dir: 'DOWN', score: 7 });
  }

  // 3. DOJI REVERSAL
  if (range > 0 && body / range < 0.1) {
    const trend = cur.cl - d[dLen - 6].cl;
    if (trend < 0) results.push({ logic: 'DOJI_REVERSAL', dir: 'UP', score: 6 });
    if (trend > 0) results.push({ logic: 'DOJI_REVERSAL', dir: 'DOWN', score: 6 });
  }

  // 4. EMA CROSS
  if (dLen >= 14) {
    const eF = ema(d.slice(-5).map(x => x.cl), 5);
    const eS = ema(d.slice(-13).map(x => x.cl), 13);
    const eFp = ema(d.slice(-6, -1).map(x => x.cl), 5);
    const eSp = ema(d.slice(-14, -1).map(x => x.cl), 13);
    if (eFp < eSp && eF > eS) results.push({ logic: 'EMA_CROSS', dir: 'UP', score: 7 });
    if (eFp > eSp && eF < eS) results.push({ logic: 'EMA_CROSS', dir: 'DOWN', score: 7 });
  }

  // 5. BREAKOUT
  if (dLen >= 22) {
    const r20 = d.slice(-22, -2);
    const hi = Math.max(...r20.map(x => x.h));
    const lo = Math.min(...r20.map(x => x.l));
    if (cur.cl > hi * 1.0002) results.push({ logic: 'BREAKOUT', dir: 'UP', score: 7 });
    if (cur.cl < lo * 0.9998) results.push({ logic: 'BREAKOUT', dir: 'DOWN', score: 7 });
  }

  // 6. SUPPORT BOUNCE / RESISTANCE REJECT
  if (dLen >= 30) {
    const r30 = d.slice(-30);
    const sortedHi = [...r30.map(x => x.h)].sort((a, b) => b - a);
    const sortedLo = [...r30.map(x => x.l)].sort((a, b) => a - b);
    const rs = sortedHi[2];
    const sup = sortedLo[2];
    if (prev.cl <= sup * 1.001 && cur.cl > sup * 1.001) {
      results.push({ logic: 'SUPPORT_BOUNCE', dir: 'UP', score: 8 });
    }
    if (prev.cl >= rs * 0.999 && cur.cl < rs * 0.999) {
      results.push({ logic: 'RESIST_REJECT', dir: 'DOWN', score: 8 });
    }
  }

  // 7. RSI OVERSOLD / OVERBOUGHT
  if (dLen >= 16) {
    const cls = d.slice(-15).map(x => x.cl);
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = 1; i < cls.length; i++) {
      const diff = cls[i] - cls[i - 1];
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? -diff : 0);
    }
    const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    if (rsi < 28) results.push({ logic: 'RSI_OVERSOLD', dir: 'UP', score: 7 });
    if (rsi > 72) results.push({ logic: 'RSI_OVERBOUGHT', dir: 'DOWN', score: 7 });
  }

  // 8. MACD CROSS
  if (dLen >= 27) {
    const cls30 = d.slice(-30).map(x => x.cl);
    const m12 = ema(cls30.slice(-12), 12);
    const m26 = ema(cls30.slice(-26), 26);
    const m12p = ema(cls30.slice(-13, -1), 12);
    const m26p = ema(cls30.slice(-27, -1), 26);
    const macd = m12 - m26;
    const macdP = m12p - m26p;
    if (macdP < 0 && macd > 0) results.push({ logic: 'MACD_CROSS', dir: 'UP', score: 7 });
    if (macdP > 0 && macd < 0) results.push({ logic: 'MACD_CROSS', dir: 'DOWN', score: 7 });
  }

  // 9. BOLLINGER SQUEEZE BREAKOUT
  if (dLen >= 28) {
    const cls22 = d.slice(-22).map(x => x.cl);
    const sma = cls22.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sd = Math.sqrt(cls22.slice(-20).map(x => (x - sma) ** 2).reduce((a, b) => a + b, 0) / 20);
    const upper = sma + sd * 2;
    const lower = sma - sd * 2;
    const bw = (sd * 4) / sma;

    const cls28 = d.slice(-28, -6).map(x => x.cl);
    const sma2 = cls28.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sd2 = Math.sqrt(cls28.slice(-20).map(x => (x - sma2) ** 2).reduce((a, b) => a + b, 0) / 20);
    const bw2 = (sd2 * 4) / sma2;

    // Squeeze detected (bands were wider before) + actual breakout beyond bands
    if (bw2 > bw * 1.3) {
      if (cur.cl > upper) results.push({ logic: 'BB_SQUEEZE', dir: 'UP', score: 6 });
      if (cur.cl < lower) results.push({ logic: 'BB_SQUEEZE', dir: 'DOWN', score: 6 });
    }
  }

  // 10. INSIDE BAR
  if (cur.h < prev.h && cur.l > prev.l) {
    const trend = prev.cl - d[dLen - 5].cl;
    if (trend < 0) results.push({ logic: 'INSIDE_BAR', dir: 'UP', score: 6 });
    if (trend > 0) results.push({ logic: 'INSIDE_BAR', dir: 'DOWN', score: 6 });
  }

  // 11. MOMENTUM
  const sl5 = d.slice(-5);
  const sl10 = dLen >= 10 ? d.slice(-10, -5) : [];
  const upN = sl5.filter(x => x.cl > x.o).length;
  const upP = sl10.filter(x => x.cl > x.o).length;
  const dnN = sl5.filter(x => x.cl < x.o).length;
  if (sl10.length > 0 && upP <= 1 && upN >= 3) results.push({ logic: 'MOMENTUM_UP', dir: 'UP', score: 6 });
  if (sl10.length > 0 && upP >= 4 && dnN >= 3) results.push({ logic: 'MOMENTUM_DN', dir: 'DOWN', score: 6 });

  // 12. PIN BAR
  if (range > 0) {
    const nose = cur.cl > cur.o ? cur.h - cur.cl : cur.h - cur.o;
    const tail = cur.cl > cur.o ? cur.o - cur.l : cur.cl - cur.l;
    if (tail > body * 3 && tail > nose * 2 && body < range * 0.25) {
      results.push({ logic: 'PIN_BAR', dir: 'UP', score: 8 });
    }
    if (nose > body * 3 && nose > tail * 2 && body < range * 0.25) {
      results.push({ logic: 'PIN_BAR', dir: 'DOWN', score: 8 });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // NEW PATTERNS — Single Candle Reversals
  // ══════════════════════════════════════════════════════════════════════

  // ── INVERTED_HAMMER (bullish, score 6) ──
  // Small body near bottom, long upper shadow, little/no lower shadow
  if (range > 0) {
    const invBody = candleBody(cur);
    const invUpper = upperShadow(cur);
    const invLower = lowerShadow(cur);
    if (
      invBody < range * 0.3 &&
      invUpper > invBody * 2 &&
      invLower < invBody * 0.5 &&
      invUpper > range * 0.5
    ) {
      results.push({ logic: 'INVERTED_HAMMER', dir: 'UP', score: 6 });
    }
  }

  // ── HANGING_MAN (bearish, score 6) ──
  // Small body at top, long lower shadow (≥2x body), appears after uptrend
  if (range > 0 && isDowntrend(d, 6) === false) {
    const hmBody = candleBody(cur);
    const hmLower = lowerShadow(cur);
    const hmUpper = upperShadow(cur);
    if (
      hmBody < range * 0.3 &&
      hmLower > hmBody * 2 &&
      hmUpper < hmBody * 0.5 &&
      hmLower > range * 0.5
    ) {
      results.push({ logic: 'HANGING_MAN', dir: 'DOWN', score: 6 });
    }
  }

  // ── DRAGONFLY_DOJI (bullish, score 6) ──
  // Doji-like with long lower shadow, no upper shadow
  if (range > 0 && body / range < 0.1) {
    const ddUpper = upperShadow(cur);
    const ddLower = lowerShadow(cur);
    if (ddLower > range * 0.6 && ddUpper < range * 0.05) {
      results.push({ logic: 'DRAGONFLY_DOJI', dir: 'UP', score: 6 });
    }
  }

  // ── GRAVESTONE_DOJI (bearish, score 6) ──
  // Doji-like with long upper shadow, no lower shadow
  if (range > 0 && body / range < 0.1) {
    const gsUpper = upperShadow(cur);
    const gsLower = lowerShadow(cur);
    if (gsUpper > range * 0.6 && gsLower < range * 0.05) {
      results.push({ logic: 'GRAVESTONE_DOJI', dir: 'DOWN', score: 6 });
    }
  }

  // ── BULLISH_MARUBOZU (momentum, score 7) ──
  // Long bullish body, very small/no wicks (wick < 5% of range)
  if (range > 0 && isBullish(cur)) {
    const totalWick = upperShadow(cur) + lowerShadow(cur);
    if (body / range > 0.9 && totalWick / range < 0.05) {
      results.push({ logic: 'BULLISH_MARUBOZU', dir: 'UP', score: 7 });
    }
  }

  // ── BEARISH_MARUBOZU (momentum, score 7) ──
  // Long bearish body, very small/no wicks
  if (range > 0 && isBearish(cur)) {
    const totalWick = upperShadow(cur) + lowerShadow(cur);
    if (body / range > 0.9 && totalWick / range < 0.05) {
      results.push({ logic: 'BEARISH_MARUBOZU', dir: 'DOWN', score: 7 });
    }
  }

  // ── SPINNING_TOP (indecision → trend continuation, score 4) ──
  // Small body (<30% of range), roughly equal upper/lower shadows
  if (range > 0) {
    const stBody = candleBody(cur);
    const stUpper = upperShadow(cur);
    const stLower = lowerShadow(cur);
    if (
      stBody / range < 0.3 &&
      stUpper > range * 0.2 &&
      stLower > range * 0.2 &&
      Math.abs(stUpper - stLower) / Math.max(stUpper, stLower) < 0.3
    ) {
      // In downtrend context → expect continuation up (reversal from indecision)
      // In uptrend context → expect continuation down
      if (isDowntrend(d, 8)) {
        results.push({ logic: 'SPINNING_TOP', dir: 'UP', score: 4 });
      }
      if (isUptrend(d, 8)) {
        results.push({ logic: 'SPINNING_TOP', dir: 'DOWN', score: 4 });
      }
    }
  }

  // ── BULLISH_BELT_HOLD (bullish, score 6) ──
  // Opens at/near low, closes at/near high, little/no lower shadow
  if (range > 0 && isBullish(cur)) {
    const bbUpper = upperShadow(cur);
    const bbLower = lowerShadow(cur);
    if (
      bbLower < range * 0.05 &&
      bbUpper > range * 0.1 &&
      body / range > 0.7
    ) {
      results.push({ logic: 'BULLISH_BELT_HOLD', dir: 'UP', score: 6 });
    }
  }

  // ── BEARISH_BELT_HOLD (bearish, score 6) ──
  // Opens at/near high, closes at/near low, little/no upper shadow
  if (range > 0 && isBearish(cur)) {
    const brUpper = upperShadow(cur);
    const brLower = lowerShadow(cur);
    if (
      brUpper < range * 0.05 &&
      brLower > range * 0.1 &&
      body / range > 0.7
    ) {
      results.push({ logic: 'BEARISH_BELT_HOLD', dir: 'DOWN', score: 6 });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // NEW PATTERNS — Two-Candle Reversals
  // ══════════════════════════════════════════════════════════════════════

  if (dLen >= 2) {
    const p = prev; // alias for clarity
    const q = cur;

    // ── PIERCING_LINE (bullish, score 7) ──
    // Bearish prev followed by bullish cur that opens below prev close,
    // closes above 50% of prev body
    if (isBearish(p) && isBullish(q)) {
      const pBody = p.o - p.cl; // bearish body size
      if (q.o < p.cl && q.cl > p.cl + pBody * 0.5 && q.cl < p.o) {
        results.push({ logic: 'PIERCING_LINE', dir: 'UP', score: 7 });
      }
    }

    // ── DARK_CLOUD_COVER (bearish, score 7) ──
    // Bullish prev followed by bearish cur that opens above prev close,
    // closes below midpoint of prev body
    if (isBullish(p) && isBearish(q)) {
      const pBody = p.cl - p.o; // bullish body size
      const pMid = p.o + pBody * 0.5;
      if (q.o > p.cl && q.cl < pMid && q.cl > p.o) {
        results.push({ logic: 'DARK_CLOUD_COVER', dir: 'DOWN', score: 7 });
      }
    }

    // ── BULLISH_HARAMI (bullish, score 6) ──
    // Small bullish candle fully inside previous large bearish body
    if (isBearish(p) && isBullish(q)) {
      const pBodySize = candleBody(p);
      const qBodySize = candleBody(q);
      if (
        pBodySize > 0 &&
        qBodySize < pBodySize * 0.6 &&
        q.o > p.cl &&
        q.cl < p.o
      ) {
        results.push({ logic: 'BULLISH_HARAMI', dir: 'UP', score: 6 });
      }
    }

    // ── BEARISH_HARAMI (bearish, score 6) ──
    // Small bearish candle fully inside previous large bullish body
    if (isBullish(p) && isBearish(q)) {
      const pBodySize = candleBody(p);
      const qBodySize = candleBody(q);
      if (
        pBodySize > 0 &&
        qBodySize < pBodySize * 0.6 &&
        q.o < p.cl &&
        q.cl > p.o
      ) {
        results.push({ logic: 'BEARISH_HARAMI', dir: 'DOWN', score: 6 });
      }
    }

    // ── HARAMI_CROSS_BULL (bullish, score 6) ──
    // Doji candle fully inside previous bearish body
    if (isBearish(p) && isDoji(q)) {
      if (Math.max(q.o, q.cl) < p.o && Math.min(q.o, q.cl) > p.cl) {
        results.push({ logic: 'HARAMI_CROSS_BULL', dir: 'UP', score: 6 });
      }
    }

    // ── HARAMI_CROSS_BEAR (bearish, score 6) ──
    // Doji candle fully inside previous bullish body
    if (isBullish(p) && isDoji(q)) {
      if (Math.max(q.o, q.cl) < p.cl && Math.min(q.o, q.cl) > p.o) {
        results.push({ logic: 'HARAMI_CROSS_BEAR', dir: 'DOWN', score: 6 });
      }
    }

    // ── TWEEZER_BOTTOM (bullish, score 6) ──
    // Bearish then bullish with equal lows
    if (isBearish(p) && isBullish(q) && Math.abs(p.l - q.l) < pip) {
      results.push({ logic: 'TWEEZER_BOTTOM', dir: 'UP', score: 6 });
    }

    // ── TWEEZER_TOP (bearish, score 6) ──
    // Bullish then bearish with equal highs
    if (isBullish(p) && isBearish(q) && Math.abs(p.h - q.h) < pip) {
      results.push({ logic: 'TWEEZER_TOP', dir: 'DOWN', score: 6 });
    }

    // ── BULLISH_KICKER (bullish, score 8) ──
    // Bearish prev immediately followed by bullish cur that opens above prev open, gaps up
    if (isBearish(p) && isBullish(q) && q.o > p.o && (q.o - p.o) >= pip) {
      results.push({ logic: 'BULLISH_KICKER', dir: 'UP', score: 8 });
    }

    // ── BEARISH_KICKER (bearish, score 8) ──
    // Bullish prev immediately followed by bearish cur that opens below prev open, gaps down
    if (isBullish(p) && isBearish(q) && q.o < p.o && (p.o - q.o) >= pip) {
      results.push({ logic: 'BEARISH_KICKER', dir: 'DOWN', score: 8 });
    }

    // ── MEETING_LINES_BULL (bullish, score 6) ──
    // Bearish prev followed by bullish cur that closes at same level as prev's close
    if (isBearish(p) && isBullish(q) && Math.abs(q.cl - p.cl) < pip) {
      results.push({ logic: 'MEETING_LINES_BULL', dir: 'UP', score: 6 });
    }

    // ── MEETING_LINES_BEAR (bearish, score 6) ──
    // Bullish prev followed by bearish cur that closes at same level as prev's close
    if (isBullish(p) && isBearish(q) && Math.abs(q.cl - p.cl) < pip) {
      results.push({ logic: 'MEETING_LINES_BEAR', dir: 'DOWN', score: 6 });
    }

    // ── BULLISH_SEPARATING_LINES (bullish, score 5) ──
    // Bearish prev followed by bullish cur opening at same level as prev's open
    if (isBearish(p) && isBullish(q) && Math.abs(q.o - p.o) < pip) {
      results.push({ logic: 'BULLISH_SEPARATING_LINES', dir: 'UP', score: 5 });
    }

    // ── BEARISH_SEPARATING_LINES (bearish, score 5) ──
    // Bullish prev followed by bearish cur opening at same level as prev's open
    if (isBullish(p) && isBearish(q) && Math.abs(q.o - p.o) < pip) {
      results.push({ logic: 'BEARISH_SEPARATING_LINES', dir: 'DOWN', score: 5 });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // NEW PATTERNS — Three-Candle Reversals
  // ══════════════════════════════════════════════════════════════════════

  if (dLen >= 3) {
    const c1 = d[dLen - 3]; // oldest of the three
    const c2 = d[dLen - 2]; // middle
    const c3 = d[dLen - 1]; // newest (same as cur)

    // ── MORNING_STAR (bullish, score 8) ──
    // Long bearish, small body candle, long bullish
    // Third candle body ≥ first candle body
    if (isBearish(c1) && isLongCandle(c1) && isSmallCandle(c2) && isBullish(c3) && isLongCandle(c3)) {
      if (c2.l > c1.l && candleBody(c3) >= candleBody(c1) * 0.5) {
        results.push({ logic: 'MORNING_STAR', dir: 'UP', score: 8 });
      }
    }

    // ── EVENING_STAR (bearish, score 8) ──
    // Long bullish, small body candle, long bearish
    if (isBullish(c1) && isLongCandle(c1) && isSmallCandle(c2) && isBearish(c3) && isLongCandle(c3)) {
      if (c2.h < c1.h && candleBody(c3) >= candleBody(c1) * 0.5) {
        results.push({ logic: 'EVENING_STAR', dir: 'DOWN', score: 8 });
      }
    }

    // ── MORNING_DOJI_STAR (bullish, score 8) ──
    // Morning star but middle candle is doji
    if (isBearish(c1) && isLongCandle(c1) && isDoji(c2) && isBullish(c3) && isLongCandle(c3)) {
      if (c2.l > c1.l && candleBody(c3) >= candleBody(c1) * 0.5) {
        results.push({ logic: 'MORNING_DOJI_STAR', dir: 'UP', score: 8 });
      }
    }

    // ── EVENING_DOJI_STAR (bearish, score 8) ──
    // Evening star but middle candle is doji
    if (isBullish(c1) && isLongCandle(c1) && isDoji(c2) && isBearish(c3) && isLongCandle(c3)) {
      if (c2.h < c1.h && candleBody(c3) >= candleBody(c1) * 0.5) {
        results.push({ logic: 'EVENING_DOJI_STAR', dir: 'DOWN', score: 8 });
      }
    }

    // ── THREE_WHITE_SOLDIERS (bullish, score 8) ──
    // Three consecutive long bullish candles, each opens within prev body, closes higher
    if (isBullish(c1) && isBullish(c2) && isBullish(c3)) {
      if (
        isLongCandle(c1) && isLongCandle(c2) && isLongCandle(c3) &&
        c2.o >= c1.o && c2.o <= c1.cl &&
        c3.o >= c2.o && c3.o <= c2.cl &&
        c3.cl > c2.cl && c2.cl > c1.cl
      ) {
        results.push({ logic: 'THREE_WHITE_SOLDIERS', dir: 'UP', score: 8 });
      }
    }

    // ── THREE_BLACK_CROWS (bearish, score 8) ──
    // Three consecutive long bearish candles, each opens within prev body, closes lower
    if (isBearish(c1) && isBearish(c2) && isBearish(c3)) {
      if (
        isLongCandle(c1) && isLongCandle(c2) && isLongCandle(c3) &&
        c2.o <= c1.o && c2.o >= c1.cl &&
        c3.o <= c2.o && c3.o >= c2.cl &&
        c3.cl < c2.cl && c2.cl < c1.cl
      ) {
        results.push({ logic: 'THREE_BLACK_CROWS', dir: 'DOWN', score: 8 });
      }
    }

    // ── THREE_INSIDE_UP (bullish, score 7) ──
    // Large bearish c1, small bullish c2 inside it, third bullish c3 closes above c1's open
    if (isBearish(c1) && isLongCandle(c1) && isBullish(c2) && isBullish(c3)) {
      if (
        c2.o > c1.cl && c2.cl < c1.o &&
        c3.cl > c1.o
      ) {
        results.push({ logic: 'THREE_INSIDE_UP', dir: 'UP', score: 7 });
      }
    }

    // ── THREE_INSIDE_DOWN (bearish, score 7) ──
    // Large bullish c1, small bearish c2 inside it, third bearish c3 closes below c1's open
    if (isBullish(c1) && isLongCandle(c1) && isBearish(c2) && isBearish(c3)) {
      if (
        c2.o < c1.cl && c2.cl > c1.o &&
        c3.cl < c1.o
      ) {
        results.push({ logic: 'THREE_INSIDE_DOWN', dir: 'DOWN', score: 7 });
      }
    }

    // ── THREE_OUTSIDE_UP (bullish, score 7) ──
    // Bearish c1, bullish c2 engulfing it, third bullish c3 closes higher
    if (isBearish(c1) && isBullish(c2) && isBullish(c3)) {
      const c1Body = candleBody(c1);
      const c2Body = candleBody(c2);
      if (
        c2Body > c1Body &&
        c2.o <= c1.cl && c2.cl >= c1.o &&
        c3.cl > c2.cl
      ) {
        results.push({ logic: 'THREE_OUTSIDE_UP', dir: 'UP', score: 7 });
      }
    }

    // ── THREE_OUTSIDE_DOWN (bearish, score 7) ──
    // Bullish c1, bearish c2 engulfing it, third bearish c3 closes lower
    if (isBullish(c1) && isBearish(c2) && isBearish(c3)) {
      const c1Body = candleBody(c1);
      const c2Body = candleBody(c2);
      if (
        c2Body > c1Body &&
        c2.o >= c1.cl && c2.cl <= c1.o &&
        c3.cl < c2.cl
      ) {
        results.push({ logic: 'THREE_OUTSIDE_DOWN', dir: 'DOWN', score: 7 });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // NEW PATTERNS — Multi-Candle Patterns
  // ══════════════════════════════════════════════════════════════════════

  // ── RISING_THREE_METHODS (bullish continuation, score 6) ──
  // Long bullish, 3 small bearish within range, another long bullish closing above first high
  if (dLen >= 5) {
    const m1 = d[dLen - 5];
    const m2 = d[dLen - 4];
    const m3 = d[dLen - 3];
    const m4 = d[dLen - 2];
    const m5 = d[dLen - 1];

    if (
      isBullish(m1) && isLongCandle(m1) &&
      isBearish(m2) && !isLongCandle(m2) &&
      isBearish(m3) && !isLongCandle(m3) &&
      isBearish(m4) && !isLongCandle(m4) &&
      m2.l >= m1.l && m2.h <= m1.h &&
      m3.l >= m1.l && m3.h <= m1.h &&
      m4.l >= m1.l && m4.h <= m1.h &&
      isBullish(m5) && isLongCandle(m5) &&
      m5.cl > m1.h
    ) {
      results.push({ logic: 'RISING_THREE_METHODS', dir: 'UP', score: 6 });
    }
  }

  // ── FALLING_THREE_METHODS (bearish continuation, score 6) ──
  // Long bearish, 3 small bullish within range, another long bearish closing below first low
  if (dLen >= 5) {
    const m1 = d[dLen - 5];
    const m2 = d[dLen - 4];
    const m3 = d[dLen - 3];
    const m4 = d[dLen - 2];
    const m5 = d[dLen - 1];

    if (
      isBearish(m1) && isLongCandle(m1) &&
      isBullish(m2) && !isLongCandle(m2) &&
      isBullish(m3) && !isLongCandle(m3) &&
      isBullish(m4) && !isLongCandle(m4) &&
      m2.l >= m1.l && m2.h <= m1.h &&
      m3.l >= m1.l && m3.h <= m1.h &&
      m4.l >= m1.l && m4.h <= m1.h &&
      isBearish(m5) && isLongCandle(m5) &&
      m5.cl < m1.l
    ) {
      results.push({ logic: 'FALLING_THREE_METHODS', dir: 'DOWN', score: 6 });
    }
  }

  // ── THREE_LINE_STRIKE_BULL (bullish, score 6) ──
  // Three bullish candles followed by long bearish candle
  // Expect uptrend continuation (the bearish is a pullback)
  if (dLen >= 4) {
    const s1 = d[dLen - 4];
    const s2 = d[dLen - 3];
    const s3 = d[dLen - 2];
    const s4 = d[dLen - 1];

    if (
      isBullish(s1) && isBullish(s2) && isBullish(s3) &&
      s2.cl > s1.cl && s3.cl > s2.cl &&
      isBearish(s4) && isLongCandle(s4) &&
      s4.cl > s1.cl && // doesn't erase the entire move
      s4.o > s3.cl
    ) {
      results.push({ logic: 'THREE_LINE_STRIKE_BULL', dir: 'UP', score: 6 });
    }
  }

  // ── THREE_LINE_STRIKE_BEAR (bearish, score 6) ──
  // Three bearish candles followed by long bullish
  // Expect downtrend continuation
  if (dLen >= 4) {
    const s1 = d[dLen - 4];
    const s2 = d[dLen - 3];
    const s3 = d[dLen - 2];
    const s4 = d[dLen - 1];

    if (
      isBearish(s1) && isBearish(s2) && isBearish(s3) &&
      s2.cl < s1.cl && s3.cl < s2.cl &&
      isBullish(s4) && isLongCandle(s4) &&
      s4.cl < s1.cl &&
      s4.o < s3.cl
    ) {
      results.push({ logic: 'THREE_LINE_STRIKE_BEAR', dir: 'DOWN', score: 6 });
    }
  }

  // ── LADDER_BOTTOM (bullish, score 7) ──
  // Three long bearish, small candle, long bullish closing above third bearish high
  if (dLen >= 5) {
    const lb1 = d[dLen - 5];
    const lb2 = d[dLen - 4];
    const lb3 = d[dLen - 3];
    const lb4 = d[dLen - 2];
    const lb5 = d[dLen - 1];

    if (
      isBearish(lb1) && isLongCandle(lb1) &&
      isBearish(lb2) && isLongCandle(lb2) &&
      isBearish(lb3) && isLongCandle(lb3) &&
      lb2.cl < lb1.cl && lb3.cl < lb2.cl &&
      isSmallCandle(lb4) &&
      isBullish(lb5) && isLongCandle(lb5) &&
      lb5.cl > lb3.h
    ) {
      results.push({ logic: 'LADDER_BOTTOM', dir: 'UP', score: 7 });
    }
  }

  // ── BULLISH_ABANDONED_BABY (bullish, score 8) ──
  // Long bearish, doji gaps down, long bullish gaps up
  // (gaps may be rare in forex, use small gap threshold)
  if (dLen >= 3) {
    const ab1 = d[dLen - 3];
    const ab2 = d[dLen - 2];
    const ab3 = d[dLen - 1];

    if (
      isBearish(ab1) && isLongCandle(ab1) &&
      isDoji(ab2) &&
      isBullish(ab3) && isLongCandle(ab3) &&
      ab2.l < ab1.l && ab2.h < ab1.cl && // doji gaps down from bearish
      ab3.l > ab2.l && ab3.o > ab2.h &&   // bullish gaps up from doji
      ab3.cl > ab1.cl - candleBody(ab1) * 0.5 // closes well into bearish body
    ) {
      results.push({ logic: 'BULLISH_ABANDONED_BABY', dir: 'UP', score: 8 });
    }
  }

  // ── BEARISH_ABANDONED_BABY (bearish, score 8) ──
  // Long bullish, doji gaps up, long bearish gaps down
  if (dLen >= 3) {
    const ab1 = d[dLen - 3];
    const ab2 = d[dLen - 2];
    const ab3 = d[dLen - 1];

    if (
      isBullish(ab1) && isLongCandle(ab1) &&
      isDoji(ab2) &&
      isBearish(ab3) && isLongCandle(ab3) &&
      ab2.h > ab1.h && ab2.l > ab1.cl && // doji gaps up from bullish
      ab3.h < ab2.h && ab3.o < ab2.l &&   // bearish gaps down from doji
      ab3.cl < ab1.cl + candleBody(ab1) * 0.5 // closes well into bullish body
    ) {
      results.push({ logic: 'BEARISH_ABANDONED_BABY', dir: 'DOWN', score: 8 });
    }
  }

  return results;
}

export function analyzeCandles(candles: CandleData[], pair: string, minScore: number): SignalResult | null {
  if (!candles || candles.length < 20) return null;

  const ohlc = parseCandles(candles);
  const patterns = detectPatterns(ohlc);

  if (patterns.length === 0) return null;

  const upScore = patterns.filter(r => r.dir === 'UP').reduce((a, r) => a + r.score, 0);
  const dnScore = patterns.filter(r => r.dir === 'DOWN').reduce((a, r) => a + r.score, 0);

  const dir: 'UP' | 'DOWN' = upScore >= dnScore ? 'UP' : 'DOWN';
  const totalScore = Math.max(upScore, dnScore);

  if (totalScore < minScore) return null;

  const matchLogics = patterns.filter(r => r.dir === dir);

  return {
    pair,
    dir,
    score: Math.min(10, Math.round(totalScore / 2)),
    logic: matchLogics[0].logic,
    logics: matchLogics.map(r => r.logic),
    price: ohlc[ohlc.length - 1].cl,
    time: new Date().toISOString(),
  };
}

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
      t.getUTCMinutes() === et.getUTCMins() &&
      c.complete
    );
  });

  if (!target) return null;

  const o = parseFloat(target.mid.o);
  const cl = parseFloat(target.mid.c);
  const h = parseFloat(target.mid.h);
  const l = parseFloat(target.mid.l);
  const body = Math.abs(cl - o);
  const range = h - l;

  if (range > 0 && body / range < 0.1) return { win: true, doji: true };

  return {
    win: dir === 'UP' ? cl > o : cl < o,
    doji: false,
  };
}
