PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  product_id INTEGER,
  variant_id INTEGER,
  product_name TEXT NOT NULL,
  slug TEXT,
  sku TEXT,
  color TEXT,
  size TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, item_key),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_sessions_customer ON customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON customer_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_cart_items_customer ON cart_items(customer_id);
