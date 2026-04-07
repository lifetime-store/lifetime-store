import { apiPost, escapeHtml, getStorefrontMeta, loadCustomer, renderStorefrontBanner, updateCartCount } from "./api.js";
import { mountHumanCheck } from './human-check.js';

function setNotice(target, message, tone = '') {
  if (!target) return;
  target.className = tone ? `notice notice-${tone}` : 'notice';
  target.textContent = message;
}

let supportHuman = { getToken: () => '', reset: () => {} };

async function handleSupportSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const notice = document.querySelector('[data-support-notice]');
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.human_token = supportHuman.getToken();
  setNotice(notice, 'Sending your request…');
  const result = await apiPost('/api/support', payload);
  if (!result.ok) {
    setNotice(notice, result.message || 'Support request failed.', 'danger');
    supportHuman.reset?.();
    return;
  }
  form.reset();
  setNotice(notice, 'Support request sent successfully.', 'success');
}

async function handleAiSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const notice = document.querySelector('[data-ai-support-notice]');
  const answerMount = document.querySelector('[data-ai-support-answer]');
  const question = form.question.value.trim();
  if (!question) return;
  setNotice(notice, 'Thinking…');
  answerMount.innerHTML = '';
  const result = await apiPost('/api/support-ai', { question });
  if (!result.ok) {
    setNotice(notice, result.message || 'Assistant unavailable right now.', 'danger');
    return;
  }
  setNotice(notice, result.source === 'workers-ai' ? 'AI answer ready.' : 'Quick answer ready.');
  answerMount.innerHTML = `<div class="result-card"><div class="eyebrow">${result.source === 'workers-ai' ? 'Lifetime AI' : 'Quick help'}</div><p>${escapeHtml(result.answer || '')}</p></div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  updateCartCount();
  await loadCustomer();
  await renderStorefrontBanner();
  const meta = await getStorefrontMeta();
  const intro = document.querySelector('[data-support-intro]');
  if (intro && meta.content?.support_intro) intro.textContent = meta.content.support_intro;
  supportHuman = await mountHumanCheck(document.querySelector('[data-support-form]') || document.createElement('form'));
  document.querySelector('[data-support-form]')?.addEventListener('submit', handleSupportSubmit);
  document.querySelector('[data-ai-support-form]')?.addEventListener('submit', handleAiSubmit);
});
