
import { getCustomerFromRequest } from '../../_lib/customer-auth.js';
import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const customer = await getCustomerFromRequest(context.request, context.env);
  if (!customer) return ok({ items: [] });
  const { results } = await context.env.DB.prepare(`
    SELECT w.id, w.item_key, w.product_id, w.variant_id, w.created_at,
           p.name AS product_name, p.slug, p.category,
           COALESCE(v.color, '') AS color, COALESCE(v.size, '') AS size,
           COALESCE(v.price_ngn, p.price_ngn) AS price_ngn,
           COALESCE(v.price_usd, p.price_usd) AS price_usd,
           (
             SELECT data_url FROM product_images pi
             WHERE pi.product_id = p.id
             ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
             LIMIT 1
           ) AS primary_image_url
    FROM wishlist_items w
    JOIN products p ON p.id = w.product_id
    LEFT JOIN variants v ON v.id = w.variant_id
    WHERE w.customer_id = ?
    ORDER BY w.id DESC
  `).bind(customer.id).all();
  return ok({ items: results || [] });
}

export async function onRequestPost(context) {
  const customer = await getCustomerFromRequest(context.request, context.env);
  if (!customer) return error('Sign in is required for wishlist.', 401);
  const body = await readJson(context.request);
  const { item_key, product_id, variant_id = null } = body;
  if (!item_key || !product_id) return error('item_key and product_id are required.', 400);
  await context.env.DB.prepare(`
    INSERT INTO wishlist_items (customer_id, item_key, product_id, variant_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(customer_id, item_key) DO NOTHING
  `).bind(customer.id, item_key, product_id, variant_id).run();
  return ok({ message: 'Saved to wishlist.' });
}

export async function onRequestDelete(context) {
  const customer = await getCustomerFromRequest(context.request, context.env);
  if (!customer) return error('Sign in is required for wishlist.', 401);
  const body = await readJson(context.request);
  await context.env.DB.prepare(`DELETE FROM wishlist_items WHERE customer_id = ? AND item_key = ?`).bind(customer.id, body.item_key || '').run();
  return ok({ message: 'Removed from wishlist.' });
}
