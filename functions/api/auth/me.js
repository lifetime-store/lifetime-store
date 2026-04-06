import { ok, error, optionsResponse } from '../../_lib/response.js';
import { getCustomerBySession } from '../../_lib/customer-auth.js';
import { ensureCustomerProfile, loyaltyTierFromSpend } from '../../_lib/storefront.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return onRequestOptions();
  if (context.request.method !== 'GET') return error('Method not allowed.', 405);
  try {
    const customer = await getCustomerBySession(context.env, context.request);
    if (!customer) return ok({ authenticated: false, customer: null });

    const profile = await ensureCustomerProfile(context.env, customer.id);
    const fallback = loyaltyTierFromSpend(profile?.lifetime_spend || 0, profile?.paid_orders || 0);

    return ok({
      authenticated: true,
      customer: {
        id: customer.id,
        email: customer.email,
        full_name: customer.full_name || '',
        tier_name: profile?.tier_name || fallback.tier,
        tier_discount_percent: Number(profile?.tier_discount_percent || fallback.discountPercent || 0),
        loyalty_points: Number(profile?.loyalty_points || 0),
        lifetime_spend: Number(profile?.lifetime_spend || 0),
        paid_orders: Number(profile?.paid_orders || 0)
      }
    });
  } catch (err) {
    return error(err?.message || 'Could not load account.', 500);
  }
}
