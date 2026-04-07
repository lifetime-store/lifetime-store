
import { apiGet, escapeHtml, formatNGN } from './api.js';

function setNotice(html='') { const el = document.querySelector('[data-order-track-notice]'); if (el) el.innerHTML = html; }
function renderHistory(order, history=[]) {
  const mount = document.querySelector('[data-order-track-result]');
  if (!mount) return;
  const timeline = history.length ? history.map(step => `<li><strong>${escapeHtml(step.status)}</strong><span class="muted">${escapeHtml(step.created_at || '')}</span>${step.note ? `<p class="muted">${escapeHtml(step.note)}</p>` : ''}</li>`).join('') : `<li><strong>${escapeHtml(order.status)}</strong><span class="muted">Current status</span></li>`;
  mount.innerHTML = `
    <section class="panel luxury-panel">
      <div class="eyebrow">Order result</div>
      <h2>${escapeHtml(order.order_number)}</h2>
      <div class="details-list compact-grid">
        <article><strong>Status</strong><p class="muted">${escapeHtml(order.status)}</p></article>
        <article><strong>Total</strong><p class="muted">${formatNGN(order.total || 0)}</p></article>
        <article><strong>Email</strong><p class="muted">${escapeHtml(order.email)}</p></article>
        <article><strong>Placed</strong><p class="muted">${escapeHtml(order.created_at || '')}</p></article>
      </div>
      <div class="divider"></div>
      <ol class="timeline-list">${timeline}</ol>
    </section>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('[data-order-track-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const orderNumber = String(fd.get('order_number') || '').trim();
    const email = String(fd.get('email') || '').trim();
    if (!orderNumber || !email) { setNotice('<div class="notice notice-danger">Order number and email are required.</div>'); return; }
    setNotice('');
    const result = await apiGet(`/api/order-status/${encodeURIComponent(orderNumber)}?email=${encodeURIComponent(email)}`);
    if (!result.ok) { setNotice(`<div class="notice notice-danger">${escapeHtml(result.message || 'Order not found.')}</div>`); return; }
    renderHistory(result.order, result.history || []);
  });
});
