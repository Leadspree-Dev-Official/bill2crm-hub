# Backend setup checklist

This is a from-scratch, ordered checklist to take this project from "code written locally"
to "live and bridged to the Web App project." Every step here needs credentials or dashboard
access only you hold, so none of it can be done from the coding session.

## 1. Create the Supabase project

Dashboard → New Project. Same org as the Web App project is fine; pick whatever region is
closest to the Web App project's region for lower cross-project latency in the Edge Functions.

```bash
cd "Bill2CRM Site"
supabase link --project-ref <new-project-ref>
supabase db push          # applies every migration in supabase/migrations
```

Copy the new project's URL and `anon` key into `.env.local` (see `.env.example`) and, if
deploying, into your hosting provider's environment variables.

## 2. Set Edge Function secrets

From the **Web App project's** dashboard (Project Settings → API), copy its `service_role`
key — never the anon key, and never paste it into any file in this repo.

```bash
supabase secrets set \
  WEBAPP_SUPABASE_URL="https://<webapp-project-ref>.supabase.co" \
  WEBAPP_SUPABASE_SERVICE_ROLE_KEY="<webapp service_role key>" \
  SYNC_WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  ROOT_DOMAIN="bill2crm.in"
```

Keep the `SYNC_WEBHOOK_SECRET` value handy — you'll paste it into the Database Webhook
headers in step 4.

## 3. Deploy the Edge Functions

```bash
supabase functions deploy sync-tenant-to-webapp
supabase functions deploy launch-app-link
supabase functions deploy admin-purge-tenant
```

## 4. Configure Database Webhooks

Dashboard → Database → Webhooks → Create a new webhook, twice:

| | Webhook 1 | Webhook 2 |
|---|---|---|
| Table | `tenants` | `tenant_subscriptions` |
| Events | Insert | Update |
| Type | HTTP Request | HTTP Request |
| URL | `https://<new-project-ref>.supabase.co/functions/v1/sync-tenant-to-webapp` | same |
| HTTP headers | `x-webhook-secret: <SYNC_WEBHOOK_SECRET from step 2>` | same |

This is what keeps entitlement changes (signup, trial expiry, admin edits) flowing into the
Web App project automatically.

## 5. Allow the tenant subdomain in the Web App project's Auth settings

In the **Web App project's** dashboard → Authentication → URL Configuration → Redirect URLs,
add:

```
https://*.bill2crm.in/
```

(Root path, not a specific route — the Web App's routing is hand-rolled off
`window.location.pathname` rather than a router with a catch-all, so the SSO handoff redirects
to `/` and `ssoCallback.ts` consumes the session from the hash fragment before the app's own
routing ever looks at the path.)

This is required for the magic-link SSO handoff (`launch-app-link`) to be allowed to redirect
there.

## 6. Map plans to the Web App project's plan ids

The two projects have independent `subscription_plans` tables. In the Web App project's SQL
editor, run `select id, name from subscription_plans;` and note the ids. Then, in this site's
`/admin → Plans`, open each plan and fill in its **Web App plan ID** field. Until this is set,
`sync-tenant-to-webapp` falls back to using this project's own plan id, which will only work
if the two happen to match.

## 7. DNS + Cloudflare Pages (this site)

- Add `bill2crm.in` as a zone in Cloudflare if it isn't already.
- Cloudflare Pages → connect this repo. Build command `npm run build`, output directory
  `dist`. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ROOT_DOMAIN` as Pages
  environment variables (same values as `.env.local`).
- Attach the custom domains `bill2crm.in` and `www.bill2crm.in` to the Pages project.

## 8. Cloudflare Worker (tenant subdomains → Web App)

```bash
cd cloudflare-worker
npm install
npx wrangler login
```

Edit `wrangler.toml`'s `WEB_APP_ORIGIN` to the Web App's actual deployed origin (its Netlify
URL, or a custom domain already pointed at it), then:

```bash
npx wrangler deploy
```

This routes every `*.bill2crm.in` request to the Web App unchanged — see the comment in
`cloudflare-worker/src/index.ts` for why no tenant lookup happens in the Worker itself.

## 9. Bootstrap the first Super Admin

`supabase/migrations/20260821213300_signup_trigger.sql`, retargeted by
`20260822100000_bootstrap_super_admin_leadspree.sql`, grants Super Admin automatically to one
exact-match email (currently `leadspree24x7@gmail.com`) the moment it signs up on this site —
sign up with that account first. Every super admin after that is granted from `/admin → Super
admins` by an existing one, never by email pattern-matching.

## Known limitation: purge is not a full data wipe

`admin-purge-tenant` removes the tenant's `organizations` / `organization_subscriptions` /
`organization_memberships` rows and their auth identity in the Web App project, plus the local
control-plane record. It does **not** purge that tenant's actual app data (invoices, documents,
storage buckets) — the Web App project's own `delete-tenant` Edge Function does that deeper
cascade but expects to be called by an authenticated Web App Super Admin session, not this
project's service role. For a fully complete wipe, also run that function from within the Web
App's own admin console, or extend `admin-purge-tenant` once you've confirmed how `delete-tenant`
behaves when called with a service-role bearer token.
