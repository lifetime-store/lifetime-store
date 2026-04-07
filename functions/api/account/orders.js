import { ok, error, optionsResponse } from '../../_lib/response.js';
import { getCustomerBySession } from '../../_lib/customer-auth.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const customer = await getCustomerBySession(context.env, context.request);
  if (!customer) return error('Sign in to view your orders.', 401);
  const { results } = await context.env.DB.prepare(`
    SELECT o.id, o.order_number, o.status, o.total, o.currency, o.created_at,
           d.tracking_number, d.status AS delivery_status, d.courier_name, d.eta_text
    FROM orders o
    LEFT JOIN deliveries d ON d.order_id = o.id
    WHERE o.customer_id = ?
    ORDER BY o.id DESC
    LIMIT 100
  `).bind(customer.id).all();
  return ok({ orders: results || [] });
}
