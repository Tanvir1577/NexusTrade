import { ALL_PAIRS, formatPair, isJPYPair, type PairName } from '@/lib/store';

export function fetchCandles(pair: string, count: number = 60, granularity: string = 'M1') {
  return fetch(`/api/oanda?pair=${pair}&count=${count}&granularity=${granularity}`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((d) => d.candles || [])
    .catch(() => []);
}

export async function fetchPrice(pair: string): Promise<number> {
  const candles = await fetchCandles(pair, 2, 'M1');
  if (candles.length === 0) return 0;
  return parseFloat(candles[candles.length - 1]?.mid?.c || '0');
}

export function formatPrice(price: number, pair?: string): string {
  if (!pair) {
    return price >= 10 ? price.toFixed(3) : price.toFixed(5);
  }
  return isJPYPair(pair) ? price.toFixed(3) : price.toFixed(5);
}

export const PAIR_DISPLAY: { name: PairName; display: string; group: string }[] = ALL_PAIRS.map(
  (p) => ({
    name: p,
    display: formatPair(p),
    group: p.split('_')[0],
  })
);

export const PAIR_GROUPS = [
  { label: 'EUR', pairs: ALL_PAIRS.filter((p) => p.startsWith('EUR')) },
  { label: 'GBP', pairs: ALL_PAIRS.filter((p) => p.startsWith('GBP')) },
  { label: 'AUD', pairs: ALL_PAIRS.filter((p) => p.startsWith('AUD')) },
  { label: 'USD', pairs: ALL_PAIRS.filter((p) => p.startsWith('USD') && p !== 'USD_JPY') },
  { label: 'Cross', pairs: ['USD_JPY', 'CAD_JPY', 'CHF_JPY'] },
];
