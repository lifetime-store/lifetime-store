export async function logAdminAction(env, action, targetType = '', targetId = null, details = null, actor = 'owner') {
  try {
    await env.DB.prepare(`
      INSERT INTO admin_audit_logs (actor, action, target_type, target_id, details)
      VALUES (?, ?, ?, ?, ?)
    `).bind(actor, action, targetType || null, targetId ?? null, details ? JSON.stringify(details) : null).run();
  } catch (error) {
    console.error('Admin audit log failed', error);
  }
}
