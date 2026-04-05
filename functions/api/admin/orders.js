import { requireAdmin } from "../../_lib/auth.js";
import { error, ok, optionsResponse } from "../../_lib/response.js";
import { readJson, toInt } from "../../_lib/parse.js";
import { sendOrderAlerts } from "../../_lib/mail.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const { results } = await context.env.DB.prepare(`
    SELECT
      o.*,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM orders o
    ORDER BY o.created_at DESC
    LIMIT 200
  `).all();

  return ok({ orders: results || [] });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;
  const body = await readJson(context.request);
  const id = toInt(body.id || body.order_id);
  const status = String(body.status || '').trim();
  if (!id || !status) return error('id and status are required.', 400);

  const order = await context.env.DB.prepare(`SELECT * FROM orders WHERE id = ? LIMIT 1`).bind(id).first();
  if (!order) return error('Order not found.', 404);

  await context.env.DB.prepare(`UPDATE orders SET status = ? WHERE id = ?`).bind(status, id).run();

  if (order.email && ['processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
    const { results } = await context.env.DB.prepare(`
      SELECT product_name, color, size, quantity
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
    `).bind(id).all();
    try {
      await sendOrderAlerts(context.env, { ...order, status }, results || [], `Order status updated to ${status}`);
    } catch (mailError) {
      console.error('Order status email failed', mailError);
    }
  }

  return ok({ message: 'Order status updated.' });
}
