
import { useState, useEffect, useCallback } from "react";

// ─── Breakpoints ──────────────────────────────────────────────────────────────
// Mirror Tailwind's default screen breakpoints so hook values align
// with the CSS classes used throughout the app.

export const BREAKPOINTS = {
  sm:  640,
  md:  768,
  lg:  1024,
  xl:  1280,
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// ─── Core hook ────────────────────────────────────────────────────────────────

/**
 * Returns `true` when the viewport is narrower than the given breakpoint.
 * SSR-safe: returns `false` on the server and during the first render
 * to prevent hydration mismatches.
 *
 * @param breakpoint - Tailwind breakpoint name. Defaults to "md" (768px).
 *
 * @example
 * const isMobile  = useIsMobile();          // < 768px
 * const isTablet  = useIsMobile("lg");      // < 1024px
 * const isSmall   = useIsMobile("sm");      // < 640px
 */
export function useIsMobile(breakpoint: Breakpoint = "md"): boolean {
  const maxWidth = BREAKPOINTS[breakpoint];

  const getMatch = useCallback(
    () => typeof window !== "undefined" && window.innerWidth < maxWidth,
    [maxWidth]
  );

  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    // Set the correct value as soon as the component mounts client-side
    setMatches(getMatch());

    const mql      = window.matchMedia(`(max-width: ${maxWidth - 1}px)`);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [maxWidth, getMatch]);

  return matches;
}

// ─── Convenience aliases ──────────────────────────────────────────────────────

/** Viewport is below the `sm` breakpoint (< 640px). */
export const useIsSmallMobile = () => useIsMobile("sm");

/** Viewport is below the `lg` breakpoint (< 1024px) — includes tablets. */
export const useIsTablet = () => useIsMobile("lg");

// ─── Full breakpoint map ──────────────────────────────────────────────────────

/**
 * Returns the current active Tailwind breakpoint label.
 * Useful for responsive logic that needs more than a boolean.
 *
 * @example
 * const bp = useBreakpoint();
 * // bp === "sm" | "md" | "lg" | "xl" | "2xl" | "xs"
 */
export function useBreakpoint(): Breakpoint | "xs" {
  const getBreakpoint = useCallback((): Breakpoint | "xs" => {
    if (typeof window === "undefined") return "xs";
    const w = window.innerWidth;
    if (w >= BREAKPOINTS["2xl"]) return "2xl";
    if (w >= BREAKPOINTS.xl)    return "xl";
    if (w >= BREAKPOINTS.lg)    return "lg";
    if (w >= BREAKPOINTS.md)    return "md";
    if (w >= BREAKPOINTS.sm)    return "sm";
    return "xs";
  }, []);

  const [bp, setBp] = useState<Breakpoint | "xs">("xs");

  useEffect(() => {
    setBp(getBreakpoint());

    const onResize = () => setBp(getBreakpoint());
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [getBreakpoint]);

  return bp;
}
