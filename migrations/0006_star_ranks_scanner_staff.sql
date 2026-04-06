PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'operations',
  status TEXT NOT NULL DEFAULT 'active',
  access_scope TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL DEFAULT 'owner',
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES
('loyalty_rank_model_json', '{"Star 1":{"min_orders":0,"discount":0},"Star 2":{"min_orders":20,"discount":2},"Star 3":{"min_orders":40,"discount":5},"Star 4":{"min_orders":80,"discount":7},"Star 5":{"min_orders":160,"discount":10}}', CURRENT_TIMESTAMP),
('verify_scanner_hint', 'Open the Verify page in Safari or Chrome for live label scan after batch activation.', CURRENT_TIMESTAMP);
