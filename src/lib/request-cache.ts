import * as React from "react";

/**
 * React `cache()` when available (App Router RSC requests); identity fallback
 * for Vitest / non-RSC contexts so server helpers remain importable in tests.
 */
type AnyFn = (...args: never[]) => unknown;

function resolveReactCache(): <T extends AnyFn>(fn: T) => T {
  const candidate = (React as { cache?: <T extends AnyFn>(fn: T) => T }).cache;
  if (typeof candidate === "function") return candidate;
  return <T extends AnyFn>(fn: T) => fn;
}

export const requestCache = resolveReactCache();
