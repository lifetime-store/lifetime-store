import { requireAdmin } from "../../_lib/auth.js";
import { error, ok, optionsResponse } from "../../_lib/response.js";
import { readJson, toFloat, toInt } from "../../_lib/parse.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const url = new URL(context.request.url);
  const productId = url.searchParams.get("product_id");

  const baseSql = `
    SELECT v.*, p.name AS product_name
    FROM variants v
    JOIN products p ON p.id = v.product_id
    ${productId ? "WHERE v.product_id = ?" : ""}
    ORDER BY v.id DESC
  `;

  const result = productId
    ? await context.env.DB.prepare(baseSql).bind(productId).all()
    : await context.env.DB.prepare(baseSql).all();

  return ok({ variants: result.results || [] });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const body = await readJson(context.request);
  const action = body.action || (body.id ? 'update' : 'create');


  if (action === 'adjust_stock') {
    const id = toInt(body.id);
    const delta = toInt(body.delta, 0);
    if (!id || !delta) return error('Variant id and stock delta are required.', 400);
    await context.env.DB.prepare(`UPDATE variants SET stock = MAX(0, stock + ?) WHERE id = ?`).bind(delta, id).run();
    return ok({ message: delta > 0 ? `Added ${delta} units.` : `Removed ${Math.abs(delta)} units.` });
  }

  if (action === 'set_stock') {
    const id = toInt(body.id);
    const stock = toInt(body.stock, 0);
    if (!id && id !== 0) return error('Variant id is required.', 400);
    await context.env.DB.prepare(`UPDATE variants SET stock = MAX(0, ? ) WHERE id = ?`).bind(stock, id).run();
    return ok({ message: `Available stock set to ${Math.max(0, stock)}.` });
  }

  if (action === 'delete') {
    const id = toInt(body.id);
    if (!id) return error('Variant id is required.', 400);
    await context.env.DB.prepare(`DELETE FROM variants WHERE id = ?`).bind(id).run();
    return ok({ message: 'Variant deleted.' });
  }

  const {
    id = null,
    product_id,
    sku,
    color,
    color_code,
    size,
    size_code,
    stock = 0,
    price_ngn = null,
    price_usd = null,
    compare_at_ngn = null,
    compare_at_usd = null,
    active = 1
  } = body;

  if (!product_id || !sku || !color || !color_code || !size || !size_code) {
    return error('product_id, sku, color, color_code, size, and size_code are required.', 400);
  }

  if (id) {
    await context.env.DB.prepare(`
      UPDATE variants
      SET product_id = ?, sku = ?, color = ?, color_code = ?, size = ?, size_code = ?, stock = ?,
          price_ngn = ?, price_usd = ?, compare_at_ngn = ?, compare_at_usd = ?, active = ?
      WHERE id = ?
    `).bind(
      product_id,
      sku,
      color,
      color_code,
      size,
      size_code,
      toInt(stock),
      price_ngn === null || price_ngn === '' ? null : toInt(price_ngn),
      price_usd === null || price_usd === '' ? null : toFloat(price_usd),
      compare_at_ngn === null || compare_at_ngn === '' ? null : toInt(compare_at_ngn),
      compare_at_usd === null || compare_at_usd === '' ? null : toFloat(compare_at_usd),
      active ? 1 : 0,
      id
    ).run();
    return ok({ message: 'Variant updated.' });
  }

  await context.env.DB.prepare(`
    INSERT INTO variants (
      product_id, sku, color, color_code, size, size_code, stock, price_ngn, price_usd, compare_at_ngn, compare_at_usd, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    product_id,
    sku,
    color,
    color_code,
    size,
    size_code,
    toInt(stock),
    price_ngn === null || price_ngn === '' ? null : toInt(price_ngn),
    price_usd === null || price_usd === '' ? null : toFloat(price_usd),
    compare_at_ngn === null || compare_at_ngn === '' ? null : toInt(compare_at_ngn),
    compare_at_usd === null || compare_at_usd === '' ? null : toFloat(compare_at_usd),
    active ? 1 : 0
  ).run();

  return ok({ message: 'Variant created.' });
}
