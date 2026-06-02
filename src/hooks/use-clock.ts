'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';

export function useClock() {
  const [utc, setUtc] = useState('');
  const [local, setLocal] = useState('');
  const [fullLocal, setFullLocal] = useState('');
  const tzTime = useStore((s) => s.tzTime);
  const tzLabel = useStore((s) => s.tzLabel);

  useEffect(() => {
    function tick() {
      const now = new Date();
      setUtc(
        `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`
      );
      const localTime = tzTime(now);
      setLocal(localTime);
      setFullLocal(`${localTime}:${String(now.getUTCSeconds()).padStart(2, '0')} ${tzLabel()}`);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [tzTime, tzLabel]);

  return { utc, local, fullLocal };
}
