import { requireAdmin } from '../../_lib/auth.js';
import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';
import { logAdminAction } from '../../_lib/admin-audit.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const { results } = await context.env.DB.prepare(`SELECT * FROM launch_drops ORDER BY CASE WHEN status = 'live' THEN 0 WHEN status = 'published' THEN 1 ELSE 2 END, launch_at ASC, id DESC`).all();
  return ok({ drops: results || [] });
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const body = await readJson(context.request);
  if (body.action === 'delete') {
    await context.env.DB.prepare(`DELETE FROM launch_drops WHERE id = ?`).bind(Number(body.id || 0)).run();
    await logAdminAction(context.env, 'delete_launch_drop', 'launch_drops', Number(body.id || 0), body);
    return ok({ message: 'Drop deleted.' });
  }
  const title = String(body.title || '').trim();
  const slug = String(body.slug || '').trim();
  if (!title || !slug) return error('Title and slug are required.', 400);
  const summary = String(body.summary || '').trim();
  const bodyHtml = String(body.body_html || '').trim();
  const launchAt = String(body.launch_at || '').trim() || null;
  const badgeText = String(body.badge_text || '').trim() || null;
  const ctaHref = String(body.cta_href || '/shop.html').trim();
  const status = String(body.status || 'scheduled').trim();
  if (body.drop_id) {
    await context.env.DB.prepare(`UPDATE launch_drops SET title = ?, slug = ?, summary = ?, body_html = ?, launch_at = ?, badge_text = ?, cta_href = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(title, slug, summary, bodyHtml, launchAt, badgeText, ctaHref, status, Number(body.drop_id)).run();
    await logAdminAction(context.env, 'update_launch_drop', 'launch_drops', Number(body.drop_id), body);
    return ok({ message: 'Drop updated.' });
  }
  const insert = await context.env.DB.prepare(`INSERT INTO launch_drops (title, slug, summary, body_html, launch_at, badge_text, cta_href, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(title, slug, summary, bodyHtml, launchAt, badgeText, ctaHref, status).run();
  await logAdminAction(context.env, 'create_launch_drop', 'launch_drops', insert.meta?.last_row_id || null, body);
  return ok({ message: 'Drop created.' });
}
