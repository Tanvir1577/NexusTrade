// ══════════════════════════════════════════════════════════════════════
// HUNTER X QUANTEX — Signal Engine
// Ported from original HXQ source code
// 12 Pattern Detectors + Simple Score-Based Consensus
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
// 12 PATTERN DETECTORS — from original HXQ source
// ══════════════════════════════════════════════════════════════════════

// Helper: EMA calculation
function emaCalc(arr: number[], period: number): number {
  const k = 2 / (period + 1);
  let e = arr[0];
  for (let i = 1; i < arr.length; i++) {
    e = arr[i] * k + e * (1 - k);
  }
  return e;
}

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

  // ──────────────────────────────────────────────────────────
  // 1. ENGULFING (score 8)
  // ──────────────────────────────────────────────────────────
  (() => {
    const prev = c[c.length - 2], cur = c[c.length - 1];
    const bP = Math.abs(prev.cl - prev.o);
    const bC = Math.abs(cur.cl - cur.o);
    if (prev.cl < prev.o && cur.cl > cur.o && bC > bP * 1.2 && cur.o <= prev.cl && cur.cl >= prev.o) {
      res.push({ logic: 'ENGULFING', dir: 'UP', score: 8 });
    }
    if (prev.cl > prev.o && cur.cl < cur.o && bC > bP * 1.2 && cur.o >= prev.cl && cur.cl <= prev.o) {
      res.push({ logic: 'ENGULFING', dir: 'DOWN', score: 8 });
    }
  })();

  // ──────────────────────────────────────────────────────────
  // 2. HAMMER (score 7)
  // ──────────────────────────────────────────────────────────
  (() => {
    const cur = c[c.length - 1];
    const body = Math.abs(cur.cl - cur.o);
    const range = cur.h - cur.l;
    const upper = cur.h - Math.max(cur.cl, cur.o);
    const lower = Math.min(cur.cl, cur.o) - cur.l;
    if (lower > body * 2.5 && lower > upper * 2 && body < range * 0.3) {
      res.push({ logic: 'HAMMER', dir: 'UP', score: 7 });
    }
    if (upper > body * 2.5 && upper > lower * 2 && body < range * 0.3) {
      res.push({ logic: 'SHOOTING_STAR', dir: 'DOWN', score: 7 });
    }
  })();

  // ──────────────────────────────────────────────────────────
  // 3. DOJI REVERSAL (score 6)
  // ──────────────────────────────────────────────────────────
  (() => {
    const cur = c[c.length - 1];
    const body = Math.abs(cur.cl - cur.o);
    const range = cur.h - cur.l || 0.0001;
    if (body / range < 0.1) {
      const trend = cur.cl - c[c.length - 6].cl;
      if (trend < 0) res.push({ logic: 'DOJI_REVERSAL', dir: 'UP', score: 6 });
      if (trend > 0) res.push({ logic: 'DOJI_REVERSAL', dir: 'DOWN', score: 6 });
    }
  })();

  // ──────────────────────────────────────────────────────────
  // 4. EMA CROSS (score 7) — 5/13 EMA crossover
  // ──────────────────────────────────────────────────────────
  (() => {
    const ema = (arr: { cl: number }[], p: number) => {
      const k = 2 / (p + 1);
      let e = arr[0].cl;
      arr.forEach(x => e = x.cl * k + e * (1 - k));
      return e;
    };
    const eF = ema(c.slice(-5), 5);
    const eS = ema(c.slice(-13), 13);
    const eFp = ema(c.slice(-6, -1).slice(-5), 5);
    const eSp = ema(c.slice(-14, -1).slice(-13), 13);
    if (eFp < eSp && eF > eS) res.push({ logic: 'EMA_CROSS', dir: 'UP', score: 7 });
    if (eFp > eSp && eF < eS) res.push({ logic: 'EMA_CROSS', dir: 'DOWN', score: 7 });
  })();

  // ──────────────────────────────────────────────────────────
  // 5. BREAKOUT (score 7) — 20-bar high/low break
  // ──────────────────────────────────────────────────────────
  (() => {
    const r20 = c.slice(-22, -2);
    const hi = Math.max(...r20.map(x => x.h));
    const lo = Math.min(...r20.map(x => x.l));
    const cur = c[c.length - 1];
    if (cur.cl > hi * 1.0002) res.push({ logic: 'BREAKOUT', dir: 'UP', score: 7 });
    if (cur.cl < lo * 0.9998) res.push({ logic: 'BREAKOUT', dir: 'DOWN', score: 7 });
  })();

  // ──────────────────────────────────────────────────────────
  // 6. SUPPORT BOUNCE / RESISTANCE REJECT (score 8)
  // ──────────────────────────────────────────────────────────
  (() => {
    const r30 = c.slice(-30);
    const rs = [...r30.map(x => x.h)].sort((a, b) => b - a)[2];
    const sup = [...r30.map(x => x.l)].sort((a, b) => a - b)[2];
    const cur = c[c.length - 1];
    const prev = c[c.length - 2];
    if (prev.cl <= sup * 1.001 && cur.cl > sup * 1.001) {
      res.push({ logic: 'SUPPORT_BOUNCE', dir: 'UP', score: 8 });
    }
    if (prev.cl >= rs * 0.999 && cur.cl < rs * 0.999) {
      res.push({ logic: 'RESIST_REJECT', dir: 'DOWN', score: 8 });
    }
  })();

  // ──────────────────────────────────────────────────────────
  // 7. RSI OVERSOLD / OVERBOUGHT (score 7)
  // ──────────────────────────────────────────────────────────
  (() => {
    const cls = c.slice(-15).map(x => x.cl);
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = 1; i < cls.length; i++) {
      const d = cls[i] - cls[i - 1];
      gains.push(d > 0 ? d : 0);
      losses.push(d < 0 ? -d : 0);
    }
    const aG = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const aL = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const rsi = aL === 0 ? 100 : 100 - (100 / (1 + (aG / aL)));
    if (rsi < 28) res.push({ logic: 'RSI_OVERSOLD', dir: 'UP', score: 7 });
    if (rsi > 72) res.push({ logic: 'RSI_OVERBOUGHT', dir: 'DOWN', score: 7 });
  })();

  // ──────────────────────────────────────────────────────────
  // 8. MACD CROSS (score 7)
  // ──────────────────────────────────────────────────────────
  (() => {
    const ef = (arr: number[], p: number) => {
      const k = 2 / (p + 1);
      let e = arr[0];
      arr.slice(1).forEach(v => e = v * k + e * (1 - k));
      return e;
    };
    const cls = c.slice(-30).map(x => x.cl);
    const m = ef(cls.slice(-12), 12) - ef(cls.slice(-26), 26);
    const mp = ef(cls.slice(-13, -1).slice(-12), 12) - ef(cls.slice(-27, -1).slice(-26), 26);
    if (mp < 0 && m > 0) res.push({ logic: 'MACD_CROSS', dir: 'UP', score: 7 });
    if (mp > 0 && m < 0) res.push({ logic: 'MACD_CROSS', dir: 'DOWN', score: 7 });
  })();

  // ──────────────────────────────────────────────────────────
  // 9. BOLLINGER SQUEEZE (score 7)
  // ──────────────────────────────────────────────────────────
  (() => {
    const cls = c.slice(-22).map(x => x.cl);
    const sma = cls.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sd = Math.sqrt(cls.slice(-20).map(x => (x - sma) ** 2).reduce((a, b) => a + b, 0) / 20);
    const bw = (sd * 4) / sma;

    const cls2 = c.slice(-28, -6).map(x => x.cl);
    const sma2 = cls2.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sd2 = Math.sqrt(cls2.slice(-20).map(x => (x - sma2) ** 2).reduce((a, b) => a + b, 0) / 20);
    const bw2 = (sd2 * 4) / sma2;
    const cur = c[c.length - 1];

    if (bw2 > bw * 1.3 && cur.cl > sma) res.push({ logic: 'BB_SQUEEZE', dir: 'UP', score: 7 });
    if (bw2 > bw * 1.3 && cur.cl < sma) res.push({ logic: 'BB_SQUEEZE', dir: 'DOWN', score: 7 });
  })();

  // ──────────────────────────────────────────────────────────
  // 10. INSIDE BAR (score 6)
  // ──────────────────────────────────────────────────────────
  (() => {
    const prev = c[c.length - 2];
    const cur = c[c.length - 1];
    if (cur.h < prev.h && cur.l > prev.l) {
      const trend = prev.cl - c[c.length - 5].cl;
      if (trend > 0) res.push({ logic: 'INSIDE_BAR', dir: 'DOWN', score: 6 });
      if (trend < 0) res.push({ logic: 'INSIDE_BAR', dir: 'UP', score: 6 });
    }
  })();

  // ──────────────────────────────────────────────────────────
  // 11. MOMENTUM UP / DOWN (score 6)
  // ──────────────────────────────────────────────────────────
  (() => {
    const sl = c.slice(-5);
    const sl2 = c.slice(-10, -5);
    const uN = sl.filter(x => x.cl > x.o).length;
    const uP = sl2.filter(x => x.cl > x.o).length;
    const dN = sl.filter(x => x.cl < x.o).length;
    if (uP <= 1 && uN >= 3) res.push({ logic: 'MOMENTUM_UP', dir: 'UP', score: 6 });
    if (uP >= 4 && dN >= 3) res.push({ logic: 'MOMENTUM_DN', dir: 'DOWN', score: 6 });
  })();

  // ──────────────────────────────────────────────────────────
  // 12. PIN BAR (score 8)
  // ──────────────────────────────────────────────────────────
  (() => {
    const cur = c[c.length - 1];
    const body = Math.abs(cur.cl - cur.o);
    const range = cur.h - cur.l || 0.0001;
    const nose = cur.cl > cur.o ? cur.h - cur.cl : cur.o - cur.h;
    const tail = cur.cl > cur.o ? cur.o - cur.l : cur.cl - cur.l;
    if (tail > body * 3 && tail > nose * 2 && body < range * 0.25) {
      res.push({ logic: 'PIN_BAR', dir: 'UP', score: 8 });
    }
    if (nose > body * 3 && nose > tail * 2 && body < range * 0.25) {
      res.push({ logic: 'PIN_BAR', dir: 'DOWN', score: 8 });
    }
  })();

  // ══════════════════════════════════════════════════════════
  // CONSENSUS — Simple score-based (from original HXQ)
  // ══════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════
// TIMING — from original HXQ
// ══════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════
// RESULT CHECK — from original HXQ
// ══════════════════════════════════════════════════════════

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
