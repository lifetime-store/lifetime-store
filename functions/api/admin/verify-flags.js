import { requireAdmin } from '../../_lib/auth.js';
import { ok, optionsResponse } from '../../_lib/response.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context); if (unauthorized) return unauthorized;
  const { results } = await context.env.DB.prepare(`
    SELECT serial_code, COUNT(*) AS scan_count,
      CASE
        WHEN COUNT(*) >= 8 THEN 'High repeated scan count detected.'
        WHEN COUNT(*) >= 4 THEN 'Repeated verification activity detected.'
        ELSE 'Monitor code activity.'
      END AS reason
    FROM verification_logs
    WHERE serial_code IS NOT NULL AND serial_code != ''
    GROUP BY serial_code
    HAVING COUNT(*) >= 4
    ORDER BY scan_count DESC, serial_code ASC
    LIMIT 50
  `).all();
  for (const row of results || []) {
    await context.env.DB.prepare(`INSERT OR IGNORE INTO verify_flags (serial_code, reason, risk_score, flag_status) VALUES (?, ?, ?, 'open')`).bind(row.serial_code, row.reason, Number(row.scan_count || 0) * 10).run();
  }
  return ok({ flags: results || [] });
}
