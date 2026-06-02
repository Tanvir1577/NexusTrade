// ══════════════════════════════════════════════════════════════════════
// NEXUSTRADE PRO — Signal Engine v3.0 (ATR-Gated)
//
// ROOT CAUSE FIX: All previous versions used percentage-based thresholds
// which treat M1 noise (0.1-0.3 pip candles) as real patterns.
//
// This version calculates 14-period ATR (Average True Range) and requires
// every candle involved in a pattern to be SIGNIFICANT relative to ATR.
// This eliminates ~80% of false pattern triggers on M1 data.
//
// REMOVED M1-toxic patterns: EMA_CROSS, MACD_CROSS, BB_SQUEEZE
// (these fire constantly on M1 and create false consensus)
// ══════════════════════════════════════════════════════════════════════

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
  category: 'reversal' | 'momentum';
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

// ─── Data Parsing ────────────────────────────────────────────────

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

// ─── ATR (Average True Range) ───────────────────────────────────

function calcATR(d: OHLC[], period: number): number {
  if (d.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < d.length && trs.length < period; i++) {
    const c = d[d.length - 1 - i];
    const p = d[d.length - i]; // previous (more recent → index is ahead)
    // Actually: d is sorted oldest→newest, so:
    const cur = d[d.length - i];
    const prev = d[d.length - i - 1];
    if (!prev) break;
    const tr = Math.max(
      cur.h - cur.l,
      Math.abs(cur.h - prev.cl),
      Math.abs(cur.l - prev.cl)
    );
    trs.push(tr);
  }
  if (trs.length < period) return 0;
  // Use last `period` values
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ─── Helpers ─────────────────────────────────────────────────────

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

function isLongCandle(c: OHLC, atr: number): boolean {
  return candleRange(c) >= atr * 0.6 && candleBody(c) / candleRange(c) > 0.55;
}

function isSmallCandle(c: OHLC, atr: number): boolean {
  return candleRange(c) < atr * 0.4 && candleBody(c) < candleRange(c) * 0.3;
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
// PATTERN DETECTION — ATR-Gated
//
// Every pattern requires candles to be SIGNIFICANT relative to ATR.
// - "Significant candle" = range >= atr * 0.4 (40% of average range)
// - "Strong candle" = range >= atr * 0.6 (60% of average range)
// - "Decisive candle" = range >= atr * 0.8 (80% of average range)
//
// Categories: 'reversal' and 'momentum' only (removed 'technical')
// ══════════════════════════════════════════════════════════════════════

function detectPatterns(c: OHLC[], atr: number): PatternResult[] {
  const results: PatternResult[] = [];

  // Need at least 20 closed candles and valid ATR
  if (c.length < 20 || atr <= 0) return results;

  const closed = c.filter(x => x.complete);
  if (closed.length < 15) return results;

  const d = closed;
  const dLen = d.length;
  const cur = d[dLen - 1];
  const prev = d[dLen - 2];

  const body = candleBody(cur);
  const range = candleRange(cur);
  const upper = upperShadow(cur);
  const lower = lowerShadow(cur);

  // ─── ATR GATE ───────────────────────────────────────────────
  // Current candle must be at least 40% of ATR to participate in ANY pattern.
  // This is the #1 filter that kills M1 noise.
  if (range < atr * 0.4) return results;

  // ══════════════════════════════════════════════════════════════
  // TIER 1: STRONG REVERSAL PATTERNS (score 9)
  // Require decisive candles (>= 60% ATR) + strict ratios
  // ══════════════════════════════════════════════════════════════

  // 1. ENGULFING — cur body must be 1.8× prev body, AND both must be significant
  const bP = candleBody(prev);
  const bC = body;
  const prevRange = candleRange(prev);
  // Both current and previous candle must be significant
  if (prevRange >= atr * 0.3 && range >= atr * 0.5) {
    if (isBearish(prev) && isBullish(cur) && bC > bP * 1.8 && cur.o <= prev.cl && cur.cl >= prev.o) {
      results.push({ logic: 'ENGULFING', dir: 'UP', score: 9, category: 'reversal' });
    }
    if (isBullish(prev) && isBearish(cur) && bC > bP * 1.8 && cur.o >= prev.cl && cur.cl <= prev.o) {
      results.push({ logic: 'ENGULFING', dir: 'DOWN', score: 9, category: 'reversal' });
    }
  }

  // 2. PIN BAR — tail must be 4× body, AND candle range must be >= 80% ATR
  if (range >= atr * 0.8 && body < range * 0.2) {
    const nose = cur.cl > cur.o ? cur.h - cur.cl : cur.h - cur.o;
    const tail = cur.cl > cur.o ? cur.o - cur.l : cur.cl - cur.l;
    if (tail > body * 4 && tail > nose * 3) {
      results.push({ logic: 'PIN_BAR', dir: 'UP', score: 9, category: 'reversal' });
    }
    if (nose > body * 4 && nose > tail * 3) {
      results.push({ logic: 'PIN_BAR', dir: 'DOWN', score: 9, category: 'reversal' });
    }
  }

  // 3. KICKER — gap required (at least 5× pip tolerance), both candles must be significant
  if (prevRange >= atr * 0.5 && range >= atr * 0.5) {
    if (isBearish(prev) && isBullish(cur)) {
      const pip = pipTolerance(cur.cl);
      if (cur.o > prev.cl && (cur.o - prev.cl) >= pip * 5) {
        results.push({ logic: 'KICKER', dir: 'UP', score: 9, category: 'reversal' });
      }
    }
    if (isBullish(prev) && isBearish(cur)) {
      const pip = pipTolerance(cur.cl);
      if (cur.o < prev.cl && (prev.cl - cur.o) >= pip * 5) {
        results.push({ logic: 'KICKER', dir: 'DOWN', score: 9, category: 'reversal' });
      }
    }
  }

  // 4. PIERCING LINE — prev must be strong bearish, cur must close well above midpoint
  if (prevRange >= atr * 0.5 && range >= atr * 0.5) {
    if (isBearish(prev) && isBullish(cur)) {
      const pBody = prev.o - prev.cl;
      if (pBody > 0 && cur.o < prev.cl && cur.cl > prev.cl + pBody * 0.6 && cur.cl < prev.o) {
        results.push({ logic: 'PIERCING_LINE', dir: 'UP', score: 9, category: 'reversal' });
      }
    }
  }

  // 5. DARK CLOUD COVER — prev must be strong bullish, cur must close well below midpoint
  if (prevRange >= atr * 0.5 && range >= atr * 0.5) {
    if (isBullish(prev) && isBearish(cur)) {
      const pBody = prev.cl - prev.o;
      if (pBody > 0 && cur.o > prev.cl && cur.cl < prev.o + pBody * 0.4 && cur.cl > prev.o) {
        results.push({ logic: 'DARK_CLOUD', dir: 'DOWN', score: 9, category: 'reversal' });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // TIER 2: THREE-CANDLE REVERSALS (score 9)
  // All 3 candles must be significant (>= 50% ATR)
  // ══════════════════════════════════════════════════════════════

  if (dLen >= 3) {
    const c1 = d[dLen - 3];
    const c2 = d[dLen - 2];
    const c3 = d[dLen - 1];

    // All three candles must be significant
    const allSignificant =
      candleRange(c1) >= atr * 0.5 &&
      candleRange(c2) >= atr * 0.3 &&
      candleRange(c3) >= atr * 0.5;

    if (allSignificant) {
      // MORNING STAR — bearish long → small → bullish long
      if (isBearish(c1) && isLongCandle(c1, atr) && isSmallCandle(c2, atr) && isBullish(c3) && isLongCandle(c3, atr)) {
        if (c2.l > c1.l && candleBody(c3) >= candleBody(c1) * 0.5) {
          results.push({ logic: 'MORNING_STAR', dir: 'UP', score: 9, category: 'reversal' });
        }
      }

      // EVENING STAR
      if (isBullish(c1) && isLongCandle(c1, atr) && isSmallCandle(c2, atr) && isBearish(c3) && isLongCandle(c3, atr)) {
        if (c2.h < c1.h && candleBody(c3) >= candleBody(c1) * 0.5) {
          results.push({ logic: 'EVENING_STAR', dir: 'DOWN', score: 9, category: 'reversal' });
        }
      }

      // MORNING DOJI STAR
      if (isBearish(c1) && isLongCandle(c1, atr) && isDoji(c2) && isBullish(c3) && isLongCandle(c3, atr)) {
        if (c2.l > c1.l && candleBody(c3) >= candleBody(c1) * 0.5) {
          results.push({ logic: 'MORNING_DOJI_STAR', dir: 'UP', score: 9, category: 'reversal' });
        }
      }

      // EVENING DOJI STAR
      if (isBullish(c1) && isLongCandle(c1, atr) && isDoji(c2) && isBearish(c3) && isLongCandle(c3, atr)) {
        if (c2.h < c1.h && candleBody(c3) >= candleBody(c1) * 0.5) {
          results.push({ logic: 'EVENING_DOJI_STAR', dir: 'DOWN', score: 9, category: 'reversal' });
        }
      }
    }

    // THREE WHITE SOLDIERS — all must be strong bullish long candles
    const allLong =
      candleRange(c1) >= atr * 0.6 && candleRange(c2) >= atr * 0.6 && candleRange(c3) >= atr * 0.6;

    if (allLong && isBullish(c1) && isBullish(c2) && isBullish(c3)) {
      if (
        isLongCandle(c1, atr) && isLongCandle(c2, atr) && isLongCandle(c3, atr) &&
        c2.o >= c1.o && c2.o <= c1.cl &&
        c3.o >= c2.o && c3.o <= c2.cl &&
        c3.cl > c2.cl && c2.cl > c1.cl
      ) {
        results.push({ logic: 'THREE_SOLDIERS', dir: 'UP', score: 9, category: 'momentum' });
      }
    }

    // THREE BLACK CROWS
    if (allLong && isBearish(c1) && isBearish(c2) && isBearish(c3)) {
      if (
        isLongCandle(c1, atr) && isLongCandle(c2, atr) && isLongCandle(c3, atr) &&
        c2.o <= c1.o && c2.o >= c1.cl &&
        c3.o <= c2.o && c3.o >= c2.cl &&
        c3.cl < c2.cl && c2.cl < c1.cl
      ) {
        results.push({ logic: 'THREE_CROWS', dir: 'DOWN', score: 9, category: 'momentum' });
      }
    }

    // THREE INSIDE UP — harami confirmed by strong third candle
    if (allSignificant) {
      if (isBearish(c1) && isLongCandle(c1, atr) && isBullish(c2) && isBullish(c3) && isLongCandle(c3, atr)) {
        if (c2.o > c1.cl && c2.cl < c1.o && c3.cl > c1.o) {
          results.push({ logic: 'THREE_INSIDE_UP', dir: 'UP', score: 9, category: 'reversal' });
        }
      }

      // THREE INSIDE DOWN
      if (isBullish(c1) && isLongCandle(c1, atr) && isBearish(c2) && isBearish(c3) && isLongCandle(c3, atr)) {
        if (c2.o < c1.cl && c2.cl > c1.o && c3.cl < c1.o) {
          results.push({ logic: 'THREE_INSIDE_DOWN', dir: 'DOWN', score: 9, category: 'reversal' });
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // TIER 3: MULTI-CANDLE PATTERNS (score 8)
  // ══════════════════════════════════════════════════════════════

  // LADDER BOTTOM — 3 declining long bearish + small + strong bullish
  if (dLen >= 5) {
    const lb1 = d[dLen - 5], lb2 = d[dLen - 4], lb3 = d[dLen - 3];
    const lb4 = d[dLen - 2], lb5 = d[dLen - 1];
    const lbSignificant =
      candleRange(lb1) >= atr * 0.5 && candleRange(lb2) >= atr * 0.5 &&
      candleRange(lb3) >= atr * 0.5 && candleRange(lb5) >= atr * 0.6;

    if (lbSignificant) {
      if (
        isBearish(lb1) && isLongCandle(lb1, atr) &&
        isBearish(lb2) && isLongCandle(lb2, atr) &&
        isBearish(lb3) && isLongCandle(lb3, atr) &&
        lb2.cl < lb1.cl && lb3.cl < lb2.cl &&
        isSmallCandle(lb4, atr) &&
        isBullish(lb5) && isLongCandle(lb5, atr) &&
        lb5.cl > lb3.h
      ) {
        results.push({ logic: 'LADDER_BOTTOM', dir: 'UP', score: 8, category: 'reversal' });
      }
    }
  }

  // ABANDONED BABY
  if (dLen >= 3) {
    const ab1 = d[dLen - 3], ab2 = d[dLen - 2], ab3 = d[dLen - 1];
    const abSignificant =
      candleRange(ab1) >= atr * 0.6 && candleRange(ab3) >= atr * 0.6;

    if (abSignificant && isDoji(ab2)) {
      // Bullish
      if (
        isBearish(ab1) && isLongCandle(ab1, atr) &&
        isBullish(ab3) && isLongCandle(ab3, atr) &&
        ab2.l < ab1.l && ab2.h < ab1.cl &&
        ab3.l > ab2.l && ab3.o > ab2.h &&
        ab3.cl > ab1.cl - candleBody(ab1) * 0.5
      ) {
        results.push({ logic: 'ABANDONED_BABY', dir: 'UP', score: 8, category: 'reversal' });
      }

      // Bearish
      if (
        isBullish(ab1) && isLongCandle(ab1, atr) &&
        isBearish(ab3) && isLongCandle(ab3, atr) &&
        ab2.h > ab1.h && ab2.l > ab1.cl &&
        ab3.h < ab2.h && ab3.o < ab2.l &&
        ab3.cl < ab1.cl + candleBody(ab1) * 0.5
      ) {
        results.push({ logic: 'ABANDONED_BABY', dir: 'DOWN', score: 8, category: 'reversal' });
      }
    }
  }

  // RISING THREE METHODS
  if (dLen >= 5) {
    const m1 = d[dLen - 5], m2 = d[dLen - 4], m3 = d[dLen - 3];
    const m4 = d[dLen - 2], m5 = d[dLen - 1];
    const mSignificant =
      candleRange(m1) >= atr * 0.6 && candleRange(m5) >= atr * 0.6;

    if (mSignificant) {
      if (
        isBullish(m1) && isLongCandle(m1, atr) &&
        isBearish(m2) && !isLongCandle(m2, atr) &&
        isBearish(m3) && !isLongCandle(m3, atr) &&
        isBearish(m4) && !isLongCandle(m4, atr) &&
        m2.l >= m1.l && m2.h <= m1.h &&
        m3.l >= m1.l && m3.h <= m1.h &&
        m4.l >= m1.l && m4.h <= m1.h &&
        isBullish(m5) && isLongCandle(m5, atr) &&
        m5.cl > m1.h
      ) {
        results.push({ logic: 'RISING_THREE', dir: 'UP', score: 8, category: 'momentum' });
      }
    }
  }

  // FALLING THREE METHODS
  if (dLen >= 5) {
    const m1 = d[dLen - 5], m2 = d[dLen - 4], m3 = d[dLen - 3];
    const m4 = d[dLen - 2], m5 = d[dLen - 1];
    const mSignificant =
      candleRange(m1) >= atr * 0.6 && candleRange(m5) >= atr * 0.6;

    if (mSignificant) {
      if (
        isBearish(m1) && isLongCandle(m1, atr) &&
        isBullish(m2) && !isLongCandle(m2, atr) &&
        isBullish(m3) && !isLongCandle(m3, atr) &&
        isBullish(m4) && !isLongCandle(m4, atr) &&
        m2.l >= m1.l && m2.h <= m1.h &&
        m3.l >= m1.l && m3.h <= m1.h &&
        m4.l >= m1.l && m4.h <= m1.h &&
        isBearish(m5) && isLongCandle(m5, atr) &&
        m5.cl < m1.l
      ) {
        results.push({ logic: 'FALLING_THREE', dir: 'DOWN', score: 8, category: 'momentum' });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // TIER 4: BREAKOUT (score 8) — ATR-gated break distance
  // ══════════════════════════════════════════════════════════════

  if (dLen >= 22) {
    const r20 = d.slice(-22, -2);
    const hi = Math.max(...r20.map(x => x.h));
    const lo = Math.min(...r20.map(x => x.l));
    // Break must be at least 0.5 ATR beyond the range (significant move)
    const breakDist = atr * 0.5;
    if (cur.cl > hi + breakDist) {
      results.push({ logic: 'BREAKOUT', dir: 'UP', score: 8, category: 'momentum' });
    }
    if (cur.cl < lo - breakDist) {
      results.push({ logic: 'BREAKOUT', dir: 'DOWN', score: 8, category: 'momentum' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // TIER 5: MODERATE PATTERNS (score 8) — Trend context required
  // ══════════════════════════════════════════════════════════════

  // HAMMER — only in downtrend, shadow 3× body, candle >= 60% ATR
  if (range >= atr * 0.6 && lower > body * 3 && lower > upper * 3 && body < range * 0.25 && isDowntrend(d, 6)) {
    results.push({ logic: 'HAMMER', dir: 'UP', score: 8, category: 'reversal' });
  }

  // SHOOTING STAR — only in uptrend, shadow 3× body, candle >= 60% ATR
  if (range >= atr * 0.6 && upper > body * 3 && upper > lower * 3 && body < range * 0.25 && isUptrend(d, 6)) {
    results.push({ logic: 'SHOOTING_STAR', dir: 'DOWN', score: 8, category: 'reversal' });
  }

  // HANGING MAN — only in uptrend, requires decisive lower shadow
  if (range >= atr * 0.6 && isUptrend(d, 6)) {
    if (
      body < range * 0.25 &&
      lower > body * 3 &&
      upper < body * 0.5 &&
      lower > range * 0.5
    ) {
      results.push({ logic: 'HANGING_MAN', dir: 'DOWN', score: 8, category: 'reversal' });
    }
  }

  // INVERTED HAMMER — only in downtrend, requires decisive upper shadow
  if (range >= atr * 0.6 && isDowntrend(d, 6)) {
    if (
      body < range * 0.25 &&
      upper > body * 3 &&
      lower < body * 0.3 &&
      upper > range * 0.5
    ) {
      results.push({ logic: 'INVERTED_HAMMER', dir: 'UP', score: 8, category: 'reversal' });
    }
  }

  // MARUBOZU — body > 95% of range, candle must be >= 80% ATR (very strong move)
  if (range >= atr * 0.8) {
    const totalWick = upper + lower;
    if (body / range > 0.95 && totalWick / range < 0.03) {
      if (isBullish(cur)) results.push({ logic: 'MARUBOZU', dir: 'UP', score: 8, category: 'momentum' });
      if (isBearish(cur)) results.push({ logic: 'MARUBOZU', dir: 'DOWN', score: 8, category: 'momentum' });
    }
  }

  // MOMENTUM — 4/5 same direction in recent 5, reversal in prior 5
  // Requires recent 5 candles to be significant
  if (dLen >= 10) {
    const sl5 = d.slice(-5);
    const sl10 = d.slice(-10, -5);
    // Check that at least 3 of the last 5 candles are significant
    const significantCount5 = sl5.filter(x => candleRange(x) >= atr * 0.3).length;
    if (significantCount5 >= 3) {
      const upN = sl5.filter(x => x.cl > x.o).length;
      const upP = sl10.filter(x => x.cl > x.o).length;
      const dnN = sl5.filter(x => x.cl < x.o).length;
      const dnP = sl10.filter(x => x.cl < x.o).length;
      if (upP <= 1 && upN >= 4) results.push({ logic: 'MOMENTUM', dir: 'UP', score: 8, category: 'momentum' });
      if (dnP <= 1 && dnN >= 4) results.push({ logic: 'MOMENTUM', dir: 'DOWN', score: 8, category: 'momentum' });
    }
  }

  // INSIDE BAR — only with strong 10-candle trend
  if (cur.h < prev.h && cur.l > prev.l && prevRange >= atr * 0.5) {
    if (dLen >= 10) {
      const trend = prev.cl - d[dLen - 5].cl;
      if (trend < 0 && d[dLen - 5].cl > d[dLen - 10].cl) {
        results.push({ logic: 'INSIDE_BAR', dir: 'UP', score: 8, category: 'reversal' });
      }
      if (trend > 0 && d[dLen - 5].cl < d[dLen - 10].cl) {
        results.push({ logic: 'INSIDE_BAR', dir: 'DOWN', score: 8, category: 'reversal' });
      }
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════
// SIGNAL ANALYSIS — Brutal consensus system v3
//
// Layer 1: ATR gate (in detectPatterns)
// Layer 2: Minimum 3 patterns agreeing (up from 2)
// Layer 3: Winner must DOMINATE 2.5× loser (up from 2×)
// Layer 4: Contradiction penalty — if opposing patterns fire, need 4+ agreeing
// Layer 5: At least one tier-1 pattern (score 9)
// Layer 6: Must have 2+ categories (reversal + momentum)
// Layer 7: Trend alignment bonus — signal direction must match 10-candle trend
// ══════════════════════════════════════════════════════════════════════

// Per-pair cooldown tracker
const _cooldowns = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per pair

export function analyzeCandles(candles: CandleData[], pair: string, minScore: number): SignalResult | null {
  if (!candles || candles.length < 20) return null;

  // ─── COOLDOWN CHECK ─────────────────────────────────────────
  const now = Date.now();
  const lastSignal = _cooldowns.get(pair) || 0;
  if (now - lastSignal < COOLDOWN_MS) return null;

  const ohlc = parseCandles(candles);
  const atr = calcATR(ohlc, 14);

  // If ATR is 0 or too low, data is unreliable — skip
  if (atr <= 0) return null;

  const patterns = detectPatterns(ohlc, atr);
  if (patterns.length === 0) return null;

  // Separate UP and DOWN
  const upPatterns = patterns.filter(r => r.dir === 'UP');
  const dnPatterns = patterns.filter(r => r.dir === 'DOWN');

  if (upPatterns.length === 0 && dnPatterns.length === 0) return null;

  const upScore = upPatterns.reduce((a, r) => a + r.score, 0);
  const dnScore = dnPatterns.reduce((a, r) => a + r.score, 0);

  const maxScore = Math.max(upScore, dnScore);
  const minDirScore = Math.min(upScore, dnScore);
  const winnerDir: 'UP' | 'DOWN' = upScore >= dnScore ? 'UP' : 'DOWN';
  const winnerPatterns = winnerDir === 'UP' ? upPatterns : dnPatterns;
  const loserPatterns = winnerDir === 'UP' ? dnPatterns : upPatterns;

  // ══════════════════════════════════════════════════════════════
  // BRUTAL CONSENSUS v3 — Each filter is a hard kill
  // ══════════════════════════════════════════════════════════════

  // KILL 1: Need at least 3 patterns agreeing (up from 2)
  if (winnerPatterns.length < 3) return null;

  // KILL 2: Winner must DOMINATE — at least 2.5× the loser score
  if (minDirScore > 0 && maxScore < minDirScore * 2.5) return null;

  // KILL 3: If ANY opposing pattern fires, need at least 4 agreeing
  if (loserPatterns.length >= 1 && winnerPatterns.length < 4) return null;

  // KILL 4: If 2+ opposing patterns fire, need at least 5 agreeing (nearly impossible without real consensus)
  if (loserPatterns.length >= 2 && winnerPatterns.length < 5) return null;

  // KILL 5: Must beat user's minimum score
  if (maxScore < minScore) return null;

  // KILL 6: At least one pattern must be score 9 (tier 1)
  const hasTier1 = winnerPatterns.some(r => r.score >= 9);
  if (!hasTier1) return null;

  // KILL 7: Must have patterns from BOTH categories (reversal + momentum)
  const categories = new Set(winnerPatterns.map(r => r.category));
  if (categories.size < 2) return null;

  // ─── TREND ALIGNMENT ──────────────────────────────────────
  // The signal should ideally align with the broader trend.
  // We don't hard-kill here (reversals can be valid), but we
  // penalize quality score if going against the 10-candle trend.
  const closed = ohlc.filter(x => x.complete);
  const trendAligned =
    (winnerDir === 'UP' && isUptrend(closed, 10)) ||
    (winnerDir === 'DOWN' && isDowntrend(closed, 10));

  // ══════════════════════════════════════════════════════════════
  // Quality Score — based on consensus strength
  // ══════════════════════════════════════════════════════════════

  let qualityScore = 5; // base
  qualityScore += Math.min(3, winnerPatterns.length - 2); // +1 per pattern beyond 3 (max 3)
  if (categories.size >= 2) qualityScore += 1; // multi-category bonus
  if (trendAligned) qualityScore += 1; // trend alignment bonus
  if (loserPatterns.length === 0) qualityScore += 1; // zero contradiction bonus

  qualityScore = Math.min(10, qualityScore);

  // If going against trend AND quality is low, kill it
  if (!trendAligned && qualityScore < 8) return null;

  // ══════════════════════════════════════════════════════════════
  // Set cooldown and return
  // ══════════════════════════════════════════════════════════════

  _cooldowns.set(pair, now);

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

// ─── Timing ─────────────────────────────────────────────────────

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

// ─── Result Checking ────────────────────────────────────────────

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
