"use client";

import { useEffect, useState } from "react";

/** Shown only if the daily refresh hasn't run for a while (checked in the visitor's browser). */
export default function StaleNotice({ generatedAt, maxDays = 4 }: { generatedAt: string; maxDays?: number }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setDays(Math.floor((Date.now() - Date.parse(generatedAt)) / 86_400_000)), 0);
    return () => clearTimeout(id);
  }, [generatedAt]);
  if (days === null || days <= maxDays) return null;
  return (
    <p role="status" className="border-b border-warn/20 bg-warn/5 px-5 py-2 text-center text-[13px] text-warn">
      Figures were last updated {days} days ago; a refresh is pending.
    </p>
  );
}
