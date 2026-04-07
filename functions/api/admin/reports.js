import { requireAdmin } from '../../_lib/auth.js';
import { ok, optionsResponse } from '../../_lib/response.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const [summary, topProducts, tiers] = await Promise.all([
    context.env.DB.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS revenue_ngn,
      COALESCE(COUNT(CASE WHEN status = 'paid' THEN 1 END), 0) AS paid_orders,
      (SELECT COUNT(*) FROM variants WHERE active = 1 AND stock <= 5) AS low_stock_variants,
      (SELECT COUNT(*) FROM issues WHERE status = 'open') AS open_issues,
      (SELECT COUNT(*) FROM delivery_fee_requests WHERE status IN ('requested','pending')) AS pending_delivery_fees,
      (SELECT COUNT(*) FROM restock_requests WHERE status = 'open') AS restock_requests,
      (SELECT COUNT(*) FROM newsletter_subscribers WHERE status = 'active') AS newsletter_subscribers
      FROM orders`).first(),
    context.env.DB.prepare(`SELECT oi.product_name, SUM(oi.quantity) AS units_sold FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status = 'paid' GROUP BY oi.product_name ORDER BY units_sold DESC, oi.product_name ASC LIMIT 8`).all(),
    context.env.DB.prepare(`SELECT tier_name, COUNT(*) AS total, COALESCE(MAX(tier_discount_percent),0) AS discount FROM customer_profiles GROUP BY tier_name ORDER BY MAX(tier_discount_percent) DESC, tier_name ASC`).all(),
  ]);
  return ok({ summary, topProducts: topProducts.results || [], tiers: tiers.results || [] });
}
