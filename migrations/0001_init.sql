
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  short_code TEXT NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  price_ngn INTEGER NOT NULL,
  price_usd REAL NOT NULL,
  materials TEXT,
  fit_notes TEXT,
  care TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  color_code TEXT NOT NULL,
  size TEXT NOT NULL,
  size_code TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  price_ngn INTEGER,
  price_usd REAL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_code TEXT NOT NULL UNIQUE,
  product_id INTEGER NOT NULL,
  variant_id INTEGER,
  factory_name TEXT,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  manufactured_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS auth_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  variant_id INTEGER,
  sequence INTEGER NOT NULL,
  serial_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  first_scan_at TEXT,
  scan_count INTEGER NOT NULL DEFAULT 0,
  activated_at TEXT,
  qr_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_code TEXT,
  order_id INTEGER,
  issue_type TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  city TEXT,
  address TEXT,
  notes TEXT,
  currency TEXT NOT NULL DEFAULT 'NGN',
  subtotal REAL NOT NULL,
  shipping REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  variant_id INTEGER,
  product_name TEXT NOT NULL,
  sku TEXT,
  size TEXT,
  color TEXT,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_auth_codes_serial_code ON auth_codes(serial_code);
CREATE INDEX IF NOT EXISTS idx_auth_codes_batch_id ON auth_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

INSERT OR IGNORE INTO products (
  slug, short_code, name, tagline, category, description, price_ngn, price_usd, materials, fit_notes, care, active, featured
) VALUES
(
  'core-tee',
  'TEE',
  'Lifetime Core Tee',
  'Structured everyday essential.',
  'T-Shirt',
  'Heavyweight plain tee with quiet premium finishing, clean neckline, and low-visible brand identity.',
  15000,
  10.9,
  'Premium cotton jersey',
  'Slightly relaxed premium fit.',
  'Cold wash. Do not bleach. Iron inside out.',
  1,
  1
),
(
  'premium-polo',
  'POL',
  'Lifetime Premium Polo',
  'Mature everyday statement.',
  'Polo',
  'Dense premium polo made for daily wear, clean presence, and long-term repeat use.',
  22000,
  15.9,
  'Premium cotton pique',
  'Refined regular fit with room for comfort.',
  'Cold wash. Hang dry. Cool iron.',
  1,
  1
),
(
  'signature-hoodie',
  'HOD',
  'Lifetime Signature Hoodie',
  'Quiet heavyweight comfort.',
  'Hoodie',
  'Heavyweight fleece hoodie with subtle finishing, clean silhouette, and premium everyday feel.',
  35000,
  25.3,
  'Heavyweight brushed fleece',
  'Relaxed premium fit.',
  'Cold wash. Hang dry. Avoid high heat.',
  1,
  1
);

INSERT OR IGNORE INTO variants (product_id, sku, color, color_code, size, size_code, stock, price_ngn, price_usd, active)
SELECT p.id, 'LT-TEE-BLK-M', 'Black', 'BLK', 'M', 'M', 25, 15000, 10.9, 1 FROM products p WHERE p.slug = 'core-tee';
INSERT OR IGNORE INTO variants (product_id, sku, color, color_code, size, size_code, stock, price_ngn, price_usd, active)
SELECT p.id, 'LT-TEE-CRM-M', 'Cream', 'CRM', 'M', 'M', 25, 15000, 10.9, 1 FROM products p WHERE p.slug = 'core-tee';
INSERT OR IGNORE INTO variants (product_id, sku, color, color_code, size, size_code, stock, price_ngn, price_usd, active)
SELECT p.id, 'LT-POL-BLK-M', 'Black', 'BLK', 'M', 'M', 18, 22000, 15.9, 1 FROM products p WHERE p.slug = 'premium-polo';
INSERT OR IGNORE INTO variants (product_id, sku, color, color_code, size, size_code, stock, price_ngn, price_usd, active)
SELECT p.id, 'LT-POL-STN-M', 'Stone', 'STN', 'M', 'M', 18, 22000, 15.9, 1 FROM products p WHERE p.slug = 'premium-polo';
INSERT OR IGNORE INTO variants (product_id, sku, color, color_code, size, size_code, stock, price_ngn, price_usd, active)
SELECT p.id, 'LT-HOD-CHR-M', 'Charcoal', 'CHR', 'M', 'M', 12, 35000, 25.3, 1 FROM products p WHERE p.slug = 'signature-hoodie';
INSERT OR IGNORE INTO variants (product_id, sku, color, color_code, size, size_code, stock, price_ngn, price_usd, active)
SELECT p.id, 'LT-HOD-BLK-L', 'Black', 'BLK', 'L', 'L', 12, 35000, 25.3, 1 FROM products p WHERE p.slug = 'signature-hoodie';
