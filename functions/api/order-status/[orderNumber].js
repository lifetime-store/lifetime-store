
import { ok, error, optionsResponse } from '../../_lib/response.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const orderNumber = context.params.orderNumber;
  const email = new URL(context.request.url).searchParams.get('email');
  if (!orderNumber || !email) return error('order number and email are required.', 400);
  const order = await context.env.DB.prepare(`
    SELECT id, order_number, customer_name, email, status, total, currency, created_at, promo_code, promo_discount, tier_discount
    FROM orders WHERE order_number = ? AND lower(email) = lower(?) LIMIT 1
  `).bind(orderNumber, email).first();
  if (!order) return error('Order not found.', 404);
  const { results } = await context.env.DB.prepare(`
    SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC
  `).bind(order.id).all();
  return ok({ order, history: results || [] });
}
