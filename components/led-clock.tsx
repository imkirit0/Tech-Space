"use client";

import { useEffect, useState } from "react";
import { Led } from "@/components/led";

const IST = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Live IST wall clock for the sign-in board. Renders blank until mounted to avoid a hydration mismatch. */
export function LedClock({ className }: { className?: string }) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(IST.format(new Date()));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);
  return <Led value={now ?? "  :  "} digits={5} tone="red" className={className} />;
}
