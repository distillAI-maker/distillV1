'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * While someone is waiting on their email link: when they come back to this tab (often after the
 * link signed them in, in another tab), the page asks the server again, so it picks up the sign-in.
 */
export function useRefreshOnReturn(active: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const back = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    return () => {
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('focus', back);
    };
  }, [active, router]);
}
