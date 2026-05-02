import { useState, useCallback } from "react";

const KEY_PREFIX = "finvision360_last_updated_";

export function useLastUpdated(pageKey: string) {
  const storageKey = `${KEY_PREFIX}${pageKey}`;

  const [lastUpdated, setLastUpdated] = useState<string | null>(() => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  });

  const markUpdated = useCallback(() => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(storageKey, now);
    } catch {
      // ignore storage errors
    }
    setLastUpdated(now);
  }, [storageKey]);

  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not yet updated";

  return { formattedDate, markUpdated };
}
