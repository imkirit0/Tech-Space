"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type LedTone = "red" | "amber" | "white";

const TONE: Record<LedTone, string> = {
  red: "text-led-red [text-shadow:0_0_12px_rgb(255_59_46/0.55)]",
  amber: "text-led-amber [text-shadow:0_0_12px_rgb(255_182_46/0.5)]",
  white: "text-led-white [text-shadow:0_0_10px_rgb(243_247_252/0.35)]",
};

/**
 * A token-board readout: fixed digit positions with the unlit "8"s showing
 * behind, so a count never shifts the layout and every position is visible.
 */
export function Led({
  value,
  digits = 3,
  tone = "white",
  className,
}: {
  value: string | number;
  digits?: number;
  tone?: LedTone;
  className?: string;
}) {
  const text = String(value).padStart(digits, " ");
  const ghost = text.replace(/[^.:]/g, "8");

  // Flare once when the number changes after first paint.
  const prev = useRef(text);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (prev.current !== text) {
      prev.current = text;
      setStep((s) => s + 1);
    }
  }, [text]);

  return (
    <span
      className={cn("relative inline-block font-led leading-none font-black whitespace-pre", className)}
      aria-label={String(value)}
      role="img"
    >
      <span className="text-led-off" aria-hidden>
        {ghost}
      </span>
      <span key={step} className={cn("absolute inset-0", TONE[tone], step > 0 && "led-step")} aria-hidden>
        {text}
      </span>
    </span>
  );
}
