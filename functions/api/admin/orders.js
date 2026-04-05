import { requireAdmin } from "../../_lib/auth.js";
import { error, ok, optionsResponse } from "../../_lib/response.js";
import { readJson, toInt } from "../../_lib/parse.js";

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
  const id = toInt(body.id);
  const status = String(body.status || '').trim();
  if (!id || !status) return error('id and status are required.', 400);

  await context.env.DB.prepare(`UPDATE orders SET status = ? WHERE id = ?`).bind(status, id).run();
  return ok({ message: 'Order status updated.' });
}
