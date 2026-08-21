# Bill2CRM Site

The control-plane website for Bill2CRM: marketing/pricing, signup with a 7-day free trial,
subscription management, and a centralized Super Admin console — the single front door in
front of the [Bill2CRM Web App](../Bill2CRM%20Web%20App), which stays the product itself.

Stack: React + TypeScript + Vite + Tailwind + shadcn/ui, backed by its own Supabase project
(deliberately separate from the Web App's project — see `supabase/README.md` for how the two
are bridged).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the new Supabase project's URL + anon key
npm run dev
```

The app runs and the marketing/auth pages work with no backend configured (queries just
return empty data). Full functionality — signup provisioning, the dashboard, `/admin` —
needs the Supabase project set up per `supabase/README.md`.

## Structure

- `src/pages/marketing` — public landing page (pricing pulled live from `subscription_plans`)
- `src/pages/auth` — signup / login / forgot password
- `src/pages/dashboard` — tenant's own trial/plan status + "Launch my app" SSO button
- `src/pages/admin` — Super Admin console (tenants, plans, audit log, super admin roster)
- `supabase/migrations` — schema, RLS, and the RPCs that gate every entitlement write
- `supabase/functions` — Edge Functions that bridge this project to the Web App's project
- `cloudflare-worker` — the wildcard-subdomain reverse proxy (`*.bill2crm.in`)

See `supabase/README.md` for the full deployment/setup checklist (Supabase project creation,
secrets, Database Webhooks, DNS, Cloudflare Pages + Worker, and the Web App project's Auth
redirect allow-list).
