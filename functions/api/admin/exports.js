import { requireAdmin } from '../../_lib/auth.js';

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",
]/.test(text)) return '"' + text.replaceAll('"', '""') + '"';
  return text;
}
function rowsToCsv(rows) {
  if (!rows.length) return 'no_data
';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((key) => csvEscape(row[key])).join(','));
  return lines.join('
');
}

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const type = String(new URL(context.request.url).searchParams.get('type') || 'products');
  let sql = '';
  if (type === 'products') sql = `SELECT id, slug, name, category, price_ngn, price_usd, active, featured FROM products ORDER BY id DESC`;
  else if (type === 'orders') sql = `SELECT id, order_number, customer_name, email, status, total, created_at FROM orders ORDER BY id DESC`;
  else if (type === 'customers') sql = `SELECT c.id, c.email, c.full_name, COALESCE(cp.tier_name,'Star 1') AS tier_name, COALESCE(cp.paid_orders,0) AS paid_orders, COALESCE(cp.lifetime_spend,0) AS lifetime_spend FROM customers c LEFT JOIN customer_profiles cp ON cp.customer_id = c.id ORDER BY c.id DESC`;
  else if (type === 'deliveries') sql = `SELECT id, order_number, tracking_number, delivery_type, courier_name, status, eta_text, created_at FROM deliveries ORDER BY id DESC`;
  else if (type === 'newsletter') sql = `SELECT id, email, full_name, source, status, created_at FROM newsletter_subscribers ORDER BY id DESC`;
  else return new Response('Unknown export type.', { status: 400 });
  const { results } = await context.env.DB.prepare(sql).all();
  return new Response(rowsToCsv(results || []), { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store' } });
}
