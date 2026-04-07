import { apiGet, apiPost, escapeHtml } from './api.js';

function notice(target, msg, tone='success') {
  const mount = document.querySelector(target);
  if (!mount) return;
  mount.innerHTML = `<div class="notice notice-${tone}">${msg}</div>`;
}
function simpleBlock(title, value, detail='') { return `<article class="simple-row simple-row-spaced"><div><strong>${escapeHtml(title)}</strong><div class="muted">${escapeHtml(detail)}</div></div><div class="pill">${escapeHtml(String(value))}</div></article>`; }
function faqCard(item) { return `<article class="simple-row simple-row-spaced"><div><strong>${escapeHtml(item.question || '')}</strong><div class="muted">${escapeHtml(item.category || 'general')}</div></div><div class="admin-actions compact wrap"><button class="btn btn-soft" data-faq-edit='${encodeURIComponent(JSON.stringify(item))}'>Edit</button><button class="btn btn-danger" data-faq-delete='${item.id}'>Delete</button></div></article>`; }
function dropCard(item) { return `<article class="simple-row simple-row-spaced"><div><strong>${escapeHtml(item.title || '')}</strong><div class="muted">${escapeHtml(item.status || '')} · ${escapeHtml(item.launch_at || '')}</div></div><div class="admin-actions compact wrap"><button class="btn btn-soft" data-drop-edit='${encodeURIComponent(JSON.stringify(item))}'>Edit</button><button class="btn btn-danger" data-drop-delete='${item.id}'>Delete</button></div></article>`; }
function exportLink(type, label) { return `<a class="btn btn-soft" href="/api/admin/exports?type=${encodeURIComponent(type)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`; }

async function loadReports() {
  const res = await apiGet('/api/admin/reports', true);
  const mount = document.querySelector('[data-admin-reports]');
  if (!mount) return;
  if (!res.ok) { mount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || 'Could not load reports.')}</div>`; return; }
  const blocks = [];
  blocks.push(simpleBlock('Revenue', `₦${Number(res.summary?.revenue_ngn || 0).toLocaleString()}`, `${Number(res.summary?.paid_orders || 0)} paid orders`));
  blocks.push(simpleBlock('Low stock', res.summary?.low_stock_variants || 0, 'Variants with stock at 5 or below'));
  blocks.push(simpleBlock('Open support', res.summary?.open_issues || 0, 'Open issues needing follow-up'));
  blocks.push(simpleBlock('Pending delivery fees', res.summary?.pending_delivery_fees || 0, 'Requested and not yet paid'));
  blocks.push(simpleBlock('Restock requests', res.summary?.restock_requests || 0, 'Customer restock interest'));
  blocks.push(simpleBlock('Newsletter', res.summary?.newsletter_subscribers || 0, 'Active subscribers'));
  mount.innerHTML = blocks.join('') + `<div class="divider"></div><div class="grid-2 compact-grid">${(res.topProducts || []).map((row) => `<article class="simple-row"><strong>${escapeHtml(row.product_name || '')}</strong><div class="muted">${Number(row.units_sold || 0)} unit(s) sold</div></article>`).join('') || '<div class="empty-state">No product sales yet.</div>'}</div>`;
  const tierMount = document.querySelector('[data-admin-tier-breakdown]');
  if (tierMount) tierMount.innerHTML = (res.tiers || []).map((row) => simpleBlock(row.tier_name || 'Star 1', row.total || 0, `${row.discount || 0}% auto discount`)).join('') || '<div class="empty-state">No customer tier data yet.</div>';
}

async function loadNotifications() {
  const res = await apiGet('/api/admin/notifications', true);
  const mount = document.querySelector('[data-admin-notifications]');
  if (!mount) return;
  if (!res.ok) { mount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || 'Could not load notifications.')}</div>`; return; }
  mount.innerHTML = (res.items || []).length ? res.items.map((item) => `<article class="simple-row"><strong>${escapeHtml(item.title || '')}</strong><div class="muted">${escapeHtml(item.body || '')}</div></article>`).join('') : '<div class="empty-state">No urgent alerts right now.</div>';
}

