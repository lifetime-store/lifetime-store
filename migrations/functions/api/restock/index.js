
import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const { email, product_id, variant_id = null, notes = '' } = body;
  if (!email || !product_id) return error('email and product_id are required.', 400);
  await context.env.DB.prepare(`
    INSERT INTO restock_requests (email, product_id, variant_id, notes)
    VALUES (?, ?, ?, ?)
  `).bind(String(email).trim().toLowerCase(), product_id, variant_id, notes || '').run();
  return ok({ message: 'Restock request saved.' });
}
