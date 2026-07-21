import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured } from "./products";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!isStripeConfigured()) return null;
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
  }
  return stripeSingleton;
}

export async function getOrCreateStripeCustomer(input: {
  userId: string;
  email?: string | null;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existing?.stripe_customer_id) return existing.stripe_customer_id as string;

  const customer = await stripe.customers.create({
    email: input.email ?? undefined,
    metadata: { cortaix_user_id: input.userId },
  });

  const { error } = await admin.from("stripe_customers").insert({
    user_id: input.userId,
    stripe_customer_id: customer.id,
  });
  if (error) {
    // Race — fetch again
    const { data: again } = await admin
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", input.userId)
      .maybeSingle();
    if (again?.stripe_customer_id) return again.stripe_customer_id as string;
    throw error;
  }

  return customer.id;
}

export function appBaseUrl(request?: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (request) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }
  return "http://localhost:3000";
}
