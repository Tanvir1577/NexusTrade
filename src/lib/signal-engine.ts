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
  category: 'reversal' | 'momentum' | 'technical';
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
  let e = arr.length >= period
    ? arr.slice(0, period).reduce((a, b) => a + b, 0) / period
    : arr[0];
  for (let i = period; i < arr.length; i++) {
    e = arr[i] * k + e * (1 - k);
  }
  return e;
}

// ─── Helpers ──────────────────────────────────────────────────────

function candleBody(c: OHLC): number { return Math.abs(c.cl - c.o); }
function candleRange(c: OHLC): number { return c.h - c.l; }
function upperShadow(c: OHLC): number { return c.h - Math.max(c.cl, c.o); }
function lowerShadow(c: OHLC): number { return Math.min(c.cl, c.o) - c.l; }
function isBullish(c: OHLC): boolean { return c.cl > c.o; }
function isBearish(c: OHLC): boolean { return c.cl < c.o; }

function isDoji(c: OHLC): boolean {
  const r = candleRange(c);
  return r > 0 && candleBody(c) / r < 0.1;
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

function isUptrend(d: OHLC[], lookback: number): boolean {
  if (d.length < lookback) return false;
  return d[d.length - 1].cl > d[d.length - lookback].cl;
}

function isDowntrend(d: OHLC[], lookback: number): boolean {
  if (d.length < lookback) return false;
  return d[d.length - 1].cl < d[d.length - lookback].cl;
}

function pipTolerance(price: number): number {
  return price > 50 ? 0.01 : 0.0001;
}

// ══════════════════════════════════════════════════════════════════════
// PATTERN DETECTION — Only HIGH-CONFIDENCE patterns
// Removed all noise patterns: SPINNING_TOP, SEPARATING_LINES,
// MEETING_LINES, TWEEZER (too loose for M1 forex)
// ══════════════════════════════════════════════════════════════════════

function detectPatterns(c: OHLC[]): PatternResult[] {
  const results: PatternResult[] = [];

  if (c.length < 20) return results;

  const closed = c.filter(x => x.complete);
  if (closed.length < 15) return results;

  const d = closed;
  const dLen = d.length;
  const cur = d[dLen - 1];
  const prev = d[dLen - 2];

  const body = Math.abs(cur.cl - cur.o);
  const range = cur.h - cur.l;
  const upper = cur.h - Math.max(cur.cl, cur.o);
  const lower = Math.min(cur.cl, cur.o) - cur.l;

  // ══════════════════════════════════════════════════════════════
  // TIER 1: STRONG REVERSAL PATTERNS (score 8) — Fire rarely
  // ══════════════════════════════════════════════════════════════

  // 1. ENGULFING — body must be 1.5× larger (was 1.2×)
  const bP = Math.abs(prev.cl - prev.o);
  const bC = Math.abs(cur.cl - cur.o);
  if (prev.cl < prev.o && cur.cl > cur.o && bC > bP * 1.5 && cur.o <= prev.cl && cur.cl >= prev.o) {
    results.push({ logic: 'ENGULFING', dir: 'UP', score: 8, category: 'reversal' });
  }
  if (prev.cl > prev.o && cur.cl < cur.o && bC > bP * 1.5 && cur.o >= prev.cl && cur.cl <= prev.o) {
    results.push({ logic: 'ENGULFING', dir: 'DOWN', score: 8, category: 'reversal' });
  }

  // 2. PIN BAR — tighter: tail > 3× body AND tail > 2.5× nose (was 2×)
  if (range > 0 && body < range * 0.25) {
    const nose = cur.cl > cur.o ? cur.h - cur.cl : cur.h - cur.o;
    const tail = cur.cl > cur.o ? cur.o - cur.l : cur.cl - cur.l;
    if (tail > body * 3 && tail > nose * 2.5) {
      results.push({ logic: 'PIN_BAR', dir: 'UP', score: 8, category: 'reversal' });
    }
    if (nose > body * 3 && nose > tail * 2.5) {
      results.push({ logic: 'PIN_BAR', dir: 'DOWN', score: 8, category: 'reversal' });
    }
  }

  // 3. SUPPORT BOUNCE / RESISTANCE REJECT — score 8
  if (dLen >= 30) {
    const r30 = d.slice(-30);
    const sortedHi = [...r30.map(x => x.h)].sort((a, b) => b - a);
    const sortedLo = [...r30.map(x => x.l)].sort((a, b) => a - b);
    const rs = sortedHi[2];
    const sup = sortedLo[2];
    if (prev.cl <= sup * 1.001 && cur.cl > sup * 1.001) {
      results.push({ logic: 'SUPPORT_BOUNCE', dir: 'UP', score: 8, category: 'reversal' });
    }
    if (prev.cl >= rs * 0.999 && cur.cl < rs * 0.999) {
      results.push({ logic: 'RESIST_REJECT', dir: 'DOWN', score: 8, category: 'reversal' });
    }
  }

  // 4. BULLISH/BEARISH KICKER — gap required (score 8)
  if (isBearish(prev) && isBullish(cur)) {
    const pip = pipTolerance(cur.cl);
    if (cur.o > prev.o && (cur.o - prev.o) >= pip * 3) {
      results.push({ logic: 'KICKER', dir: 'UP', score: 8, category: 'reversal' });
    }
  }
  if (isBullish(prev) && isBearish(cur)) {
    const pip = pipTolerance(cur.cl);
    if (cur.o < prev.o && (prev.o - cur.o) >= pip * 3) {
      results.push({ logic: 'KICKER', dir: 'DOWN', score: 8, category: 'reversal' });
    }
  }

  // 5. PIERCING LINE — requires cur to close well above prev midpoint (score 8)
  if (isBearish(prev) && isBullish(cur)) {
    const pBody = prev.o - prev.cl;
    if (pBody > 0 && cur.o < prev.cl && cur.cl > prev.cl + pBody * 0.6 && cur.cl < prev.o) {
      results.push({ logic: 'PIERCING_LINE', dir: 'UP', score: 8, category: 'reversal' });
    }
  }

  // 6. DARK CLOUD COVER — requires cur to close well below prev midpoint (score 8)
  if (isBullish(prev) && isBearish(cur)) {
    const pBody = prev.cl - prev.o;
    if (pBody > 0 && cur.o > prev.cl && cur.cl < prev.o + pBody * 0.4 && cur.cl > prev.o) {
      results.push({ logic: 'DARK_CLOUD', dir: 'DOWN', score: 8, category: 'reversal' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // TIER 2: THREE-CANDLE REVERSALS (score 8) — Very rare on M1
  // ══════════════════════════════════════════════════════════════

  if (dLen >= 3) {
    const c1 = d[dLen - 3];
    const c2 = d[dLen - 2];
    const c3 = d[dLen - 1];

    // MORNING STAR
    if (isBearish(c1) && isLongCandle(c1) && isSmallCandle(c2) && isBullish(c3) && isLongCandle(c3)) {
      if (c2.l > c1.l && candleBody(c3) >= candleBody(c1) * 0.5) {
        results.push({ logic: 'MORNING_STAR', dir: 'UP', score: 8, category: 'reversal' });
      }
    }

    // EVENING STAR
    if (isBullish(c1) && isLongCandle(c1) && isSmallCandle(c2) && isBearish(c3) && isLongCandle(c3)) {
      if (c2.h < c1.h && candleBody(c3) >= candleBody(c1) * 0.5) {
        results.push({ logic: 'EVENING_STAR', dir: 'DOWN', score: 8, category: 'reversal' });
      }
    }

    // MORNING DOJI STAR
    if (isBearish(c1) && isLongCandle(c1) && isDoji(c2) && isBullish(c3) && isLongCandle(c3)) {
      if (c2.l > c1.l && candleBody(c3) >= candleBody(c1) * 0.5) {
        results.push({ logic: 'MORNING_DOJI_STAR', dir: 'UP', score: 8, category: 'reversal' });
      }
    }

    // EVENING DOJI STAR
    if (isBullish(c1) && isLongCandle(c1) && isDoji(c2) && isBearish(c3) && isLongCandle(c3)) {
      if (c2.h < c1.h && candleBody(c3) >= candleBody(c1) * 0.5) {
        results.push({ logic: 'EVENING_DOJI_STAR', dir: 'DOWN', score: 8, category: 'reversal' });
      }
    }

    // THREE WHITE SOLDIERS — all must be strong, consecutive
    if (isBullish(c1) && isBullish(c2) && isBullish(c3)) {
      if (
        isLongCandle(c1) && isLongCandle(c2) && isLongCandle(c3) &&
        c2.o >= c1.o && c2.o <= c1.cl &&
        c3.o >= c2.o && c3.o <= c2.cl &&
        c3.cl > c2.cl && c2.cl > c1.cl
      ) {
        results.push({ logic: 'THREE_SOLDIERS', dir: 'UP', score: 8, category: 'momentum' });
      }
    }

    // THREE BLACK CROWS
    if (isBearish(c1) && isBearish(c2) && isBearish(c3)) {
      if (
        isLongCandle(c1) && isLongCandle(c2) && isLongCandle(c3) &&
        c2.o <= c1.o && c2.o >= c1.cl &&
        c3.o <= c2.o && c3.o >= c2.cl &&
        c3.cl < c2.cl && c2.cl < c1.cl
      ) {
        results.push({ logic: 'THREE_CROWS', dir: 'DOWN', score: 8, category: 'momentum' });
      }
    }

    // THREE INSIDE UP
    if (isBearish(c1) && isLongCandle(c1) && isBullish(c2) && isBullish(c3)) {
      if (c2.o > c1.cl && c2.cl < c1.o && c3.cl > c1.o) {
        results.push({ logic: 'THREE_INSIDE_UP', dir: 'UP', score: 8, category: 'reversal' });
      }
    }

    // THREE INSIDE DOWN
    if (isBullish(c1) && isLongCandle(c1) && isBearish(c2) && isBearish(c3)) {
      if (c2.o < c1.cl && c2.cl > c1.o && c3.cl < c1.o) {
        results.push({ logic: 'THREE_INSIDE_DOWN', dir: 'DOWN', score: 8, category: 'reversal' });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // TIER 3: MULTI-CANDLE PATTERNS (score 7-8)
  // ══════════════════════════════════════════════════════════════

  // LADDER BOTTOM — requires 3 declining long bearish + strong bullish reversal
  if (dLen >= 5) {
    const lb1 = d[dLen - 5], lb2 = d[dLen - 4], lb3 = d[dLen - 3];
    const lb4 = d[dLen - 2], lb5 = d[dLen - 1];
    if (
      isBearish(lb1) && isLongCandle(lb1) &&
      isBearish(lb2) && isLongCandle(lb2) &&
      isBearish(lb3) && isLongCandle(lb3) &&
      lb2.cl < lb1.cl && lb3.cl < lb2.cl &&
      isSmallCandle(lb4) &&
      isBullish(lb5) && isLongCandle(lb5) &&
      lb5.cl > lb3.h
    ) {
      results.push({ logic: 'LADDER_BOTTOM', dir: 'UP', score: 8, category: 'reversal' });
    }
  }

  // ABANDONED BABY (bullish)
  if (dLen >= 3) {
    const ab1 = d[dLen - 3], ab2 = d[dLen - 2], ab3 = d[dLen - 1];
    if (
      isBearish(ab1) && isLongCandle(ab1) &&
      isDoji(ab2) &&
      isBullish(ab3) && isLongCandle(ab3) &&
      ab2.l < ab1.l && ab2.h < ab1.cl &&
      ab3.l > ab2.l && ab3.o > ab2.h &&
      ab3.cl > ab1.cl - candleBody(ab1) * 0.5
    ) {
      results.push({ logic: 'ABANDONED_BABY', dir: 'UP', score: 8, category: 'reversal' });
    }

    // ABANDONED BABY (bearish)
    if (
      isBullish(ab1) && isLongCandle(ab1) &&
      isDoji(ab2) &&
      isBearish(ab3) && isLongCandle(ab3) &&
      ab2.h > ab1.h && ab2.l > ab1.cl &&
      ab3.h < ab2.h && ab3.o < ab2.l &&
      ab3.cl < ab1.cl + candleBody(ab1) * 0.5
    ) {
      results.push({ logic: 'ABANDONED_BABY', dir: 'DOWN', score: 8, category: 'reversal' });
    }
  }

  // RISING THREE METHODS — strict: pullback must not retrace more than 60% of first candle
  if (dLen >= 5) {
    const m1 = d[dLen - 5], m2 = d[dLen - 4], m3 = d[dLen - 3];
    const m4 = d[dLen - 2], m5 = d[dLen - 1];
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
      results.push({ logic: 'RISING_THREE', dir: 'UP', score: 7, category: 'momentum' });
    }
  }

  // FALLING THREE METHODS
  if (dLen >= 5) {
    const m1 = d[dLen - 5], m2 = d[dLen - 4], m3 = d[dLen - 3];
    const m4 = d[dLen - 2], m5 = d[dLen - 1];
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
      results.push({ logic: 'FALLING_THREE', dir: 'DOWN', score: 7, category: 'momentum' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // TIER 4: TECHNICAL INDICATORS (score 7)
  // ══════════════════════════════════════════════════════════════

  // EMA CROSS — 5/13 crossover
  if (dLen >= 14) {
    const eF = ema(d.slice(-5).map(x => x.cl), 5);
    const eS = ema(d.slice(-13).map(x => x.cl), 13);
    const eFp = ema(d.slice(-6, -1).map(x => x.cl), 5);
    const eSp = ema(d.slice(-14, -1).map(x => x.cl), 13);
    if (eFp < eSp && eF > eS) results.push({ logic: 'EMA_CROSS', dir: 'UP', score: 7, category: 'technical' });
    if (eFp > eSp && eF < eS) results.push({ logic: 'EMA_CROSS', dir: 'DOWN', score: 7, category: 'technical' });
  }

  // RSI OVERSOLD / OVERBOUGHT — RSI < 25 or > 75 (tighter than 28/72)
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
    if (rsi < 25) results.push({ logic: 'RSI_OVERSOLD', dir: 'UP', score: 7, category: 'technical' });
    if (rsi > 75) results.push({ logic: 'RSI_OVERBOUGHT', dir: 'DOWN', score: 7, category: 'technical' });
  }

  // MACD CROSS
  if (dLen >= 27) {
    const cls30 = d.slice(-30).map(x => x.cl);
    const m12 = ema(cls30.slice(-12), 12);
    const m26 = ema(cls30.slice(-26), 26);
    const m12p = ema(cls30.slice(-13, -1), 12);
    const m26p = ema(cls30.slice(-27, -1), 26);
    const macd = m12 - m26;
    const macdP = m12p - m26p;
    if (macdP < 0 && macd > 0) results.push({ logic: 'MACD_CROSS', dir: 'UP', score: 7, category: 'technical' });
    if (macdP > 0 && macd < 0) results.push({ logic: 'MACD_CROSS', dir: 'DOWN', score: 7, category: 'technical' });
  }

  // BOLLINGER SQUEEZE — bands must be 1.5× tighter before (was 1.3×)
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

    if (bw2 > bw * 1.5) {
      if (cur.cl > upper) results.push({ logic: 'BB_SQUEEZE', dir: 'UP', score: 7, category: 'technical' });
      if (cur.cl < lower) results.push({ logic: 'BB_SQUEEZE', dir: 'DOWN', score: 7, category: 'technical' });
    }
  }

  // BREAKOUT — requires 20-bar high/low break (score 7)
  if (dLen >= 22) {
    const r20 = d.slice(-22, -2);
    const hi = Math.max(...r20.map(x => x.h));
    const lo = Math.min(...r20.map(x => x.l));
    if (cur.cl > hi * 1.0003) results.push({ logic: 'BREAKOUT', dir: 'UP', score: 7, category: 'momentum' });
    if (cur.cl < lo * 0.9997) results.push({ logic: 'BREAKOUT', dir: 'DOWN', score: 7, category: 'momentum' });
  }

  // ══════════════════════════════════════════════════════════════
  // TIER 5: MODERATE PATTERNS (score 7) — Require trend context
  // ══════════════════════════════════════════════════════════════

  // HAMMER — only in downtrend, requires 3× shadow ratio (was 2×)
  if (range > 0 && lower > body * 3 && lower > upper * 3 && body < range * 0.25 && isDowntrend(d, 6)) {
    results.push({ logic: 'HAMMER', dir: 'UP', score: 7, category: 'reversal' });
  }

  // SHOOTING STAR — only in uptrend, requires 3× shadow ratio
  if (range > 0 && upper > body * 3 && upper > lower * 3 && body < range * 0.25 && isUptrend(d, 6)) {
    results.push({ logic: 'SHOOTING_STAR', dir: 'DOWN', score: 7, category: 'reversal' });
  }

  // HANGING MAN — only in uptrend, requires 3× shadow + stronger threshold
  if (range > 0 && isUptrend(d, 6)) {
    const hmBody = candleBody(cur);
    const hmLower = lowerShadow(cur);
    const hmUpper = upperShadow(cur);
    if (
      hmBody < range * 0.25 &&
      hmLower > hmBody * 3 &&
      hmUpper < hmBody * 0.5 &&
      hmLower > range * 0.5
    ) {
      results.push({ logic: 'HANGING_MAN', dir: 'DOWN', score: 7, category: 'reversal' });
    }
  }

  // INVERTED HAMMER — only in downtrend
  if (range > 0 && isDowntrend(d, 6)) {
    const invBody = candleBody(cur);
    const invUpper = upperShadow(cur);
    const invLower = lowerShadow(cur);
    if (
      invBody < range * 0.25 &&
      invUpper > invBody * 3 &&
      invLower < invBody * 0.3 &&
      invUpper > range * 0.5
    ) {
      results.push({ logic: 'INVERTED_HAMMER', dir: 'UP', score: 7, category: 'reversal' });
    }
  }

  // MARUBOZU — body > 95% of range (was 90%)
  if (range > 0 && isBullish(cur)) {
    const totalWick = upperShadow(cur) + lowerShadow(cur);
    if (body / range > 0.95 && totalWick / range < 0.03) {
      results.push({ logic: 'MARUBOZU', dir: 'UP', score: 7, category: 'momentum' });
    }
  }
  if (range > 0 && isBearish(cur)) {
    const totalWick = upperShadow(cur) + lowerShadow(cur);
    if (body / range > 0.95 && totalWick / range < 0.03) {
      results.push({ logic: 'MARUBOZU', dir: 'DOWN', score: 7, category: 'momentum' });
    }
  }

  // DOJI REVERSAL — requires strong 6-candle trend (more than just 1 candle)
  if (range > 0 && body / range < 0.1) {
    const trend6 = cur.cl - d[dLen - 6].cl;
    const trend10 = dLen >= 10 ? cur.cl - d[dLen - 10].cl : 0;
    // Both short and medium-term must agree
    if (trend6 < 0 && trend10 < 0) results.push({ logic: 'DOJI_REVERSAL', dir: 'UP', score: 7, category: 'reversal' });
    if (trend6 > 0 && trend10 > 0) results.push({ logic: 'DOJI_REVERSAL', dir: 'DOWN', score: 7, category: 'reversal' });
  }

  // DRAGONFLY DOJI — strong trend context required
  if (range > 0 && body / range < 0.1 && isDowntrend(d, 8)) {
    const ddLower = lowerShadow(cur);
    const ddUpper = upperShadow(cur);
    if (ddLower > range * 0.6 && ddUpper < range * 0.05) {
      results.push({ logic: 'DRAGONFLY_DOJI', dir: 'UP', score: 7, category: 'reversal' });
    }
  }

  // GRAVESTONE DOJI — strong trend context required
  if (range > 0 && body / range < 0.1 && isUptrend(d, 8)) {
    const gsUpper = upperShadow(cur);
    const gsLower = lowerShadow(cur);
    if (gsUpper > range * 0.6 && gsLower < range * 0.05) {
      results.push({ logic: 'GRAVESTONE_DOJI', dir: 'DOWN', score: 7, category: 'reversal' });
    }
  }

  // MOMENTUM — requires strong shift: 4/5 same direction, only 0-1 opposite in prior 5
  if (dLen >= 10) {
    const sl5 = d.slice(-5);
    const sl10 = d.slice(-10, -5);
    const upN = sl5.filter(x => x.cl > x.o).length;
    const upP = sl10.filter(x => x.cl > x.o).length;
    const dnN = sl5.filter(x => x.cl < x.o).length;
    const dnP = sl10.filter(x => x.cl < x.o).length;
    if (upP <= 1 && upN >= 4) results.push({ logic: 'MOMENTUM', dir: 'UP', score: 7, category: 'momentum' });
    if (dnP <= 1 && dnN >= 4) results.push({ logic: 'MOMENTUM', dir: 'DOWN', score: 7, category: 'momentum' });
  }

  // INSIDE BAR — only fires if trend is strong (5+ candles)
  if (cur.h < prev.h && cur.l > prev.l) {
    const trend = prev.cl - d[dLen - 5].cl;
    if (trend < 0 && d[dLen - 5].cl > d[Math.max(0, dLen - 10)].cl) {
      results.push({ logic: 'INSIDE_BAR', dir: 'UP', score: 7, category: 'reversal' });
    }
    if (trend > 0 && d[dLen - 5].cl < d[Math.max(0, dLen - 10)].cl) {
      results.push({ logic: 'INSIDE_BAR', dir: 'DOWN', score: 7, category: 'reversal' });
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════
// SIGNAL ANALYSIS — Brutal consensus system
// ══════════════════════════════════════════════════════════════════════

export function analyzeCandles(candles: CandleData[], pair: string, minScore: number): SignalResult | null {
  if (!candles || candles.length < 20) return null;

  const ohlc = parseCandles(candles);
  const patterns = detectPatterns(ohlc);

  if (patterns.length === 0) return null;

  // Separate UP and DOWN
  const upPatterns = patterns.filter(r => r.dir === 'UP');
  const dnPatterns = patterns.filter(r => r.dir === 'DOWN');

  const upScore = upPatterns.reduce((a, r) => a + r.score, 0);
  const dnScore = dnPatterns.reduce((a, r) => a + r.score, 0);

  const maxScore = Math.max(upScore, dnScore);
  const minDirScore = Math.min(upScore, dnScore);
  const winnerDir: 'UP' | 'DOWN' = upScore >= dnScore ? 'UP' : 'DOWN';
  const winnerPatterns = winnerDir === 'UP' ? upPatterns : dnPatterns;
  const loserPatterns = winnerDir === 'UP' ? dnPatterns : upPatterns;

  // ══════════════════════════════════════════════════════════════
  // BRUTAL CONSENSUS — Each filter is a hard kill
  // ══════════════════════════════════════════════════════════════

  // KILL 1: Need at least 2 strong patterns agreeing
  if (winnerPatterns.length < 2) return null;

  // KILL 2: Winner must DOMINATE — at least 2× the loser score
  // (prevents 50/50 garbage from passing)
  if (minDirScore > 0 && maxScore < minDirScore * 2) return null;

  // KILL 3: If ANY opposing pattern fires, need at least 3 agreeing
  if (loserPatterns.length >= 1 && winnerPatterns.length < 3) return null;

  // KILL 4: If 2+ opposing patterns fire, need at least 4 agreeing
  if (loserPatterns.length >= 2 && winnerPatterns.length < 4) return null;

  // KILL 5: Must beat user's minimum score
  if (maxScore < minScore) return null;

  // KILL 6: At least one pattern must be score 8 (tier 1 or tier 2)
  const hasTier1 = winnerPatterns.some(r => r.score >= 8);
  if (!hasTier1) return null;

  // KILL 7: Must have patterns from at least 2 different categories
  // (prevents "3 momentum indicators agreeing" from being the only reason)
  const categories = new Set(winnerPatterns.map(r => r.category));
  if (categories.size < 2) return null;

  // ══════════════════════════════════════════════════════════════
  // Quality score — based on consensus strength + category diversity
  // ══════════════════════════════════════════════════════════════

  let qualityScore = 5; // base
  qualityScore += Math.min(3, winnerPatterns.length - 1); // +1 per extra pattern (max 3)
  if (categories.size >= 3) qualityScore += 1; // bonus for 3+ categories
  if (winnerPatterns.some(r => r.score >= 8)) qualityScore += 1; // tier 1 bonus

  qualityScore = Math.min(10, qualityScore);

  return {
    pair,
    dir: winnerDir,
    score: qualityScore,
    logic: winnerPatterns[0].logic,
    logics: winnerPatterns.map(r => r.logic),
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
  const range = h - l;

  if (range > 0 && body / range < 0.1) return { win: true, doji: true };

  return {
    win: dir === 'UP' ? cl > o : cl < o,
    doji: false,
  };
}
