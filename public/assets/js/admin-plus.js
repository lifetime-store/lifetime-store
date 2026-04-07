import { apiGet, apiPost, escapeHtml, formatNGN } from './api.js';

function mountNotice(sel, msg, kind='success') { const el = document.querySelector(sel); if (el) el.innerHTML = `<div class="notice notice-${kind}">${msg}</div>`; }

function deliveryCard(row) {
  const payload = encodeURIComponent(JSON.stringify({id: row.id, status: row.status || '', courier_name: row.courier_name || '', delivery_type: row.delivery_type || '', assigned_staff_email: row.assigned_staff_email || '', eta_text: row.eta_text || ''}));
  return `<article class="simple-row simple-row-spaced"><div><strong>${escapeHtml(row.order_number)}</strong><div class="muted">${escapeHtml(row.tracking_number)} · ${escapeHtml(row.courier_name || 'Lifetime Delivery')}</div><div class="muted">${escapeHtml(row.delivery_type)} · ${escapeHtml(row.status)} · ${escapeHtml(row.customer_name || '')}</div>${row.latest_note ? `<div class="muted">${escapeHtml(row.latest_note)}</div>` : ''}</div><div class="admin-actions compact wrap"><button class="btn btn-soft" type="button" data-delivery-update="${payload}">Update</button><button class="btn btn-soft" type="button" data-delivery-fee="${payload}">Add fee</button></div></article>`;
}
function feeCard(row) { return `<article class="simple-row simple-row-spaced"><div><strong>${escapeHtml(row.fee_code)}</strong><div class="muted">${formatNGN(row.amount_ngn || 0)} · ${escapeHtml(row.reason || '')}</div><div class="muted">${escapeHtml(row.status)} · order #${row.order_id}</div></div><div class="admin-actions compact"><span class="pill">${escapeHtml(row.status)}</span></div></article>`; }
function reviewCard(row, kind='review') {
  const title = kind === 'review' ? `${'★'.repeat(Number(row.rating || 0))} ${escapeHtml(row.title || 'Review')}` : escapeHtml(row.author_name || 'Buyer');
  return `<article class="simple-row simple-row-spaced"><div><strong>${title}</strong><div class="muted">${escapeHtml(row.product_name || '')}${row.customer_email ? ` · ${escapeHtml(row.customer_email)}` : ''}</div><div class="muted">${escapeHtml(row.body || '')}</div></div><div class="admin-actions compact wrap"><button class="btn btn-soft" data-review-status="published" data-review-kind="${kind}" data-review-id="${row.id}">Publish</button><button class="btn btn-danger" data-review-status="hidden" data-review-kind="${kind}" data-review-id="${row.id}">Hide</button></div></article>`;
}

async function loadStaffBoard() {
  const mount = document.querySelector('[data-admin-staff]'); if (!mount) return;
  const res = await apiGet('/api/admin/staff', true); if (!res.ok) return;
  mount.innerHTML = (res.staff || []).length ? res.staff.map((staff) => `<article class="simple-row simple-row-spaced"><div><strong>${escapeHtml(staff.full_name)}</strong><div class="muted">${escapeHtml(staff.email)} · ${escapeHtml(staff.role)}</div><div class="muted">${escapeHtml(staff.access_scope || '')}</div></div><div class="admin-actions compact"><span class="pill">${escapeHtml(staff.status || 'active')}</span></div></article>`).join('') : '<div class="empty-state">No staff records yet.</div>';
}

async function loadDeliveries() {
  const mount = document.querySelector('[data-admin-deliveries]'); const feeMount = document.querySelector('[data-admin-delivery-fees]'); if (!mount) return;
  const res = await apiGet('/api/admin/deliveries', true);
  if (!res.ok) { mount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || 'Could not load deliveries.')}</div>`; return; }
  mount.innerHTML = (res.deliveries || []).length ? res.deliveries.slice(0,50).map(deliveryCard).join('') : '<div class="empty-state">No deliveries yet.</div>';
  if (feeMount) feeMount.innerHTML = (res.feeRequests || []).length ? res.feeRequests.slice(0,50).map(feeCard).join('') : '<div class="empty-state">No delivery fee requests yet.</div>';
  mount.querySelectorAll('[data-delivery-update]').forEach((btn) => btn.addEventListener('click', async () => {
    const data = JSON.parse(decodeURIComponent(btn.dataset.deliveryUpdate));
    const status = window.prompt('New delivery status', data.status || 'processing'); if (!status) return;
    const note = window.prompt('Checkpoint note', 'Updated by delivery team.') || '';
    const location = window.prompt('Location / hub / city', '') || '';
    const courier = window.prompt('Courier/service name', data.courier_name || 'Lifetime Delivery') || data.courier_name;
    const type = window.prompt('Delivery type: local / interstate / international', data.delivery_type || 'local') || data.delivery_type;
    const eta = window.prompt('Estimated arrival text', data.eta_text || '') || data.eta_text;
    const staff = window.prompt('Assigned staff email', data.assigned_staff_email || '') || data.assigned_staff_email;
    const result = await apiPost('/api/admin/deliveries', { action: 'update_status', delivery_id: data.id, status, note, location_label: location, courier_name: courier, delivery_type: type, eta_text: eta, assigned_staff_email: staff }, true);
    mountNotice('[data-delivery-notice]', escapeHtml(result.message || 'Updated.'), result.ok ? 'success' : 'danger');
    if (result.ok) await loadDeliveries();
  }));
  mount.querySelectorAll('[data-delivery-fee]').forEach((btn) => btn.addEventListener('click', async () => {
    const data = JSON.parse(decodeURIComponent(btn.dataset.deliveryFee));
    const amount = window.prompt('Delivery fee amount in NGN', '5000'); if (!amount) return;
    const reason = window.prompt('Reason for this delivery fee request', 'Delivery charge for your route') || 'Delivery charge';
    const result = await apiPost('/api/admin/deliveries', { action: 'create_fee_request', delivery_id: data.id, amount_ngn: Number(amount), reason, created_by: 'delivery-team' }, true);
    mountNotice('[data-delivery-notice]', escapeHtml(result.message || 'Updated.'), result.ok ? 'success' : 'danger');
    if (result.ok) await loadDeliveries();
  }));
}

async function loadReviewsBoard() {
  const reviewMount = document.querySelector('[data-admin-reviews]'); const discussionMount = document.querySelector('[data-admin-discussions]'); if (!reviewMount) return;
  const res = await apiGet('/api/admin/reviews', true);
  if (!res.ok) { reviewMount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || 'Could not load reviews.')}</div>`; return; }
  reviewMount.innerHTML = (res.reviews || []).length ? res.reviews.slice(0,40).map((row) => reviewCard(row, 'review')).join('') : '<div class="empty-state">No reviews yet.</div>';
  if (discussionMount) discussionMount.innerHTML = (res.discussions || []).length ? res.discussions.slice(0,40).map((row) => reviewCard(row, 'discussion')).join('') : '<div class="empty-state">No comments yet.</div>';
  document.querySelectorAll('[data-review-status]').forEach((btn) => btn.addEventListener('click', async () => {
    const result = await apiPost('/api/admin/reviews', { id: Number(btn.dataset.reviewId), status: btn.dataset.reviewStatus, kind: btn.dataset.reviewKind }, true);
    mountNotice('[data-review-notice]', escapeHtml(result.message || 'Updated.'), result.ok ? 'success' : 'danger');
    if (result.ok) await loadReviewsBoard();
  }));
}

document.addEventListener('DOMContentLoaded', () => setTimeout(() => { loadStaffBoard(); loadDeliveries(); loadReviewsBoard(); }, 500));
