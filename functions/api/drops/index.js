import { ok, optionsResponse } from '../../_lib/response.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(`SELECT id, title, slug, summary, body_html, launch_at, badge_text, hero_image_url, cta_href, status FROM launch_drops WHERE status IN ('scheduled','live','published') ORDER BY CASE WHEN status = 'live' THEN 0 WHEN status = 'published' THEN 1 ELSE 2 END, launch_at ASC, id DESC LIMIT 20`).all();
  return ok({ drops: results || [] });
}
