import { ok, optionsResponse } from '../../_lib/response.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(`SELECT id, category, question, answer_html, sort_order, status FROM faq_items WHERE status = 'published' ORDER BY category ASC, sort_order ASC, id ASC`).all();
  return ok({ items: results || [] });
}
