import { requireAdmin } from '../../_lib/auth.js';
import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';
import { logAdminAction } from '../../_lib/admin-audit.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const { results } = await context.env.DB.prepare(`SELECT id, category, question, answer_html, sort_order, status, created_at, updated_at FROM faq_items ORDER BY category ASC, sort_order ASC, id ASC`).all();
  return ok({ items: results || [] });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const body = await readJson(context.request);
  if (body.action === 'delete') {
    await context.env.DB.prepare(`DELETE FROM faq_items WHERE id = ?`).bind(Number(body.id || 0)).run();
    await logAdminAction(context.env, 'delete_faq_item', 'faq_items', Number(body.id || 0), body);
    return ok({ message: 'FAQ item deleted.' });
  }
  const question = String(body.question || '').trim();
  const answer = String(body.answer_html || '').trim();
  const category = String(body.category || 'general').trim();
  const status = String(body.status || 'published').trim();
  const sortOrder = Number(body.sort_order || 0);
  if (!question || !answer) return error('Question and answer are required.', 400);
  if (body.faq_id) {
    await context.env.DB.prepare(`UPDATE faq_items SET category = ?, question = ?, answer_html = ?, sort_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(category, question, answer, sortOrder, status, Number(body.faq_id)).run();
    await logAdminAction(context.env, 'update_faq_item', 'faq_items', Number(body.faq_id), body);
    return ok({ message: 'FAQ item updated.' });
  }
  const insert = await context.env.DB.prepare(`INSERT INTO faq_items (category, question, answer_html, sort_order, status) VALUES (?, ?, ?, ?, ?)`).bind(category, question, answer, sortOrder, status).run();
  await logAdminAction(context.env, 'create_faq_item', 'faq_items', insert.meta?.last_row_id || null, body);
  return ok({ message: 'FAQ item created.' });
}
