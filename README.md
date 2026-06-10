# A1 Sanskriti Silks — Business Suite

Single-shop billing & business management web app for **A1 Sanskriti Silks**, Thrissur, Kerala.

## Tech Stack

- React 18 + TypeScript
- Vite
- TailwindCSS v4
- Supabase (Database, Auth & Storage)
- Deployed on Vercel

## Theme

Apple Light Glass — soft silver-blue gradient background with glassmorphism cards
(`backdrop-filter: blur`), deep-navy primary buttons and soft-gold accents.

## Getting Started

```bash
npm install
cp .env.example .env   # fill in your Supabase URL + anon/publishable key
npm run dev
```

App runs at http://localhost:5173.

## Environment Variables

| Variable                 | Description                          |
| ------------------------ | ------------------------------------ |
| `VITE_SUPABASE_URL`      | Supabase project URL                 |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable / anon API key  |

## Authentication

Email + password via Supabase Auth, with **sign up**, **forgot password**, and a
**reset-password** page (`/reset-password`) that the email link lands on. After
login the user lands on the Dashboard.

## Database

All tables live in one Supabase project. Row Level Security is enabled on every
table with a policy granting full access to the `authenticated` role. Invoice
numbers are generated atomically by the `next_invoice_number()` SQL function.

Public, no-login data (the customer-facing invoice page and shop branding) is
exposed through `security definer` functions — `get_public_invoice(id)` and
`get_public_shop()` — so only a single invoice (by its random id) or the shop's
public profile is ever readable anonymously, never a list.

Tables: `customers`, `invoices`, `purchases`, `purchase_returns`, `sales_returns`,
`inventory`, `expenses`, `suppliers`, `whatsapp_templates`, `staff`, `settings`.
Storage bucket `logos` holds the shop logo.

## Features

- **Dashboard** — live stats, sales chart, low-stock & today's deliveries
- **Sale / Invoice** — customer search/add, barcode scan, payment method
  (Cash/UPI/Credit), balance shown only when due, WhatsApp + print
- **Public invoice page** (`/i/:id`) — branded, no-login bill opened from the
  WhatsApp link, with shop logo, website & social buttons
- **Customers** — search, history drawer, **vCard export** (save customers to
  the phone's contacts so WhatsApp shows names)
- **Purchase** — supplier auto-save & search, optional GST tax, view / edit /
  delete with delta-only stock adjustment
- **Inventory** — add/edit, low-stock highlight, barcodes & labels
- **Product Flow** — opening/purchased/sold/returned/closing analysis
- **Expenses** — category ledger + breakdown chart
- **Reports** — monthly P&L, revenue by category, invoice summary
- **WhatsApp Remarketing** — segments, **custom templates** (create/edit/delete),
  and a **bulk send queue** that walks through recipients one tap at a time
- **Settings** — shop profile, **logo upload with in-app crop/zoom**, social &
  website links, invoice prefs, feature toggles

Shop identity (name, logo, contact, links) is set in Settings and flows
everywhere through a `ShopContext` backed by `get_public_shop()`.

## Routes

`/` Dashboard · `/sale` · `/customers` · `/purchase` · `/sales-return` ·
`/inventory` · `/product-flow` · `/expenses` · `/reports` · `/whatsapp` ·
`/settings` · `/login` · `/reset-password` · `/i/:id` (public invoice)

## Deploy (Vercel)

`vercel.json` rewrites all routes to `index.html` for client-side routing
(static files like the public invoice are served before the rewrite).
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
in the Vercel project, then deploy.
