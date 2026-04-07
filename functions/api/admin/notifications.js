import { requireAdmin } from '../../_lib/auth.js';
import { ok, optionsResponse } from '../../_lib/response.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const items = [];
  const [lowStock, openIssues, feeRequests, restocks, hiddenReviews] = await Promise.all([
    context.env.DB.prepare(`SELECT sku, stock FROM variants WHERE active = 1 AND stock <= 5 ORDER BY stock ASC, sku ASC LIMIT 6`).all(),
    context.env.DB.prepare(`SELECT issue_type, email, created_at FROM issues WHERE status = 'open' ORDER BY id DESC LIMIT 5`).all(),
    context.env.DB.prepare(`SELECT fee_code, amount_ngn, reason FROM delivery_fee_requests WHERE status IN ('requested','pending') ORDER BY id DESC LIMIT 5`).all(),
    context.env.DB.prepare(`SELECT email, created_at FROM restock_requests WHERE status = 'open' ORDER BY id DESC LIMIT 5`).all(),
    context.env.DB.prepare(`SELECT id, title, created_at FROM product_reviews WHERE status != 'published' ORDER BY id DESC LIMIT 5`).all()
  ]);
  for (const row of lowStock.results || []) items.push({ title: 'Low stock warning', body: `${row.sku} is down to ${row.stock}.` });
  for (const row of openIssues.results || []) items.push({ title: 'Support issue open', body: `${row.issue_type} from ${row.email}.` });
  for (const row of feeRequests.results || []) items.push({ title: 'Delivery fee waiting', body: `${row.fee_code} — ₦${Number(row.amount_ngn || 0).toLocaleString()} for ${row.reason}.` });
  for (const row of restocks.results || []) items.push({ title: 'Restock request open', body: `Request from ${row.email}.` });
  for (const row of hiddenReviews.results || []) items.push({ title: 'Moderation queue', body: `Review ${row.id} is not published yet.` });
  return ok({ items: items.slice(0, 20) });
}
