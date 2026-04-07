import { getStorefrontMeta } from './api.js';

let scriptPromise = null;
function loadScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function mountHumanCheck(form) {
  const meta = await getStorefrontMeta();
  const siteKey = meta.turnstileSiteKey || '';
  if (!siteKey) return { enabled: false, getToken: () => '' };
  await loadScript();
  let mount = form.querySelector('[data-human-check]');
  if (!mount) {
    mount = document.createElement('div');
    mount.dataset.humanCheck = '1';
    mount.className = 'human-check-slot';
    form.appendChild(mount);
  }
  const widgetId = window.turnstile.render(mount, { sitekey: siteKey, theme: 'dark', appearance: 'always' });
  return {
    enabled: true,
    getToken: () => window.turnstile.getResponse(widgetId) || '',
    reset: () => window.turnstile.reset(widgetId)
  };
}
