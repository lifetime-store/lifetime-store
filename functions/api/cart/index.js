import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson, toInt } from '../../_lib/parse.js';
import { requireCustomer } from '../../_lib/customer-auth.js';

async function fetchCart(env, customerId) {
  const { results } = await env.DB.prepare(`
    SELECT item_key AS key, product_id, variant_id, product_name, slug, sku, color, size, quantity, unit_price, currency, stock
    FROM cart_items
    WHERE customer_id = ?
    ORDER BY id ASC
  `).bind(customerId).all();
  return results || [];
}

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const { response, customer } = await requireCustomer(context);
  if (response) return response;
  return ok({ items: await fetchCart(context.env, customer.id) });
}

export async function onRequestPost(context) {
  const { response, customer } = await requireCustomer(context);
  if (response) return response;

  const body = await readJson(context.request);
  const items = Array.isArray(body.items) ? body.items : (body.item ? [body.item] : []);
  if (items.length === 0) return error('Cart items are required.', 400);

  for (const item of items) {
    const quantity = Math.max(1, toInt(item.quantity, 1));
    await context.env.DB.prepare(`
      INSERT INTO cart_items (
        customer_id, item_key, product_id, variant_id, product_name, slug, sku, color, size, quantity, unit_price, currency, stock, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(customer_id, item_key) DO UPDATE SET
        product_id = excluded.product_id,
        variant_id = excluded.variant_id,
        product_name = excluded.product_name,
        slug = excluded.slug,
        sku = excluded.sku,
        color = excluded.color,
        size = excluded.size,
        quantity = excluded.quantity,
        unit_price = excluded.unit_price,
        currency = excluded.currency,
        stock = excluded.stock,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      customer.id,
      String(item.key || `${item.slug || item.product_id}:${item.variant_id || 'default'}`),
      item.product_id || null,
      item.variant_id || null,
      String(item.product_name || 'Product'),
      item.slug || null,
      item.sku || null,
      item.color || '',
      item.size || '',
      quantity,
      Number(item.unit_price || 0),
      item.currency || 'NGN',
      toInt(item.stock, 0)
    ).run();
  }

  return ok({ items: await fetchCart(context.env, customer.id) });
}

export async function onRequestDelete(context) {
  const { response, customer } = await requireCustomer(context);
  if (response) return response;
  const body = await readJson(context.request);
  const key = String(body.key || '');
  if (key) {
    await context.env.DB.prepare(`DELETE FROM cart_items WHERE customer_id = ? AND item_key = ?`).bind(customer.id, key).run();
  } else {
    await context.env.DB.prepare(`DELETE FROM cart_items WHERE customer_id = ?`).bind(customer.id).run();
  }
  return ok({ items: await fetchCart(context.env, customer.id) });
}
