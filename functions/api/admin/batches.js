
import { requireAdmin } from "../../_lib/auth.js";
import { getBatchWithProduct } from "../../_lib/db.js";
import { makeBatchCode } from "../../_lib/codes.js";
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
      b.*,
      p.name AS product_name,
      p.short_code,
      COALESCE(v.color, '') AS color,
      COALESCE(v.size, '') AS size
    FROM batches b
    JOIN products p ON p.id = b.product_id
    LEFT JOIN variants v ON v.id = b.variant_id
    ORDER BY b.id DESC
  `).all();

  return ok({ batches: results || [] });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const body = await readJson(context.request);
  const {
    product_id,
    variant_id = null,
    factory_name = "Lekki Garment Factory",
    quantity,
    status = "draft",
    manufactured_at = "",
    notes = ""
  } = body;

  if (!product_id || !quantity) {
    return error("product_id and quantity are required.", 400);
  }

  const product = await context.env.DB.prepare(`
    SELECT short_code FROM products WHERE id = ? LIMIT 1
  `).bind(product_id).first();

  if (!product) return error("Product not found.", 404);

  const batchCode = makeBatchCode(product.short_code, quantity);

  const result = await context.env.DB.prepare(`
    INSERT INTO batches (
      batch_code, product_id, variant_id, factory_name, quantity, status, manufactured_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    batchCode,
    product_id,
    variant_id,
    factory_name,
    toInt(quantity),
    status,
    manufactured_at || null,
    notes
  ).run();

  const batch = await getBatchWithProduct(context.env, result.meta?.last_row_id);
  return ok({ message: "Batch created.", batch });
}
