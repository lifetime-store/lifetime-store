
import { requireAdmin } from '../../_lib/auth.js';
import { error, ok, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';
import { getSetting } from '../../_lib/storefront.js';

const DEFAULTS = {
  store_notice_badge: 'Store notice',
  store_notice: 'Checkout is completed in NGN. International visitors see a local price preview.',
  verify_scanner_hint: 'Open this page in Safari or Chrome for the best camera support.'
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
  return ok({ message: 'Site experience updated.' });
}
