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
      ) AS image_count
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
      ) AS image_count
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

  const imagesResult = await env.DB.prepare(`
    SELECT id, data_url, alt_text, is_primary, sort_order
    FROM product_images
    WHERE product_id = ?
    ORDER BY is_primary DESC, sort_order ASC, id ASC
  `).bind(product.id).all();

  const variants = (variantsResult.results || []).map((variant) => ({
    ...variant,
    stock: Number(variant.stock || 0)
  }));
  const totalStock = variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);

  return {
    ...product,
    image_count: Number(product.image_count || 0),
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
  const [products, batches, codes, issues, orders, lowStock, pendingActivation, activeBatches] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS total FROM products`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM batches`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM auth_codes`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM issues WHERE status = 'open'`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM orders`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM variants WHERE active = 1 AND stock <= 5`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM auth_codes WHERE status IN ('generated','printed','attached','received','draft')`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM batches WHERE status = 'active'`).first()
  ]);

  return {
    products: products?.total || 0,
    batches: batches?.total || 0,
    codes: codes?.total || 0,
    openIssues: issues?.total || 0,
    orders: orders?.total || 0,
    lowStock: lowStock?.total || 0,
    pendingActivation: pendingActivation?.total || 0,
    activeBatches: activeBatches?.total || 0
  };
}
