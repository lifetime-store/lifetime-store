PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  badge_text TEXT,
  banner_text TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value REAL NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  apply_scope TEXT NOT NULL DEFAULT 'storewide',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promotion_id INTEGER,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value REAL NOT NULL DEFAULT 0,
  min_subtotal REAL NOT NULL DEFAULT 0,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  tier_gate TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customer_profiles (
  customer_id INTEGER PRIMARY KEY,
  lifetime_spend REAL NOT NULL DEFAULT 0,
  paid_orders INTEGER NOT NULL DEFAULT 0,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  tier_name TEXT NOT NULL DEFAULT 'Classic',
  tier_discount_percent REAL NOT NULL DEFAULT 0,
  last_order_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

ALTER TABLE products ADD COLUMN compare_at_ngn INTEGER;
ALTER TABLE products ADD COLUMN compare_at_usd REAL;
ALTER TABLE products ADD COLUMN collection_label TEXT;
ALTER TABLE products ADD COLUMN mood_label TEXT;

ALTER TABLE variants ADD COLUMN compare_at_ngn INTEGER;
ALTER TABLE variants ADD COLUMN compare_at_usd REAL;

ALTER TABLE orders ADD COLUMN promo_code TEXT;
ALTER TABLE orders ADD COLUMN promo_discount REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN tier_discount REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN customer_id INTEGER;
ALTER TABLE orders ADD COLUMN country_code TEXT;
ALTER TABLE orders ADD COLUMN currency_rate REAL NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active, featured, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code, active);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_tier ON customer_profiles(tier_name);

INSERT OR IGNORE INTO site_settings (key, value) VALUES
('store_notice', 'Worldwide pricing preview adjusts to the shopper region. Final settlement is completed securely in NGN at checkout.'),
('usd_rates_json', '{"USD":1,"NGN":1550,"EUR":0.92,"GBP":0.79,"CAD":1.36,"AUD":1.52,"AED":3.67,"ZAR":18.6,"KES":130,"GHS":15.5,"XOF":610}'),
('country_currency_json', '{"NG":"NGN","US":"USD","GB":"GBP","CA":"CAD","AU":"AUD","AE":"AED","ZA":"ZAR","KE":"KES","GH":"GHS","FR":"EUR","DE":"EUR","ES":"EUR","IT":"EUR","NL":"EUR","BE":"EUR","IE":"EUR","PT":"EUR","CI":"XOF","SN":"XOF"}');

INSERT OR IGNORE INTO promotions (
  title, slug, badge_text, banner_text, discount_type, discount_value, active, featured, apply_scope
) VALUES (
  'Launch Week',
  'launch-week',
  'Launch offer',
  'Launch week is live — selected essentials now carry a limited event discount and stackable buyer perks.',
  'percent',
  10,
  1,
  1,
  'storewide'
);

INSERT OR IGNORE INTO promo_codes (
  promotion_id, code, discount_type, discount_value, min_subtotal, usage_limit, tier_gate, active
)
SELECT id, 'LIFETIME10', 'percent', 10, 25000, 500, NULL, 1
FROM promotions
WHERE slug = 'launch-week';
