PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS wishlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  variant_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, item_key),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS restock_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  variant_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wishlist_customer ON wishlist_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_restock_status ON restock_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id, created_at);

INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES
('hero_eyebrow', 'Quiet premium daily wear', CURRENT_TIMESTAMP),
('hero_title', 'Refined essentials built to outlast noise.', CURRENT_TIMESTAMP),
('hero_copy', 'Lifetime creates premium essentials with clean structure, durable fabric, and verified authenticity.', CURRENT_TIMESTAMP),
('hero_cta_label', 'Shop collection', CURRENT_TIMESTAMP),
('hero_cta_href', '/shop.html', CURRENT_TIMESTAMP),
('shipping_policy_html', '<h2>Shipping</h2><p>Orders are processed after payment verification. Delivery timing depends on destination and stock readiness.</p><ul><li>Processing: 1–3 business days</li><li>Local delivery: typically 2–7 business days</li><li>International delivery: timing varies by location and customs handling</li></ul>', CURRENT_TIMESTAMP),
('returns_policy_html', '<h2>Returns</h2><p>Items must be unworn, clean, and returned in original condition. Contact support before sending any return.</p><ul><li>Return window: 7 days after delivery unless marked final sale</li><li>Incorrect or damaged items should be reported quickly</li></ul>', CURRENT_TIMESTAMP),
('exchange_policy_html', '<h2>Exchanges</h2><p>Size or color exchange requests depend on stock availability. Contact support with your order number and requested replacement.</p>', CURRENT_TIMESTAMP),
('size_guide_html', '<h2>Size guide</h2><table><tr><th>Size</th><th>Chest</th><th>Length</th></tr><tr><td>S</td><td>36–38 in</td><td>27 in</td></tr><tr><td>M</td><td>39–41 in</td><td>28 in</td></tr><tr><td>L</td><td>42–44 in</td><td>29 in</td></tr><tr><td>XL</td><td>45–47 in</td><td>30 in</td></tr></table><p>Use garment measurements and fit notes for the best match.</p>', CURRENT_TIMESTAMP),
('collection_intro', 'Explore edited collections, seasonal drops, and core essentials.', CURRENT_TIMESTAMP),
('store_notice_badge', 'Store update', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO NOTHING;
