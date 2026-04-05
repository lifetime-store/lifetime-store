# Lifetime Brand Stack

Quiet premium clothing storefront for **Lifetime** with:

- clean public storefront
- product catalog, product page, cart, and checkout request flow
- authenticity verification page for each garment code
- admin dashboard to manage products, batches, and serial codes
- Cloudflare Pages Functions API
- Cloudflare D1 database

## Why this stack

This project is built for the direction you described:
**plain premium essentials, low-visible branding, repeatable quality, and item-level authenticity tracking**.

It uses:

- **Cloudflare Pages Functions** for the API layer
- **Cloudflare D1** for products, orders, batches, and authenticity codes
- **plain HTML/CSS/JS** so the site is easy to edit without framework complexity

## Project structure

```text
lifetime-brand-stack/
├─ public/
│  ├─ index.html
│  ├─ shop.html
│  ├─ product.html
│  ├─ cart.html
│  ├─ checkout.html
│  ├─ verify.html
│  ├─ support.html
│  ├─ about.html
│  ├─ admin.html
│  └─ assets/
│     ├─ css/styles.css
│     └─ js/*.js
├─ functions/
│  ├─ api/
│  │  ├─ products/index.js
│  │  ├─ products/[slug].js
│  │  ├─ verify/[code].js
│  │  ├─ support.js
│  │  ├─ orders.js
│  │  └─ admin/*.js
│  └─ _lib/*.js
├─ migrations/
│  └─ 0001_init.sql
├─ wrangler.toml
└─ package.json
```

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Create your D1 database

```bash
npx wrangler d1 create lifetime_store_db
```

Copy the returned `database_id` into `wrangler.toml`.

### 3) Run the database migration

Remote:

```bash
npx wrangler d1 execute lifetime_store_db --file=./migrations/0001_init.sql --remote
```

Local preview:

```bash
npx wrangler d1 execute lifetime_store_db --file=./migrations/0001_init.sql --local
```

### 4) Change the admin token

Edit this in `wrangler.toml` before deploy:

```toml
[vars]
ADMIN_TOKEN = "CHANGE_THIS_BEFORE_DEPLOY"
```

### 5) Start local development

```bash
npm run dev
```

### 6) Deploy

```bash
npm run deploy
```

## First admin login

Open `/admin.html`.

Use the same value as `ADMIN_TOKEN`.

## Authenticity workflow

1. Create or edit products in admin.
2. Create a production batch.
3. Generate serial codes for that batch.
4. Print the labels from those generated codes.
5. Attach those labels during manufacturing.
6. Test-scan your codes.
7. Activate the valid codes before launch.
8. Customers scan the QR or visit `/verify.html` to confirm authenticity.

## Label system recommended

- **Outer hangtag:** retail barcode / SKU information
- **Inner care label:** unique QR + serial code
- **Database record:** product, size, color, batch, scan history, issue reports

## Notes

- This project stores orders as **order requests**, not card payments.
- The storefront already includes **NGN and USD** display.
- Add your own product photos later in `public/assets/` and update the product fields in admin.
- Upgrade path later:
  - add image uploads with R2
  - add NFC-based authentication
  - add payment integration
  - add staff roles
