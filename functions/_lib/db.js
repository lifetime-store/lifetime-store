export async function listProducts(env, featuredOnly = false) {
  const sql = `
    SELECT
      p.id,
      p.slug,
      p.short_code,
      p.name,
      p.tagline,
      p.category,
      p.description,
      p.price_ngn,
      p.price_usd,
      p.compare_at_ngn,
      p.compare_at_usd,
      p.collection_label,
      p.mood_label,
      p.materials,
      p.fit_notes,
      p.care,
      p.featured,
      p.active,
      COUNT(DISTINCT CASE WHEN v.active = 1 THEN v.id END) AS variant_count,
      COALESCE(SUM(CASE WHEN v.active = 1 THEN v.stock ELSE 0 END), 0) AS total_stock,
      (
        SELECT pi.data_url
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
        LIMIT 1
      ) AS primary_image_url,
      (
        SELECT COUNT(*)
        FROM product_images pi
        WHERE pi.product_id = p.id
      ) AS image_count,
      (SELECT ROUND(AVG(r.rating),1) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'published') AS average_rating,
      (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'published') AS review_count
    FROM products p
    LEFT JOIN variants v ON v.product_id = p.id
    WHERE p.active = 1
    ${featuredOnly ? "AND p.featured = 1" : ""}
    GROUP BY p.id
    ORDER BY p.featured DESC, p.id ASC
  `;
  const { results } = await env.DB.prepare(sql).all();
  return (results || []).map((item) => ({
    ...item,
    total_stock: Number(item.total_stock || 0)
  }));
}

export async function getProductBySlug(env, slug) {
  const product = await env.DB.prepare(`
    SELECT
      products.*,
      (
        SELECT data_url
        FROM product_images pi
        WHERE pi.product_id = products.id
        ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
        LIMIT 1
      ) AS primary_image_url,
      (
        SELECT COUNT(*)
        FROM product_images pi
        WHERE pi.product_id = products.id
      ) AS image_count,
      (SELECT ROUND(AVG(r.rating),1) FROM product_reviews r WHERE r.product_id = products.id AND r.status = 'published') AS average_rating,
      (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = products.id AND r.status = 'published') AS review_count
    FROM products
    WHERE slug = ? AND active = 1
    LIMIT 1
  `).bind(slug).first();

  if (!product) return null;

  const variantsResult = await env.DB.prepare(`
    SELECT id, sku, color, color_code, size, size_code, stock,
           COALESCE(price_ngn, ?) AS price_ngn,
           COALESCE(price_usd, ?) AS price_usd,
           compare_at_ngn,
           compare_at_usd
    FROM variants
    WHERE product_id = ? AND active = 1
    ORDER BY color ASC, size ASC
  `).bind(product.price_ngn, product.price_usd, product.id).all();

  const imagesResult = await env.DB.prepare(`
    SELECT id, data_url, alt_text, is_primary, sort_order
    FROM product_images
    WHERE product_id = ?
    ORDER BY is_primary DESC, sort_order ASC, id ASC
  `).bind(product.id).all();

  const variants = (variantsResult.results || []).map((variant) => ({
    ...variant,
    compare_at_ngn: variant.compare_at_ngn ?? product.compare_at_ngn ?? null,
    compare_at_usd: variant.compare_at_usd ?? product.compare_at_usd ?? null,
    stock: Number(variant.stock || 0)
  }));
  const totalStock = variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);

  return {
    ...product,
    image_count: Number(product.image_count || 0),
    average_rating: Number(product.average_rating || 0),
    review_count: Number(product.review_count || 0),
    total_stock: totalStock,
    variants,
    images: imagesResult.results || []
  };
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
  const [products, batches, codes, issues, orders, lowStock, pendingActivation, activeBatches, promotions, buyers, deliveries, reviews] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS total FROM products`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM batches`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM auth_codes`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM issues WHERE status = 'open'`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM orders`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM variants WHERE active = 1 AND stock <= 5`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM auth_codes WHERE status IN ('generated','printed','attached','received','draft')`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM batches WHERE status = 'active'`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM promotions WHERE active = 1`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM customers`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM deliveries`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM product_reviews WHERE status = 'published'`).first()
  ]);

  return {
    products: products?.total || 0,
    batches: batches?.total || 0,
    codes: codes?.total || 0,
    openIssues: issues?.total || 0,
    orders: orders?.total || 0,
    lowStock: lowStock?.total || 0,
    pendingActivation: pendingActivation?.total || 0,
    activeBatches: activeBatches?.total || 0,
    promotions: promotions?.total || 0,
    buyers: buyers?.total || 0,
    deliveries: deliveries?.total || 0,
    reviews: reviews?.total || 0
  };
}
