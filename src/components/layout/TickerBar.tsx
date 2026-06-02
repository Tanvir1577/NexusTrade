'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
  const isUp = item.price > 0 && item.prevPrice > 0 ? item.price >= item.prevPrice : true;
  const decimals = item.pair.includes('JPY') ? 3 : 5;

  return (
    <div className="flex shrink-0 items-center gap-1.5 px-3">
      <span className="text-[11px] font-mono text-muted-foreground/50">{item.display}</span>
      <span
        className={cn(
          'text-[11px] font-mono font-semibold tabular-nums',
          isUp ? 'text-emerald-400' : 'text-red-400'
        )}
      >
        {item.price > 0 ? item.price.toFixed(decimals) : '—'.repeat(decimals + 1)}
      </span>
      {item.price > 0 && (
        <span className={cn(isUp ? 'text-emerald-400' : 'text-red-400')}>
          {isUp ? (
            <ChevronUp className="h-2.5 w-2.5" />
          ) : (
            <ChevronDown className="h-2.5 w-2.5" />
          )}
        </span>
      )}
    </div>
  );
}

export function TickerBar() {
  const lastPrices = useStore((s) => s.lastPrices);
  const setLastPrice = useStore((s) => s.setLastPrice);
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});

  // Poll prices every 5 seconds
  useEffect(() => {
    let mounted = true;

    async function poll() {
      for (const pair of ALL_PAIRS) {
        if (!mounted) break;
        try {
          const price = await fetchPrice(pair);
          if (price > 0 && mounted) {
            setLastPrice(pair, price);
            setPrevPrices((prev) => ({ ...prev, [pair]: price }));
          }
        } catch {
          // skip failed pair
        }
      }
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setLastPrice]);

  const items: TickerItem[] = useMemo(() => {
    return ALL_PAIRS.map((pair) => ({
      pair,
      display: formatPair(pair),
      price: lastPrices[pair] ?? 0,
      prevPrice: prevPrices[pair] ?? 0,
    }));
  }, [lastPrices, prevPrices]);

  // Duplicate for seamless loop
  const duplicated = useMemo(() => [...items, ...items], [items]);

  return (
    <div className="relative overflow-hidden border-b border-white/[0.06] bg-[#060a13]/80">
      <div className="flex h-8 w-max items-center animate-ticker">
        {duplicated.map((item, i) => (
          <TickerRow key={`${item.pair}-${i}`} item={item} />
        ))}
      </div>
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#060a13] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#060a13] to-transparent" />
    </div>
  );
}
