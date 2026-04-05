
import { requireAdmin } from "../../_lib/auth.js";
import { error, ok, optionsResponse } from "../../_lib/response.js";
import { readJson, toFloat, toInt } from "../../_lib/parse.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const { results } = await context.env.DB.prepare(`
    SELECT * FROM products ORDER BY updated_at DESC, id DESC
  `).all();

  return ok({ products: results || [] });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  const body = await readJson(context.request);

  const {
    id = null,
    slug,
    short_code,
    name,
    tagline = "",
    category = "Apparel",
    description = "",
    price_ngn,
    price_usd,
    materials = "",
    fit_notes = "",
    care = "",
    active = 1,
    featured = 0
  } = body;

  if (!slug || !short_code || !name || !price_ngn || !price_usd) {
    return error("slug, short_code, name, price_ngn, and price_usd are required.", 400);
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

    return ok({ message: "Product updated." });
  }

  await context.env.DB.prepare(`
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

  return ok({ message: "Product created." });
}
