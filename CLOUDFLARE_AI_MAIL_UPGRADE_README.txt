Cloudflare AI + mail routing upgrade

1. This package adds a support assistant endpoint at /api/support-ai and a visible AI helper box on /support.html.
2. For Cloudflare Pages, add a Workers AI binding in the dashboard with variable name AI.
3. Optional variable: AI_ASSISTANT_MODEL. If omitted, the package uses @cf/meta/llama-3.1-8b-instruct.
4. SUPPORT_EMAIL is now the main support mailbox for support-form alerts and human support references.
5. ORDERS_EMAIL now receives order and delivery alerts.
6. No D1 migration is required for this upgrade.
