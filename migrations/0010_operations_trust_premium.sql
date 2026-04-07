PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS faq_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'general',
  question TEXT NOT NULL,
  answer_html TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  source TEXT NOT NULL DEFAULT 'website',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS launch_drops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  body_html TEXT,
  launch_at TEXT,
  badge_text TEXT,
  hero_image_url TEXT,
  cta_href TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verify_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_code TEXT NOT NULL,
  auth_code_id INTEGER,
  reason TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 10,
  flag_status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auth_code_id) REFERENCES auth_codes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_faq_items_status_sort ON faq_items(status, category, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status, created_at);
CREATE INDEX IF NOT EXISTS idx_launch_drops_status_launch ON launch_drops(status, launch_at);
CREATE INDEX IF NOT EXISTS idx_verify_flags_status ON verify_flags(flag_status, risk_score, created_at);

INSERT OR IGNORE INTO faq_items (category, question, answer_html, sort_order, status) VALUES
('orders', 'How do I track my order?', '<p>Use your order number and email on the order tracking page. Once a shipment is moving, the same page also shows the tracking number, courier updates, and delivery timeline.</p>', 1, 'published'),
('delivery', 'Why was a delivery fee requested after payment?', '<p>Some routes require a separate delivery charge after the main product payment. Any request must be shown clearly inside your order tracking page and paid only through Paystack.</p>', 2, 'published'),
('authenticity', 'How does product verification work?', '<p>Use the verify page to scan the product label or enter the authenticity code manually. Items may show as generated, pending activation, active, or blocked depending on their current state.</p>', 3, 'published'),
('returns', 'How do returns and exchanges work?', '<p>Review the returns and exchange policies in the policy hub, then contact support with your order number before sending any item back.</p>', 4, 'published'),
('community', 'Who can post reviews and comments?', '<p>Signed-in customers can post product reviews, discussions, and community updates. Moderation tools are used to keep the space useful and respectful.</p>', 5, 'published');

INSERT OR IGNORE INTO launch_drops (title, slug, summary, body_html, launch_at, badge_text, cta_href, status) VALUES
('Core Essentials', 'core-essentials', 'Quiet premium basics built for repeat wear, clean layering, and verified originality.', '<p>The Core Essentials drop focuses on durable everyday silhouettes with cleaner proportions, premium fabric handling, and easy pairing across the Lifetime wardrobe.</p>', CURRENT_TIMESTAMP, 'Now live', '/shop.html', 'live');
