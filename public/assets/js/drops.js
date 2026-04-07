import { apiGet, escapeHtml, loadCustomer, renderStorefrontBanner, updateCartCount } from './api.js';

function dropCard(drop) {
  const status = drop.status === 'live' ? 'Live now' : (drop.launch_at ? `Launches ${escapeHtml(drop.launch_at)}` : escapeHtml(drop.status || 'scheduled'));
  return `<article class="panel luxury-panel"><div class="tag-row"><span class="pill">${escapeHtml(drop.badge_text || 'Drop')}</span><span class="pill">${status}</span></div><h2 style="margin-top:.75rem;">${escapeHtml(drop.title || '')}</h2><p class="muted">${escapeHtml(drop.summary || '')}</p><div class="faq-answer">${drop.body_html || ''}</div><div class="hero-actions"><a class="btn btn-primary" href="${escapeHtml(drop.cta_href || '/shop.html')}">Open collection</a></div></article>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  updateCartCount();
  await loadCustomer();
  await renderStorefrontBanner();
  const res = await apiGet('/api/drops');
  const mount = document.querySelector('[data-drop-grid]');
  if (!mount) return;
  mount.innerHTML = res.ok ? (res.drops || []).map(dropCard).join('') || '<div class="empty-state">No drop schedule published yet.</div>' : `<div class="empty-state">${escapeHtml(res.message || 'Could not load drops right now.')}</div>`;
});
