# St. Thomas Men's Wear — Business Suite

Single-shop billing & business management web app for **St. Thomas Men's Wear**, Thrissur, Kerala.

## Tech Stack

- React 18 + TypeScript
- Vite
- TailwindCSS v4
- Supabase (Database + Auth)
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

Single owner account (email + password) via Supabase Auth. There is no public
registration — the owner account is provisioned directly in Supabase. After
login the user lands on the Dashboard.

## Database

All tables live in one Supabase project (single-tenant). Row Level Security is
enabled on every table with a policy granting full access to the `authenticated`
role only. Invoice numbers are generated atomically by the `next_invoice_number()`
SQL function in the format `SB-YYYY-0001`.

Tables: `customers`, `invoices`, `purchases`, `purchase_returns`, `sales_returns`,
`inventory`, `expenses`, `staff`, `payroll`, `settings`.

## Build Progress — all 14 screens complete ✅

- [x] 1. Project setup + Supabase config + Login page
- [x] 2. Dashboard — live stats, 6-month sales chart, low-stock & today's deliveries
- [x] 3. New Sale / Invoice — customer search/add, live totals, auto invoice number, WhatsApp + print
- [x] 4. Customers — search, add, invoice-history drawer, computed balances
- [x] 5. Purchase Entry — saves & auto-increments inventory stock
- [x] 6. Purchase Return — reduces inventory stock
- [x] 7. Sales Return — credit notes, restocks returned goods
- [x] 8. Inventory — add/edit, low-stock red highlight, KPIs, search
- [x] 9. Product Flow Analysis — opening/purchased/sold/returned/closing, fast/slow tags
- [x] 10. Expenses — category ledger + breakdown chart
- [x] 11. Payroll — editable attendance, advances, net pay, mark paid
- [x] 12. Reports — monthly P&L, revenue by category, invoice summary
- [x] 13. WhatsApp Remarketing — All / VIP / Lost / Balance-Due segments + templates (wa.me links)
- [x] 14. Settings — shop profile, invoice prefs, staff management, feature toggles

## Routes

`/` Dashboard · `/sale` · `/customers` · `/purchase` · `/purchase-return` ·
`/sales-return` · `/inventory` · `/product-flow` · `/expenses` · `/payroll` ·
`/reports` · `/whatsapp` · `/settings` · `/login`

## Deploy (Vercel)

`vercel.json` rewrites all routes to `index.html` for client-side routing.
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
in the Vercel project, then deploy.
