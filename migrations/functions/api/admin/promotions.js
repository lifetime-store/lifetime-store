import { requireAdmin } from '../../_lib/auth.js';
import { error, ok, optionsResponse } from '../../_lib/response.js';
import { readJson, toFloat, toInt } from '../../_lib/parse.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;
  const [promotions, codes] = await Promise.all([
    context.env.DB.prepare(`SELECT * FROM promotions ORDER BY featured DESC, updated_at DESC, id DESC`).all(),
    context.env.DB.prepare(`SELECT * FROM promo_codes ORDER BY created_at DESC, id DESC LIMIT 100`).all()
  ]);
  return ok({ promotions: promotions.results || [], promoCodes: codes.results || [] });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;
  const body = await readJson(context.request);
  const action = body.action || (body.code ? 'save_code' : 'save_promotion');

  if (action === 'delete_promotion') {
    const id = toInt(body.id);
    if (!id) return error('Promotion id is required.', 400);
    await context.env.DB.prepare(`DELETE FROM promotions WHERE id = ?`).bind(id).run();
    return ok({ message: 'Promotion deleted.' });
  }

  if (action === 'delete_code') {
    const id = toInt(body.id);
    if (!id) return error('Promo code id is required.', 400);
    await context.env.DB.prepare(`DELETE FROM promo_codes WHERE id = ?`).bind(id).run();
    return ok({ message: 'Promo code deleted.' });
  }

  if (action === 'save_code') {
    const id = toInt(body.id || 0) || null;
    const promotionId = toInt(body.promotion_id || 0) || null;
    const code = String(body.code || '').trim().toUpperCase();
    if (!code) return error('Promo code is required.', 400);
    const payload = [
      promotionId,
      code,
      body.discount_type || 'percent',
      toFloat(body.discount_value, 0),
      toFloat(body.min_subtotal, 0),
      body.usage_limit ? toInt(body.usage_limit) : null,
      body.tier_gate || null,
      body.active ? 1 : 0,
      body.starts_at || null,
      body.ends_at || null
    ];

    if (id) {
      await context.env.DB.prepare(`
        UPDATE promo_codes
        SET promotion_id = ?, code = ?, discount_type = ?, discount_value = ?, min_subtotal = ?, usage_limit = ?, tier_gate = ?, active = ?, starts_at = ?, ends_at = ?
        WHERE id = ?
      `).bind(...payload, id).run();
      return ok({ message: 'Promo code updated.' });
    }

    await context.env.DB.prepare(`
      INSERT INTO promo_codes (promotion_id, code, discount_type, discount_value, min_subtotal, usage_limit, tier_gate, active, starts_at, ends_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(...payload).run();
    return ok({ message: 'Promo code created.' });
  }

  const id = toInt(body.id || 0) || null;
  const title = String(body.title || '').trim();
  const slug = String(body.slug || '').trim();
  if (!title || !slug) return error('Promotion title and slug are required.', 400);
  const payload = [
    title,
    slug,
    body.badge_text || null,
    body.banner_text || null,
    body.discount_type || 'percent',
    toFloat(body.discount_value, 0),
    body.active ? 1 : 0,
    body.featured ? 1 : 0,
    body.apply_scope || 'storewide'
  ];

  if (id) {
    await context.env.DB.prepare(`
      UPDATE promotions
      SET title = ?, slug = ?, badge_text = ?, banner_text = ?, discount_type = ?, discount_value = ?, active = ?, featured = ?, apply_scope = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(...payload, id).run();
    return ok({ message: 'Promotion updated.' });
  }

  await context.env.DB.prepare(`
    INSERT INTO promotions (title, slug, badge_text, banner_text, discount_type, discount_value, active, featured, apply_scope)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(...payload).run();
  return ok({ message: 'Promotion created.' });
}
