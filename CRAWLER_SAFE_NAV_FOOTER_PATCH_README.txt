Lifetime crawler-safe navigation + footer patch

Files included:
- public/assets/css/styles.css
- public/assets/js/chrome.js

What this patch does:
- keeps desktop navigation visible and balanced
- preserves HTML-first nav/footer structure for crawlers
- improves mobile drawer accessibility with aria-hidden state
- keeps the Lifetime dark premium style
- strengthens footer readability and link visibility

How to apply:
1. Replace the matching files in your repo with these versions.
2. Commit and redeploy Cloudflare Pages.
3. Hard refresh the site.
4. Test desktop nav, mobile menu, and footer links.
