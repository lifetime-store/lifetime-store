import { requireAdmin } from '../../_lib/auth.js';
import { error, ok, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const reviews = await context.env.DB.prepare(`SELECT r.*, p.name AS product_name, c.email AS customer_email FROM product_reviews r JOIN products p ON p.id = r.product_id JOIN customers c ON c.id = r.customer_id ORDER BY r.created_at DESC LIMIT 200`).all();
  const discussions = await context.env.DB.prepare(`SELECT d.*, p.name AS product_name FROM product_discussions d JOIN products p ON p.id = d.product_id ORDER BY d.created_at DESC LIMIT 200`).all();
  return ok({ reviews: reviews.results || [], discussions: discussions.results || [] });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const body = await readJson(context.request);
  const table = body.kind === 'discussion' ? 'product_discussions' : 'product_reviews';
  const id = Number(body.id || 0);
  const status = String(body.status || '').trim();
  if (!id || !status) return error('id and status are required.', 400);
  await context.env.DB.prepare(`UPDATE ${table} SET status = ? WHERE id = ?`).bind(status, id).run();
  return ok({ message: 'Status updated.' });
}
