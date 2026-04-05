
export async function listProducts(env, featuredOnly = false) {
  const sql = `
    SELECT
      p.id, p.slug, p.short_code, p.name, p.tagline, p.category, p.description,
      p.price_ngn, p.price_usd, p.materials, p.fit_notes, p.care, p.featured,
      COUNT(v.id) AS variant_count
    FROM products p
    LEFT JOIN variants v ON v.product_id = p.id AND v.active = 1
    WHERE p.active = 1
    ${featuredOnly ? "AND p.featured = 1" : ""}
    GROUP BY p.id
    ORDER BY p.featured DESC, p.id ASC
  `;
  const { results } = await env.DB.prepare(sql).all();
  return results || [];
}

export async function getProductBySlug(env, slug) {
  const product = await env.DB.prepare(`
    SELECT *
    FROM products
    WHERE slug = ? AND active = 1
    LIMIT 1
  `).bind(slug).first();

  if (!product) return null;

  const variantsResult = await env.DB.prepare(`
    SELECT id, sku, color, color_code, size, size_code, stock,
           COALESCE(price_ngn, ?) AS price_ngn,
           COALESCE(price_usd, ?) AS price_usd
    FROM variants
    WHERE product_id = ? AND active = 1
    ORDER BY color ASC, size ASC
  `).bind(product.price_ngn, product.price_usd, product.id).all();

  return { ...product, variants: variantsResult.results || [] };
}

export async function getBatchWithProduct(env, batchId) {
  return env.DB.prepare(`
    SELECT
      b.*,
      p.name AS product_name,
      p.short_code AS product_short_code,
      v.color,
      v.color_code,
      v.size,
      v.size_code
    FROM batches b
    JOIN products p ON p.id = b.product_id
    LEFT JOIN variants v ON v.id = b.variant_id
    WHERE b.id = ?
    LIMIT 1
  `).bind(batchId).first();
}

export async function dashboardSummary(env) {
  const [products, batches, codes, issues, orders] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS total FROM products`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM batches`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM auth_codes`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM issues WHERE status = 'open'`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM orders`).first()
  ]);

  return {
    products: products?.total || 0,
    batches: batches?.total || 0,
    codes: codes?.total || 0,
    openIssues: issues?.total || 0,
    orders: orders?.total || 0
  };
}
