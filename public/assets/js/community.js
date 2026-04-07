import { apiGet, apiPost, escapeHtml } from './api.js';
import { mountHumanCheck } from './human-check.js';

function postCard(post) {
  const product = post.product_name ? `<div class="muted">${escapeHtml(post.product_name)}${post.product_slug ? ` · <a href="/product.html?slug=${encodeURIComponent(post.product_slug)}">Open product</a>` : ''}</div>` : '<div class="muted">General Lifetime discussion</div>';
  const title = post.title ? `<strong>${escapeHtml(post.title)}</strong>` : '<strong>Community post</strong>';
  return `<article class="community-post"><div class="tag-row"><span class="pill">${escapeHtml(post.author_name || 'Customer')}</span><span class="pill">${escapeHtml(post.created_at || '')}</span></div>${product}<div style="margin:.35rem 0;">${title}</div><div class="muted">${escapeHtml(post.body || '')}</div></article>`;
}

function notice(html='') { const el = document.querySelector('[data-community-notice]'); if (el) el.innerHTML = html; }

async function loadCommunity() {
  const mount = document.querySelector('[data-community-feed]');
  const picker = document.querySelector('[data-community-product-list]');
  if (!mount) return;
  const data = await apiGet('/api/community');
  if (!data.ok) { mount.innerHTML = `<div class="empty-state">${escapeHtml(data.message || 'Could not load community right now.')}</div>`; return; }
  mount.innerHTML = (data.posts || []).length ? data.posts.map(postCard).join('') : '<div class="empty-state">No community posts yet. Signed-in buyers can start the channel.</div>';
  if (picker) picker.innerHTML = `<option value="">General Lifetime discussion</option>${(data.products || []).map((p) => `<option value="${escapeHtml(p.slug)}">${escapeHtml(p.name)}</option>`).join('')}`;
}

let communityHuman = { getToken: () => '', reset: () => {} };

document.addEventListener('DOMContentLoaded', async () => {
  communityHuman = await mountHumanCheck(document.querySelector('[data-community-form]') || document.createElement('form'));
  loadCommunity();
  document.querySelector('[data-community-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const result = await apiPost('/api/community', { product_slug: String(fd.get('product_slug') || ''), title: String(fd.get('title') || ''), body: String(fd.get('body') || ''), human_token: communityHuman.getToken() });
    if (!result.ok) { notice(`<div class="notice notice-danger">${escapeHtml(result.message || 'Could not post right now.')}</div>`); communityHuman.reset?.(); return; }
    notice(`<div class="notice notice-success">${escapeHtml(result.message || 'Posted.')}</div>`);
    event.currentTarget.reset();
    loadCommunity();
  });
});
