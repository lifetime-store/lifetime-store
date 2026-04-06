PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS label_print_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  format TEXT NOT NULL DEFAULT 'hangtag',
  label_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'printed',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  auth_code_id INTEGER,
  serial_code TEXT NOT NULL,
  result TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'public_verify',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auth_code_id) REFERENCES auth_codes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_label_print_jobs_batch_id ON label_print_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_serial_code ON verification_logs(serial_code);
CREATE INDEX IF NOT EXISTS idx_verification_logs_auth_code_id ON verification_logs(auth_code_id);
