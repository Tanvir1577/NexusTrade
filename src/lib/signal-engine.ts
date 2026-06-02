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
  let e = arr[0];
  for (let i = 1; i < arr.length; i++) {
    e = arr[i] * k + e * (1 - k);
  }
  return e;
}

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
  if (range > 0 && lower > body * 2.5 && lower > upper * 2 && body < range * 0.3) {
    results.push({ logic: 'HAMMER', dir: 'UP', score: 7 });
  }
  if (range > 0 && upper > body * 2.5 && upper > lower * 2 && body < range * 0.3) {
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

  // 9. BOLLINGER SQUEEZE
  if (dLen >= 28) {
    const cls22 = d.slice(-22).map(x => x.cl);
    const sma = cls22.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sd = Math.sqrt(cls22.slice(-20).map(x => (x - sma) ** 2).reduce((a, b) => a + b, 0) / 20);
    const bw = (sd * 4) / sma;

    const cls28 = d.slice(-28, -6).map(x => x.cl);
    const sma2 = cls28.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sd2 = Math.sqrt(cls28.slice(-20).map(x => (x - sma2) ** 2).reduce((a, b) => a + b, 0) / 20);
    const bw2 = (sd2 * 4) / sma2;

    if (bw2 > bw * 1.3) {
      if (cur.cl > sma) results.push({ logic: 'BB_SQUEEZE', dir: 'UP', score: 7 });
      if (cur.cl < sma) results.push({ logic: 'BB_SQUEEZE', dir: 'DOWN', score: 7 });
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
  const sl10 = d.slice(-10, -5);
  const upN = sl5.filter(x => x.cl > x.o).length;
  const upP = sl10.filter(x => x.cl > x.o).length;
  const dnN = sl5.filter(x => x.cl < x.o).length;
  if (upP <= 1 && upN >= 3) results.push({ logic: 'MOMENTUM_UP', dir: 'UP', score: 6 });
  if (upP >= 4 && dnN >= 3) results.push({ logic: 'MOMENTUM_DN', dir: 'DOWN', score: 6 });

  // 12. PIN BAR
  if (range > 0) {
    const nose = cur.cl > cur.o ? cur.h - cur.cl : cur.o - cur.h;
    const tail = cur.cl > cur.o ? cur.o - cur.l : cur.cl - cur.l;
    if (tail > body * 3 && tail > nose * 2 && body < range * 0.25) {
      results.push({ logic: 'PIN_BAR', dir: 'UP', score: 8 });
    }
    if (nose > body * 3 && nose > tail * 2 && body < range * 0.25) {
      results.push({ logic: 'PIN_BAR', dir: 'DOWN', score: 8 });
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
