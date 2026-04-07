import { apiGet, apiPost, escapeHtml, loadCustomer, renderStorefrontBanner, updateCartCount } from './api.js';
import { mountHumanCheck } from './human-check.js';

function faqCard(item) {
  return `<details class="faq-item"><summary>${escapeHtml(item.question || '')}</summary><div class="faq-answer">${item.answer_html || ''}</div></details>`;
}
function notice(message = '', tone = '') {
  const mount = document.querySelector('[data-newsletter-notice]');
  if (!mount) return;
  mount.className = tone ? `notice notice-${tone}` : 'notice';
  mount.textContent = message;
}

document.addEventListener('DOMContentLoaded', async () => {
  updateCartCount();
  await loadCustomer();
  await renderStorefrontBanner();
  const [faqRes, human] = await Promise.all([apiGet('/api/faq'), mountHumanCheck(document.querySelector('[data-newsletter-form]'))]);
  const list = document.querySelector('[data-faq-list]');
  if (list) list.innerHTML = faqRes.ok ? (faqRes.items || []).map(faqCard).join('') || '<div class="empty-state">No FAQ items yet.</div>' : `<div class="empty-state">${escapeHtml(faqRes.message || 'Could not load FAQ right now.')}</div>`;
  document.querySelector('[data-newsletter-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const result = await apiPost('/api/newsletter', { full_name: String(fd.get('full_name') || ''), email: String(fd.get('email') || ''), human_token: human.getToken() });
    if (!result.ok) {
      notice(result.message || 'Could not save your subscription.', 'danger');
      human.reset?.();
      return;
    }
    form.reset();
    notice(result.message || 'Subscription saved.', 'success');
  });
});
