import { requireAdmin } from "../../_lib/auth.js";
import { error, ok, optionsResponse } from "../../_lib/response.js";
import { readJson, toFloat, toInt } from "../../_lib/parse.js";

export async function onRequestOptions() {
  return optionsResponse();
}

async function listAdminProducts(env) {
  const { results } = await env.DB.prepare(`
    SELECT
      p.*,
      (
        SELECT data_url
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
        LIMIT 1
      ) AS primary_image_url,
      (
        SELECT COUNT(*)
        FROM product_images pi
        WHERE pi.product_id = p.id
      ) AS image_count,
      (
        SELECT COUNT(*)
        FROM variants v
        WHERE v.product_id = p.id
      ) AS variant_count
    FROM products p
    ORDER BY p.updated_at DESC, p.id DESC
  `).all();
  return results || [];
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;
  return ok({ products: await listAdminProducts(context.env) });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const body = await readJson(context.request);
  const action = body.action || (body.id ? 'update' : 'create');

  if (action === 'delete') {
    const id = toInt(body.id);
    if (!id) return error('Product id is required.', 400);
    await context.env.DB.prepare(`DELETE FROM products WHERE id = ?`).bind(id).run();
    return ok({ message: 'Product deleted.' });
  }

  if (action === 'toggle_active') {
    const id = toInt(body.id);
    if (!id) return error('Product id is required.', 400);
    const product = await context.env.DB.prepare(`SELECT active FROM products WHERE id = ? LIMIT 1`).bind(id).first();
    if (!product) return error('Product not found.', 404);
    await context.env.DB.prepare(`UPDATE products SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(product.active ? 0 : 1, id).run();
    return ok({ message: product.active ? 'Product hidden.' : 'Product shown.' });
  }

  if (action === 'toggle_featured') {
    const id = toInt(body.id);
    if (!id) return error('Product id is required.', 400);
    const product = await context.env.DB.prepare(`SELECT featured FROM products WHERE id = ? LIMIT 1`).bind(id).first();
    if (!product) return error('Product not found.', 404);
    await context.env.DB.prepare(`UPDATE products SET featured = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(product.featured ? 0 : 1, id).run();
    return ok({ message: product.featured ? 'Removed from featured.' : 'Added to featured.' });
  }

  const {
    id = null,
    slug,
    short_code,
    name,
    tagline = '',
    category = 'Apparel',
    description = '',
    price_ngn,
    price_usd,
    materials = '',
    fit_notes = '',
    care = '',
    active = 1,
    featured = 0
  } = body;

  if (!slug || !short_code || !name || !price_ngn || !price_usd) {
    return error('slug, short_code, name, price_ngn, and price_usd are required.', 400);
  }

  if (id) {
    await context.env.DB.prepare(`
      UPDATE products
      SET slug = ?, short_code = ?, name = ?, tagline = ?, category = ?, description = ?,
          price_ngn = ?, price_usd = ?, materials = ?, fit_notes = ?, care = ?,
          active = ?, featured = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      slug,
      short_code,
      name,
      tagline,
      category,
      description,
      toInt(price_ngn),
      toFloat(price_usd),
      materials,
      fit_notes,
      care,
      active ? 1 : 0,
      featured ? 1 : 0,
      id
    ).run();

    return ok({ message: 'Product updated.' });
  }

  const result = await context.env.DB.prepare(`
    INSERT INTO products (
      slug, short_code, name, tagline, category, description, price_ngn, price_usd, materials, fit_notes, care, active, featured
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    slug,
    short_code,
    name,
    tagline,
    category,
    description,
    toInt(price_ngn),
    toFloat(price_usd),
    materials,
    fit_notes,
    care,
    active ? 1 : 0,
    featured ? 1 : 0
  ).run();

  return ok({ message: 'Product created.', productId: result.meta?.last_row_id || null });
}
