/**
 * Extensibility stub for future qualitative tiers (not launch SKUs).
 * Do not add these to getPublicPlans() until product + entitlements are real.
 */
import type { FuturePlanId } from "./products";

export interface FutureTierSpec {
  id: FuturePlanId;
  label: string;
  positioning: string;
  /** Why this is not “more tokens.” */
  differentiator: string;
}

export const FUTURE_TIER_SPECS: FutureTierSpec[] = [
  {
    id: "private",
    label: "Cortaix Private",
    positioning: "Maximum intelligence. Maximum control.",
    differentiator: "Isolation, retention controls, advanced BYOK — not more Frontier.",
  },
  {
    id: "executive",
    label: "Cortaix Executive",
    positioning: "Professional workflows and research",
    differentiator: "Integrations and automation value — not token arbitrage.",
  },
  {
    id: "concierge",
    label: "Cortaix Concierge",
    positioning: "Service and exclusivity",
    differentiator: "Onboarding and support margin — not uncapped Claude.",
  },
  {
    id: "team",
    label: "Cortaix Team",
    positioning: "Shared knowledge for organizations",
    differentiator: "Seats, permissions, shared vaults — different job than Pro.",
  },
];
