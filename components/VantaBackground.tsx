"use client";

import { cssColorToInt } from "@/lib/cssColorToInt";
import { useCallback, useEffect, useRef } from "react";
import type { VantaNetInstance } from "vanta/dist/vanta.net.min";

const VANTA_NET = {
  backgroundAlpha: 0,
  gyroControls: false,
  maxDistance: 20,
  minHeight: 200,
  minWidth: 200,
  mouseControls: true,
  points: 10,
  scale: 1,
  scaleMobile: 1,
  showDots: true,
  spacing: 15,
  touchControls: true,
} as const;

function vantaColors() {
  const styles = getComputedStyle(document.documentElement);

  return {
    backgroundColor: cssColorToInt(styles.getPropertyValue("--background")),
    color: cssColorToInt(styles.getPropertyValue("--vanta-net")),
  };
}

export function VantaBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<VantaNetInstance | null>(null);

  const mountEffect = useCallback(async () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const container = containerRef.current;
    if (!container) return;

    const [THREE, NET] = await Promise.all([
      import("three"),
      import("vanta/dist/vanta.net.min"),
    ]);

    if (!containerRef.current) return;

    effectRef.current?.destroy();
    effectRef.current = NET.default({
      el: containerRef.current,
      THREE,
      ...VANTA_NET,
      ...vantaColors(),
    });
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;

    void mountEffect();

    const onThemeChange = () => {
      if (cancelled) return;
      void mountEffect();
    };

    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("resize", onThemeChange);

    return () => {
      cancelled = true;
      themeObserver.disconnect();
      window.removeEventListener("resize", onThemeChange);
      effectRef.current?.destroy();
      effectRef.current = null;
    };
  }, [mountEffect]);

  return (
    <>
      <div
        ref={containerRef}
        aria-hidden
        className="vanta-canvas pointer-events-none fixed inset-0 -z-10 h-full w-full"
        style={{ opacity: "var(--vanta-layer-opacity)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-[9] bg-background"
        style={{ opacity: "var(--vanta-scrim-opacity)" }}
      />
    </>
  );
}
