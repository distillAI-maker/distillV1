'use client';

import { useEffect, useState } from 'react';
import { NOT_COUNTED_KEY } from '../../lib/track';

/** Our own phones and laptops leave the numbers alone: one tap, kept on this device. */
export function CountToggle() {
  const [counted, setCounted] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setCounted(localStorage.getItem(NOT_COUNTED_KEY) !== 'off');
    } catch {
      setCounted(null);
    }
  }, []);
  if (counted === null) return null;
  const flip = () => {
    try {
      if (counted) localStorage.setItem(NOT_COUNTED_KEY, 'off');
      else localStorage.removeItem(NOT_COUNTED_KEY);
      setCounted(!counted);
    } catch {
      // Storage blocked: nothing to change.
    }
  };
  return (
    <p className="tm-count">
      {counted ? 'This device is counted.' : "This device isn't counted."}{' '}
      <button type="button" className="tm-link" onClick={flip}>
        {counted ? "Don't count this device" : 'Count it again'}
      </button>
    </p>
  );
}
