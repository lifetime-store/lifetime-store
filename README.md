# Lifetime Store — Premium Luxury Update

This package includes:
- fixed Paystack initialize function
- premium storefront refresh
- visible stock counts on featured, shop, and product pages
- support and orders email addresses wired into storefront copy
- R2 image support, D1 product data, and admin dashboard support

## Required Cloudflare Secrets
Add these in Workers & Pages → lifetime-store → Settings → Variables and Secrets:
- ADMIN_TOKEN
- PAYSTACK_SECRET_KEY
- RESEND_API_KEY

## Built-in Vars in wrangler.toml
- BRAND_EMAIL = support@lifetime-store.shop
- ALERT_TO_EMAIL = support@lifetime-store.shop
- MAIL_FROM_EMAIL = orders@lifetime-store.shop
- PAYSTACK_PUBLIC_KEY = live public key

## After upload
1. Redeploy the project.
2. In Resend, verify the sender domain for lifetime-store.shop.
3. Set Paystack webhook to:
   https://www.lifetime-store.shop/api/paystack/webhook
   or while Pages domain is active:
   https://lifetime-store.pages.dev/api/paystack/webhook
4. Test admin, shop, checkout, and support.
5. Connect the custom domain in Cloudflare Pages.
