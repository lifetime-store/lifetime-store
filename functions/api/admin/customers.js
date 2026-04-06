import { requireAdmin } from '../../_lib/auth.js';
import { ok, optionsResponse } from '../../_lib/response.js';
import { loyaltyTierFromSpend } from '../../_lib/storefront.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const { results } = await context.env.DB.prepare(`
    SELECT c.id, c.email, c.full_name,
           COALESCE(cp.lifetime_spend, 0) AS lifetime_spend,
           COALESCE(cp.paid_orders, 0) AS paid_orders,
           COALESCE(cp.loyalty_points, 0) AS loyalty_points,
           COALESCE(cp.tier_name, 'Classic') AS tier_name,
           COALESCE(cp.tier_discount_percent, 0) AS tier_discount_percent,
           cp.last_order_at,
           c.created_at
    FROM customers c
    LEFT JOIN customer_profiles cp ON cp.customer_id = c.id
    ORDER BY COALESCE(cp.lifetime_spend, 0) DESC, c.id DESC
    LIMIT 200
  `).all();

  const customers = (results || []).map((row) => {
    const fallback = loyaltyTierFromSpend(row.lifetime_spend, row.paid_orders);
    return {
      ...row,
      tier_name: row.tier_name || fallback.tier,
      tier_discount_percent: Number(row.tier_discount_percent || fallback.discountPercent || 0),
      lifetime_spend: Number(row.lifetime_spend || 0),
      paid_orders: Number(row.paid_orders || 0),
      loyalty_points: Number(row.loyalty_points || 0)
    };
  });

  return ok({ customers });
}
