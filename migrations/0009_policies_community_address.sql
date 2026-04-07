PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS community_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  product_id INTEGER,
  author_name TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS delivery_address_confirmations (
  order_id INTEGER PRIMARY KEY,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  country TEXT,
  city TEXT,
  address TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(status, created_at);
