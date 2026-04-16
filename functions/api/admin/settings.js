import { requireAdmin } from '../../_lib/auth.js';
import { error, ok, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';
import { getSetting } from '../../_lib/storefront.js';
import { logAdminAction } from '../../_lib/admin-audit.js';

const DEFAULTS = {
  store_notice_badge: 'Store update',
  store_notice: 'Worldwide pricing preview adjusts to the shopper region. Final settlement is completed securely in NGN at checkout.',
  verify_scanner_hint: 'Use your phone camera on the cloth label. If camera access is denied, you can still enter the code manually or upload a label photo.',
  hero_eyebrow: 'Quiet premium daily wear',
  hero_title: 'Refined essentials built to outlast noise.',
  hero_copy: 'Lifetime creates premium essentials with clean structure, durable fabric, and verified authenticity.',
  hero_cta_label: 'Shop collection',
  hero_cta_href: '/shop.html',
  shipping_policy_html: '<h2>Shipping</h2><p>Orders are processed after payment verification.</p>',
  returns_policy_html: '<h2>Returns</h2><p>Return requests should be made through support with your order number.</p>',
  exchange_policy_html: '<h2>Exchanges</h2><p>Exchange availability depends on current stock.</p>',
  size_guide_html: '<h2>Size guide</h2><p>Use garment measurements and fit notes before checkout.</p>',
  collection_intro: 'Explore edited collections, seasonal drops, and core essentials.',
  support_intro: 'Product questions, authenticity checks, and general help are handled here.',
  orders_intro: 'Track an existing order, ask about delivery, or check your order status in one place.'
};

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;
  const settings = {};
  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    settings[key] = await getSetting(context.env, key, fallback);
  }
  return ok({ settings });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;
  const body = await readJson(context.request);
  const updates = [];
  for (const key of Object.keys(DEFAULTS)) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      updates.push([key, String(body[key] ?? '').trim() || DEFAULTS[key]]);
    }
  }
  if (!updates.length) return error('No settings provided.', 400);
  for (const [key, value] of updates) {
    await context.env.DB.prepare(`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).bind(key, value).run();
  }
  await logAdminAction(context.env, 'update_settings', 'site_settings', null, Object.fromEntries(updates));
  return ok({ message: 'Site settings updated.' });
}
