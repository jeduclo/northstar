"use client";

import { useEffect, useState } from "react";

/** Shown only if the daily refresh hasn't run for a while (checked in the visitor's browser). */
export default function StaleNotice({ generatedAt, maxDays = 4 }: { generatedAt: string; maxDays?: number }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    setDays(Math.floor((Date.now() - Date.parse(generatedAt)) / 86_400_000));
  }, [generatedAt]);
  if (days === null || days <= maxDays) return null;
  return (
    <p role="status" className="bg-down/10 px-5 py-2 text-center text-sm text-down">
      Data was last refreshed {days} days ago. The daily update may have failed; figures can be out of date.
    </p>
  );
}
