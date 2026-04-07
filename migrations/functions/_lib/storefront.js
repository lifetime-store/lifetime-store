const DEFAULT_USD_RATES = {
  USD: 1,
  NGN: 1550,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
  AED: 3.67,
  ZAR: 18.6,
  KES: 130,
  GHS: 15.5,
  XOF: 610
};

const DEFAULT_COUNTRY_CURRENCY = {
  NG: 'NGN', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', AE: 'AED', ZA: 'ZAR',
  KE: 'KES', GH: 'GHS', FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR',
  BE: 'EUR', IE: 'EUR', PT: 'EUR', CI: 'XOF', SN: 'XOF'
};

const DEFAULT_LOCALE = {
  NGN: 'en-NG', USD: 'en-US', GBP: 'en-GB', EUR: 'en-IE', CAD: 'en-CA', AUD: 'en-AU',
  AED: 'en-AE', ZAR: 'en-ZA', KES: 'en-KE', GHS: 'en-GH', XOF: 'fr-SN'
};

const DEFAULT_CONTENT = {
  store_notice: 'Worldwide pricing preview adjusts to the shopper region. Final settlement is completed securely in NGN at checkout.',
  store_notice_badge: 'Store update',
  verify_scanner_hint: 'Use your phone camera on the cloth label. If camera access is denied, you can still enter the code manually or upload a label photo.',
  hero_eyebrow: 'Quiet premium daily wear',
  hero_title: 'Refined essentials built to outlast noise.',
  hero_copy: 'Lifetime creates premium essentials with clean structure, durable fabric, and verified authenticity.',
  hero_cta_label: 'Shop collection',
  hero_cta_href: '/shop.html',
  shipping_policy_html: '<h2>Shipping</h2><p>Orders are processed after payment verification.</p>',
  returns_policy_html: '<h2>Returns</h2><p>Return requests should be made through support with your order number.</p>',
  exchange_policy_html: '<h2>Exchanges</h2><p>Exchange availability depends on current stock.</p>',
  size_guide_html: '<h2>Size guide</h2><p>Use garment measurements and fit notes before checkout.</p>',
  collection_intro: 'Explore edited collections, seasonal drops, and core essentials.',
  support_intro: 'Product questions, authenticity concerns, and quality issues are handled here.',
  orders_intro: 'Track active orders, delivery progress, and payment-linked updates here.'
};