async function loadFaqAdmin() {
  const res = await apiGet('/api/admin/faq', true);
  const mount = document.querySelector('[data-admin-faq]');
  if (!mount) return;
  mount.innerHTML = res.ok ? ((res.items || []).map(faqCard).join('') || '<div class="empty-state">No FAQ items yet.</div>') : `<div class="empty-state">${escapeHtml(res.message || 'Could not load FAQ.')}</div>`;
  mount.querySelectorAll('[data-faq-edit]').forEach((btn) => btn.addEventListener('click', () => {
    const item = JSON.parse(decodeURIComponent(btn.dataset.faqEdit));
    const form = document.querySelector('[data-faq-form]');
    if (!form) return;
    form.faq_id.value = item.id || '';
    form.category.value = item.category || 'general';
    form.question.value = item.question || '';
    form.answer_html.value = item.answer_html || '';
    form.sort_order.value = item.sort_order || 0;
    form.status.value = item.status || 'published';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  mount.querySelectorAll('[data-faq-delete]').forEach((btn) => btn.addEventListener('click', async () => {
    const result = await apiPost('/api/admin/faq', { action: 'delete', id: Number(btn.dataset.faqDelete) }, true);
    notice('[data-faq-notice]', escapeHtml(result.message || 'Saved.'), result.ok ? 'success' : 'danger');
    if (result.ok) loadFaqAdmin();
  }));
}

async function loadDropsAdmin() {
  const res = await apiGet('/api/admin/drops', true);
  const mount = document.querySelector('[data-admin-drops]');
  if (!mount) return;
  mount.innerHTML = res.ok ? ((res.drops || []).map(dropCard).join('') || '<div class="empty-state">No launch drops yet.</div>') : `<div class="empty-state">${escapeHtml(res.message || 'Could not load drops.')}</div>`;
  mount.querySelectorAll('[data-drop-edit]').forEach((btn) => btn.addEventListener('click', () => {
    const item = JSON.parse(decodeURIComponent(btn.dataset.dropEdit));
    const form = document.querySelector('[data-drop-form]');
    if (!form) return;
    form.drop_id.value = item.id || '';
    form.title.value = item.title || '';
    form.slug.value = item.slug || '';
    form.summary.value = item.summary || '';
    form.body_html.value = item.body_html || '';
    form.launch_at.value = item.launch_at ? String(item.launch_at).slice(0,16) : '';
    form.badge_text.value = item.badge_text || '';
    form.cta_href.value = item.cta_href || '/shop.html';
    form.status.value = item.status || 'scheduled';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  mount.querySelectorAll('[data-drop-delete]').forEach((btn) => btn.addEventListener('click', async () => {
    const result = await apiPost('/api/admin/drops', { action: 'delete', id: Number(btn.dataset.dropDelete) }, true);
    notice('[data-drops-notice]', escapeHtml(result.message || 'Saved.'), result.ok ? 'success' : 'danger');
    if (result.ok) loadDropsAdmin();
  }));
}

async function loadVerifyFlags() {
  const res = await apiGet('/api/admin/verify-flags', true);
  const mount = document.querySelector('[data-admin-verify-flags]');
  if (!mount) return;
  mount.innerHTML = res.ok ? ((res.flags || []).map((row) => simpleBlock(row.serial_code || 'Unknown code', row.scan_count || 0, row.reason || 'Suspicious verification pattern')).join('') || '<div class="empty-state">No suspicious verification patterns found.</div>') : `<div class="empty-state">${escapeHtml(res.message || 'Could not load suspicious scans.')}</div>`;
}

async function bindForms() {
  document.querySelector('[data-faq-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const result = await apiPost('/api/admin/faq', Object.fromEntries(fd.entries()), true);
    notice('[data-faq-notice]', escapeHtml(result.message || 'Saved.'), result.ok ? 'success' : 'danger');
    if (result.ok) { event.currentTarget.reset(); await loadFaqAdmin(); }
  });
  document.querySelector('[data-drop-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const result = await apiPost('/api/admin/drops', Object.fromEntries(fd.entries()), true);
    notice('[data-drops-notice]', escapeHtml(result.message || 'Saved.'), result.ok ? 'success' : 'danger');
    if (result.ok) { event.currentTarget.reset(); await loadDropsAdmin(); }
  });
  const exportsMount = document.querySelector('[data-admin-exports]');
  if (exportsMount) exportsMount.innerHTML = [exportLink('products', 'Export products'), exportLink('orders', 'Export orders'), exportLink('customers', 'Export customers'), exportLink('deliveries', 'Export deliveries'), exportLink('newsletter', 'Export newsletter')].join(' ');
}

document.addEventListener('DOMContentLoaded', () => setTimeout(() => { bindForms(); loadReports(); loadNotifications(); loadFaqAdmin(); loadDropsAdmin(); loadVerifyFlags(); }, 700));
