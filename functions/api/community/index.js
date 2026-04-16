import { ok, error, optionsResponse } from '../../_lib/response.js';
import { readJson } from '../../_lib/parse.js';
import { getCustomerBySession } from '../../_lib/customer-auth.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const posts = await context.env.DB.prepare(`SELECT cp.id, cp.title, cp.body, cp.author_name, cp.created_at, p.name AS product_name, p.slug AS product_slug
    FROM community_posts cp
    LEFT JOIN products p ON p.id = cp.product_id
    WHERE cp.status = 'published'
    ORDER BY cp.id DESC
    LIMIT 120`).all();
  const products = await context.env.DB.prepare(`SELECT slug, name FROM products WHERE active = 1 ORDER BY name ASC`).all();
  return ok({ posts: posts.results || [], products: products.results || [] });
}

export async function onRequestPost(context) {
  const customer = await getCustomerBySession(context.env, context.request);
  if (!customer) return error('Sign in to post in the community.', 401);
  const body = await readJson(context.request);
  const text = String(body.body || '').trim();
  const title = String(body.title || '').trim();
  const slug = String(body.product_slug || '').trim();
  if (text.length < 3) return error('Write a longer message.', 400);
  let productId = null;
  if (slug) {
    const product = await context.env.DB.prepare(`SELECT id FROM products WHERE slug = ? LIMIT 1`).bind(slug).first();
    if (!product) return error('Selected product was not found.', 404);
    productId = product.id;
  }
  const authorName = customer.full_name || customer.email?.split('@')[0] || 'Buyer';
  await context.env.DB.prepare(`INSERT INTO community_posts (customer_id, product_id, author_name, title, body, status) VALUES (?, ?, ?, ?, ?, 'published')`).bind(customer.id, productId, authorName, title, text).run();
  return ok({ message: 'Message posted to the community.' });
}