export async function getSetting(env, key, fallback = null) {
  try {
    const row = await env.DB.prepare(`SELECT value FROM site_settings WHERE key = ? LIMIT 1`).bind(key).first();
    return row?.value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getStorefrontMeta(env, request) {
  const cfCountry = request?.cf?.country || 'NG';
  const countryJson = await getSetting(env, 'country_currency_json', JSON.stringify(DEFAULT_COUNTRY_CURRENCY));
  const rateJson = await getSetting(env, 'usd_rates_json', JSON.stringify(DEFAULT_USD_RATES));

  let countryCurrency = DEFAULT_COUNTRY_CURRENCY;
  let usdRates = DEFAULT_USD_RATES;
  try { countryCurrency = { ...DEFAULT_COUNTRY_CURRENCY, ...JSON.parse(countryJson || '{}') }; } catch {}
  try { usdRates = { ...DEFAULT_USD_RATES, ...JSON.parse(rateJson || '{}') }; } catch {}

  const currency = countryCurrency[cfCountry] || 'USD';
  const locale = DEFAULT_LOCALE[currency] || 'en-US';
  const rate = Number(usdRates[currency] || 1);
  const promotion = await getActivePromotion(env);
  const content = {};
  for (const [key, fallback] of Object.entries(DEFAULT_CONTENT)) {
    content[key] = await getSetting(env, key, fallback);
  }

  return {
    country: cfCountry,
    currency,
    locale,
    usdRate: rate,
    promotion,
    ...content,
    content
  };
}

export async function getActivePromotion(env) {
  try {
    const row = await env.DB.prepare(`
      SELECT id, title, slug, badge_text, banner_text, discount_type, discount_value, active, featured, apply_scope
      FROM promotions
      WHERE active = 1
        AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
        AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
      ORDER BY featured DESC, id DESC
      LIMIT 1
    `).first();
    return row || null;
  } catch {
    return null;
  }
}

export function loyaltyTierFromSpend(spend = 0, orders = 0) {
  const paidOrders = Number(orders || 0);
  if (paidOrders >= 160) return { tier: 'Star 5', discountPercent: 10, minOrders: 160, maxOrders: null, level: 5 };
  if (paidOrders >= 80) return { tier: 'Star 4', discountPercent: 7, minOrders: 80, maxOrders: 159, level: 4 };
  if (paidOrders >= 40) return { tier: 'Star 3', discountPercent: 5, minOrders: 40, maxOrders: 79, level: 3 };
  if (paidOrders >= 20) return { tier: 'Star 2', discountPercent: 2, minOrders: 20, maxOrders: 39, level: 2 };
  return { tier: 'Star 1', discountPercent: 0, minOrders: 0, maxOrders: 19, level: 1 };
}

export function loyaltyTierProgress(orders = 0) {
  const paidOrders = Number(orders || 0);
  const current = loyaltyTierFromSpend(0, paidOrders);
  const ladder = [
    { tier: 'Star 1', threshold: 0, discountPercent: 0, level: 1 },
    { tier: 'Star 2', threshold: 20, discountPercent: 2, level: 2 },
    { tier: 'Star 3', threshold: 40, discountPercent: 5, level: 3 },
    { tier: 'Star 4', threshold: 80, discountPercent: 7, level: 4 },
    { tier: 'Star 5', threshold: 160, discountPercent: 10, level: 5 }
  ];
  const next = ladder.find((entry) => entry.threshold > paidOrders) || null;
  if (!next) {
    return {
      current,
      next: null,
      ordersToNext: 0,
      progressPercent: 100,
      currentOrders: paidOrders,
      windowStart: 160,
      windowEnd: 160
    };
  }
  const currentThreshold = ladder[Math.max(0, current.level - 1)].threshold;
  const span = Math.max(1, next.threshold - currentThreshold);
  const progress = Math.max(0, Math.min(100, ((paidOrders - currentThreshold) / span) * 100));
  return {
    current,
    next,
    ordersToNext: Math.max(0, next.threshold - paidOrders),
    progressPercent: Math.round(progress),
    currentOrders: paidOrders,
    windowStart: currentThreshold,
    windowEnd: next.threshold
  };
}

export async function ensureCustomerProfile(env, customerId) {
  if (!customerId) return null;
  await env.DB.prepare(`INSERT OR IGNORE INTO customer_profiles (customer_id) VALUES (?)`).bind(customerId).run();
  const profile = await env.DB.prepare(`SELECT * FROM customer_profiles WHERE customer_id = ? LIMIT 1`).bind(customerId).first();
  return profile || null;
}

export async function refreshCustomerProfile(env, customerId) {
  if (!customerId) return null;
  await ensureCustomerProfile(env, customerId);
  const totals = await env.DB.prepare(`
    SELECT COALESCE(SUM(total - promo_discount - tier_discount), 0) AS spend,
           COUNT(*) AS orders,
           MAX(created_at) AS last_order_at
    FROM orders
    WHERE customer_id = ? AND status = 'paid'
  `).bind(customerId).first();

  const spend = Number(totals?.spend || 0);
  const orders = Number(totals?.orders || 0);
  const tierInfo = loyaltyTierFromSpend(spend, orders);
  const points = Math.floor(spend / 1000);

  await env.DB.prepare(`
    UPDATE customer_profiles
    SET lifetime_spend = ?, paid_orders = ?, loyalty_points = ?, tier_name = ?, tier_discount_percent = ?, last_order_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE customer_id = ?
  `).bind(spend, orders, points, tierInfo.tier, tierInfo.discountPercent, totals?.last_order_at || null, customerId).run();

  return env.DB.prepare(`SELECT * FROM customer_profiles WHERE customer_id = ? LIMIT 1`).bind(customerId).first();
}

export function computeDiscountedPrice(basePrice, promotion = null) {
  const amount = Number(basePrice || 0);
  if (!promotion || !promotion.active) return { price: amount, compareAt: null, savings: 0 };
  let next = amount;
  if (promotion.discount_type === 'percent') next = Math.max(0, amount - (amount * Number(promotion.discount_value || 0) / 100));
  if (promotion.discount_type === 'fixed') next = Math.max(0, amount - Number(promotion.discount_value || 0));
  return { price: Math.round(next), compareAt: amount, savings: Math.max(0, amount - next) };
}

export async function validatePromoCode(env, code, subtotal = 0, tierName = 'Classic') {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return { valid: false, message: 'Promo code is required.' };

  const row = await env.DB.prepare(`
    SELECT * FROM promo_codes
    WHERE code = ?
      AND active = 1
      AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
      AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
    LIMIT 1
  `).bind(normalized).first();

  if (!row) return { valid: false, message: 'Promo code not found or inactive.' };
  if (row.usage_limit && Number(row.used_count || 0) >= Number(row.usage_limit || 0)) {
    return { valid: false, message: 'Promo code usage limit reached.' };
  }
  if (Number(subtotal || 0) < Number(row.min_subtotal || 0)) {
    return { valid: false, message: `Minimum subtotal is ${row.min_subtotal}.` };
  }
  if (row.tier_gate && row.tier_gate !== tierName) {
    return { valid: false, message: `Promo code is reserved for ${row.tier_gate} buyers.` };
  }
  let discount = 0;
  if (row.discount_type === 'percent') discount = Number(subtotal || 0) * Number(row.discount_value || 0) / 100;
  else discount = Number(row.discount_value || 0);
  return {
    valid: true,
    code: row.code,
    row,
    discount: Math.max(0, Math.min(Number(subtotal || 0), Number(discount || 0)))
  };
}

export async function incrementPromoUsage(env, code) {
  if (!code) return;
  await env.DB.prepare(`UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?`).bind(code).run();
}
