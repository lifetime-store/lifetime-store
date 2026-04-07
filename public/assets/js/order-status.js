import { apiGet, apiPost, escapeHtml, formatNGN } from './api.js';

function setNotice(html='') { const el = document.querySelector('[data-order-track-notice]'); if (el) el.innerHTML = html; }

function deliveryFeeBlock(order, fees = []) {
  if (!fees.length) return '';
  const latest = fees[0];
  return `<article><strong>Delivery fee</strong><p class="muted">${escapeHtml(latest.status)} · ${formatNGN(latest.amount_ngn || 0)} · ${escapeHtml(latest.reason || '')}</p>${latest.status !== 'paid' ? `<button class="btn btn-primary" type="button" data-pay-delivery-fee="${escapeHtml(latest.fee_code)}">Pay delivery fee</button>` : '<span class="pill">Paid</span>'}</article>`;
}

function renderHistory(order, history = [], delivery = null, deliveryHistory = [], deliveryFees = []) {
  const mount = document.querySelector('[data-order-track-result]');
  if (!mount) return;
  const timeline = history.length ? history.map(step => `<li><strong>${escapeHtml(step.status)}</strong><span class="muted">${escapeHtml(step.created_at || '')}</span>${step.note ? `<p class="muted">${escapeHtml(step.note)}</p>` : ''}</li>`).join('') : `<li><strong>${escapeHtml(order.status)}</strong><span class="muted">Current status</span></li>`;
  const deliveryTimeline = deliveryHistory.length ? deliveryHistory.map(step => `<li><strong>${escapeHtml(step.status)}</strong><span class="muted">${escapeHtml(step.location_label || '')} · ${escapeHtml(step.created_at || '')}</span>${step.note ? `<p class="muted">${escapeHtml(step.note)}</p>` : ''}</li>`).join('') : '<li><strong>Awaiting dispatch updates</strong></li>';
  mount.innerHTML = `
    <section class="panel luxury-panel">
      <div class="eyebrow">Order result</div>
      <h2>${escapeHtml(order.order_number)}</h2>
      <div class="details-list compact-grid">
        <article><strong>Order status</strong><p class="muted">${escapeHtml(order.status)}</p></article>
        <article><strong>Total</strong><p class="muted">${formatNGN(order.total || 0)}</p></article>
        <article><strong>Email</strong><p class="muted">${escapeHtml(order.email)}</p></article>
        <article><strong>Placed</strong><p class="muted">${escapeHtml(order.created_at || '')}</p></article>
        ${delivery ? `<article><strong>Tracking</strong><p class="muted">${escapeHtml(delivery.tracking_number)}</p></article>` : ''}
        ${delivery ? `<article><strong>Courier</strong><p class="muted">${escapeHtml(delivery.courier_name || 'Lifetime Delivery')}</p></article>` : ''}
        ${delivery ? `<article><strong>Delivery</strong><p class="muted">${escapeHtml(delivery.status || 'payment_confirmed')}</p></article>` : ''}
        ${delivery ? `<article><strong>ETA</strong><p class="muted">${escapeHtml(delivery.eta_text || 'Will appear after dispatch')}</p></article>` : ''}
        ${deliveryFeeBlock(order, deliveryFees)}
      </div>
      <div class="divider"></div>
      <div class="split-grid">
        <div><div class="eyebrow">Order timeline</div><ol class="timeline-list">${timeline}</ol></div>
        <div><div class="eyebrow">Delivery timeline</div><ol class="timeline-list">${deliveryTimeline}</ol></div>
      </div>
    </section>`;
  mount.querySelector('[data-pay-delivery-fee]')?.addEventListener('click', async (event) => {
    const feeCode = event.currentTarget.dataset.payDeliveryFee;
    const res = await apiPost('/api/paystack/delivery-fee-pay', { fee_code: feeCode });
    if (!res.ok) { alert(res.message || 'Could not open delivery fee payment.'); return; }
    window.location.href = res.authorizationUrl;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('[data-order-track-form]');
  const params = new URLSearchParams(window.location.search);
  if (params.get('order')) {
    form.querySelector('[name="order_number"]').value = params.get('order') || '';
    form.querySelector('[name="email"]').value = params.get('email') || '';
  }
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const identifier = String(fd.get('order_number') || '').trim();
    const email = String(fd.get('email') || '').trim();
    if (!identifier) { setNotice('<div class="notice notice-danger">Order number or tracking number is required.</div>'); return; }
    setNotice('');
    const result = await apiGet(`/api/order-status/${encodeURIComponent(identifier)}${email ? `?email=${encodeURIComponent(email)}` : ''}`);
    if (!result.ok) { setNotice(`<div class="notice notice-danger">${escapeHtml(result.message || 'Order not found.')}</div>`); return; }
    renderHistory(result.order, result.history || [], result.delivery || null, result.deliveryHistory || [], result.deliveryFees || []);
  });
  if (params.get('order')) form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
});
