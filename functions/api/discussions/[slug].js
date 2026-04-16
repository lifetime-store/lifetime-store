import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';
import { getCustomerBySession } from '../../_lib/customer-auth.js';

async function productBySlug(env, slug) {
  return env.DB.prepare(`SELECT id, name FROM products WHERE slug = ? LIMIT 1`).bind(slug).first();
}

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const product = await productBySlug(context.env, context.params.slug);
  if (!product) return error('Product not found.', 404);
  const posts = await context.env.DB.prepare(`SELECT id, author_name, body, created_at FROM product_discussions WHERE product_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 100`).bind(product.id).all();
  return ok({ posts: posts.results || [] });
}

export async function onRequestPost(context) {
  const customer = await getCustomerBySession(context.env, context.request);
  if (!customer) return error('Sign in to join the discussion.', 401);
  const product = await productBySlug(context.env, context.params.slug);
  if (!product) return error('Product not found.', 404);
  const body = await readJson(context.request);
  const text = String(body.body || '').trim();
  if (text.length < 3) return error('Write a longer message.', 400);
  const authorName = customer.full_name || customer.email.split('@')[0] || 'Buyer';
  await context.env.DB.prepare(`INSERT INTO product_discussions (product_id, customer_id, author_name, body, status) VALUES (?, ?, ?, ?, 'published')`).bind(product.id, customer.id, authorName, text).run();
  return ok({ message: 'Comment posted.' });
}
