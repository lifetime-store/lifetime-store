const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop.html' },
  { label: 'About', href: '/about.html' },
  { label: 'Verify', href: '/verify.html' },
  { label: 'Policies', href: '/policies.html' },
  { label: 'Track Order', href: '/order-status.html' },
  { label: 'Support', href: '/support.html' },
  { label: 'Community', href: '/community.html' },
  { label: 'Contact', href: '/contact.html' }
];

const FOOTER_ITEMS = [
  { label: 'Shop', href: '/shop.html' },
  { label: 'About', href: '/about.html' },
  { label: 'Verify', href: '/verify.html' },
  { label: 'Track Order', href: '/order-status.html' },
  { label: 'Policies', href: '/policies.html' },
  { label: 'Support', href: '/support.html' },
  { label: 'Community', href: '/community.html' },
  { label: 'Contact', href: '/contact.html' }
];

function normalizePath(path) {
  if (!path) return '/';
  const clean = String(path).split('#')[0].split('?')[0].trim();
  if (!clean || clean === '/') return '/';
  return clean.endsWith('/') ? clean.slice(0, -1) : clean;
}

const currentPath = normalizePath(window.location.pathname);

function createNavLink(item) {
  const a = document.createElement('a');
  a.href = item.href;
  a.textContent = item.label;
  return a;
}

function syncLinkContainer(selector, items) {
  document.querySelectorAll(selector).forEach((container) => {
    const existing = new Map();

    container.querySelectorAll('a[href]').forEach((link) => {
      const href = normalizePath(link.getAttribute('href'));
      if (href) existing.set(href, link);
    });

    const orderedLinks = items.map((item) => {
      const key = normalizePath(item.href);
      const found = existing.get(key);
      if (found) {
        found.textContent = item.label;
        found.href = item.href;
        return found;
      }
      return createNavLink(item);
    });

    container.innerHTML = '';
    orderedLinks.forEach((link) => container.appendChild(link));
  });
}

function markCurrentLinks() {
  document.querySelectorAll('.nav-links a, .footer-links a').forEach((link) => {
    const href = normalizePath(link.getAttribute('href'));
    if (!href) return;

    if (href === '/' && currentPath === '/') {
      link.classList.add('is-current');
      return;
    }

    if (href !== '/' && currentPath === href) {
      link.classList.add('is-current');
    }
  });
}

function setupMobileNav() {
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  if (!nav || !toggle) return;

  const navLinks = nav.querySelector('.nav-links');
  const navActions = nav.querySelector('.nav-actions');

  const setOpen = (open) => {
    nav.classList.toggle('nav-open', open);
    document.body.classList.toggle('nav-locked', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (navLinks) navLinks.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (navActions) navActions.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  toggle.setAttribute('aria-label', 'Toggle navigation');
  setOpen(false);

  toggle.addEventListener('click', () => {
    const next = !nav.classList.contains('nav-open');
    setOpen(next);

    if (next && navLinks) {
      const firstLink = navLinks.querySelector('a');
      if (firstLink) firstLink.focus({ preventScroll: true });
    }
  });

  document.querySelectorAll('.nav-links a, .nav-actions a').forEach((a) => {
    a.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!nav.classList.contains('nav-open')) return;
    if (nav.contains(event.target)) return;
    setOpen(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) setOpen(false);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  syncLinkContainer('.nav-links', NAV_ITEMS);
  syncLinkContainer('.footer-links', FOOTER_ITEMS);
  markCurrentLinks();
  setupMobileNav();
});
