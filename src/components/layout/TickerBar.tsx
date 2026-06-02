'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useStore, formatPair, ALL_PAIRS } from '@/lib/store';
import { fetchPrice } from '@/lib/oanda';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TickerItem {
  pair: string;
  display: string;
  price: number;
  prevPrice: number;
}

function TickerRow({ item }: { item: TickerItem }) {
  const isUp =
    item.price > 0 && item.prevPrice > 0
      ? item.price >= item.prevPrice
      : true;
  const decimals = item.pair.includes('JPY') ? 3 : 5;

  return (
    <div className="flex shrink-0 items-center gap-2 px-4">
      <span className="text-[11px] font-mono tracking-wide text-white/40">
        {item.display}
      </span>
      {item.price > 0 ? (
        <>
          <span
            className={cn(
              'text-[11px] font-mono font-semibold tabular-nums tracking-wide',
              isUp ? 'text-emerald-400' : 'text-rose-500',
            )}
          >
            {item.price.toFixed(decimals)}
          </span>
          <span className={cn(isUp ? 'text-emerald-400/70' : 'text-rose-500/70')}>
            {isUp ? (
              <ChevronUp className="h-2.5 w-2.5" />
            ) : (
              <ChevronDown className="h-2.5 w-2.5" />
            )}
          </span>
        </>
      ) : (
        <span className="text-[11px] font-mono tabular-nums text-white/15">
          ···
        </span>
      )}
    </div>
  );
}

export function TickerBar() {
  const lastPrices = useStore((s) => s.lastPrices);
  const setLastPrice = useStore((s) => s.setLastPrice);
  const prevPricesRef = useRef<Record<string, number>>({});
  const [prevSnapshot, setPrevSnapshot] = useState<Record<string, number>>({});
  const [tick, setTick] = useState(0);

  // Poll prices every 8 seconds
  useEffect(() => {
    let mounted = true;

    async function poll() {
      // Snapshot current prices BEFORE fetching
      prevPricesRef.current = { ...(mounted ? lastPrices : {}) };

      for (const pair of ALL_PAIRS) {
        if (!mounted) break;
        try {
          const price = await fetchPrice(pair);
          if (price > 0 && mounted) {
            setLastPrice(pair, price);
          }
        } catch {
          // skip
        }
      }

      // Set snapshot AFTER fetch completes
      if (mounted) {
        setPrevSnapshot((prev) => ({ ...prev, ...prevPricesRef.current }));
        setTick((t) => t + 1); // force re-render
      }
    }

    poll();
    const interval = setInterval(poll, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setLastPrice, lastPrices, tick]);

  const items: TickerItem[] = useMemo(() => {
    return ALL_PAIRS.map((pair) => ({
      pair,
      display: formatPair(pair),
      price: lastPrices[pair] ?? 0,
      prevPrice: prevSnapshot[pair] ?? 0,
    }));
  }, [lastPrices, prevSnapshot]);

  // Duplicate for seamless loop
  const duplicated = useMemo(() => [...items, ...items], [items]);

  return (
    <div className="relative h-9 overflow-hidden border-b border-white/[0.04] bg-[#050810]/80">
      <div
        className="flex h-full w-max items-center"
        style={{ animation: 'ticker-scroll 120s linear infinite' }}
      >
        {duplicated.map((item, i) => (
          <TickerRow key={`${item.pair}-${i}`} item={item} />
        ))}
      </div>

      {/* Left edge fade */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[#050810] to-transparent" />
      {/* Right edge fade */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[#050810] to-transparent" />
    </div>
  );
}
