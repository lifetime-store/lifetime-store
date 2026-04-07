import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';
import { verifyHumanCheck } from '../../_lib/human-check.js';
import { getCustomerBySession } from '../../_lib/customer-auth.js';

async function productBySlug(env, slug) {
  return env.DB.prepare(`SELECT id, name FROM products WHERE slug = ? LIMIT 1`).bind(slug).first();
}

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const product = await productBySlug(context.env, context.params.slug);
  if (!product) return error('Product not found.', 404);
  const stats = await context.env.DB.prepare(`SELECT COUNT(*) AS review_count, ROUND(AVG(rating),1) AS avg_rating FROM product_reviews WHERE product_id = ? AND status = 'published'`).bind(product.id).first();
  const reviews = await context.env.DB.prepare(`SELECT r.id, r.rating, r.title, r.body, r.created_at, COALESCE(c.full_name, c.email) AS author_name FROM product_reviews r JOIN customers c ON c.id = r.customer_id WHERE r.product_id = ? AND r.status = 'published' ORDER BY r.created_at DESC LIMIT 50`).bind(product.id).all();
  return ok({ product: { id: product.id, name: product.name }, reviewCount: Number(stats?.review_count || 0), averageRating: Number(stats?.avg_rating || 0), reviews: reviews.results || [] });
}

export async function onRequestPost(context) {
  const customer = await getCustomerBySession(context.env, context.request);
  if (!customer) return error('Sign in to leave a review.', 401);
  const product = await productBySlug(context.env, context.params.slug);
  if (!product) return error('Product not found.', 404);
  const body = await readJson(context.request);
  const human = await verifyHumanCheck(context.env, body.human_token, context.request.headers.get('cf-connecting-ip') || '');
  if (!human.ok) return error(human.message, 400);
  const rating = Number(body.rating || 0);
  const title = String(body.title || '').trim();
  const review = String(body.body || '').trim();
  if (rating < 1 || rating > 5 || !review) return error('Rating and review text are required.', 400);
  const existing = await context.env.DB.prepare(`SELECT id FROM product_reviews WHERE product_id = ? AND customer_id = ? LIMIT 1`).bind(product.id, customer.id).first();
  if (existing) {
    await context.env.DB.prepare(`UPDATE product_reviews SET rating = ?, title = ?, body = ?, status = 'published', created_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(rating, title, review, existing.id).run();
  } else {
    await context.env.DB.prepare(`INSERT INTO product_reviews (product_id, customer_id, rating, title, body, status) VALUES (?, ?, ?, ?, ?, 'published')`).bind(product.id, customer.id, rating, title, review).run();
  }
  return ok({ message: 'Review saved.' });
}
