"use client";
import { useState } from "react";

type Side = "thala" | "thalapathy";

const SIDES: Record<
  Side,
  { title: string; actor: string; scale: number; face: string; ink: string; glow: string }
> = {
  // Front face (0°) — Thala (Ajith), gold.
  thala: {
    title: "THALA",
    actor: "Ajith",
    scale: 0.165, // short word — big
    face: "radial-gradient(circle at 34% 28%, #fff2c2 0%, #f6cd50 40%, #d99a1a 72%, #a9720c 100%)",
    ink: "#5a3c00",
    glow: "0 0 40px rgba(246, 205, 80, 0.45)",
  },
  // Back face (180°) — Thalapathy (Vijay), neon green.
  thalapathy: {
    title: "THALAPATHY",
    actor: "Vijay",
    scale: 0.108, // long word — sized down so it fits the coin
    face: "radial-gradient(circle at 34% 28%, #e6ffe9 0%, #6bf279 38%, #2BEE34 66%, #0c8f2a 100%)",
    ink: "#08421a",
    glow: "0 0 40px rgba(43, 238, 52, 0.45)",
  },
};

function Face({ side, size, back }: { side: Side; size: number; back?: boolean }) {
  const s = SIDES[side];
  const titleSize = Math.round(size * s.scale);
  return (
    <div
      className={`sg-coin-face${back ? " sg-coin-back" : ""}`}
      style={{ background: s.face, padding: "0 9%" }}
    >
      <span
        className="whitespace-nowrap font-black uppercase leading-none tracking-tight"
        style={{
          color: s.ink,
          fontSize: titleSize,
          textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 -1px 1px rgba(0,0,0,0.25)",
        }}
      >
        {s.title}
      </span>
      <span
        className="mt-1.5 font-semibold uppercase"
        style={{ color: s.ink, fontSize: Math.round(size * 0.052), letterSpacing: "0.18em", opacity: 0.85 }}
      >
        {s.actor}
      </span>
      <span className="mt-1.5 text-base" style={{ opacity: 0.7 }}>★</span>
      <span className="sg-coin-shine" />
    </div>
  );
}

/**
 * Tap-to-flip "Thala or Thalapathy" coin — purely for fun, flip as often as you
 * like. Front (0°) lands on Thala, back (180°) on Thalapathy.
 */
export function CoinToss({ size = 180 }: { size?: number }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Side | null>(null);

  function flip() {
    if (spinning) return;
    const isThala = Math.random() < 0.5;
    const spins = 4 + Math.floor(Math.random() * 4); // 4–7 full flips
    const target = isThala ? 0 : 180;
    const current = ((rotation % 360) + 360) % 360;
    const delta = spins * 360 + (((target - current) % 360) + 360) % 360;
    setSpinning(true);
    setResult(null);
    setRotation((r) => r + delta);
    setTimeout(() => {
      setResult(isThala ? "thala" : "thalapathy");
      setSpinning(false);
    }, 1650);
  }

  const res = result ? SIDES[result] : null;

  return (
    <div className="flex flex-col items-center">
      <div className="sg-coin-scene" style={{ width: size, height: size }}>
        <div className={`sg-coin-lift${spinning ? " is-spinning" : ""}`}>
          <button
            type="button"
            aria-label="Flip the coin"
            onClick={flip}
            className="sg-coin"
            style={{ width: size, height: size, transform: `rotateX(${rotation}deg)` }}
          >
            <Face side="thala" size={size} />
            <Face side="thalapathy" size={size} back />
          </button>
        </div>
      </div>

      <div className="mt-3.5 flex h-8 items-center justify-center text-center">
        {spinning ? (
          <p className="animate-pulse font-display text-base font-bold text-ink-soft">Flipping…</p>
        ) : res ? (
          <p
            className="font-display text-2xl font-black uppercase tracking-tight"
            style={{ color: result === "thala" ? "#f6cd50" : "#2BEE34", textShadow: res.glow }}
          >
            {res.title}!
          </p>
        ) : (
          <p className="font-display text-base font-semibold text-ink-soft">Tap to toss</p>
        )}
      </div>
    </div>
  );
}
