/**
 * Wildcard subdomain proxy for {slug}.bill2crm.in.
 *
 * Deliberately dumb: it forwards every request to the Bill2CRM Web App's origin unchanged.
 * Tenant resolution happens entirely client-side once the browser lands here with a Supabase
 * session (set by the SSO callback from an access/refresh token in the URL hash — which never
 * reaches this Worker, since fragments aren't sent to servers). No slug -> tenant lookup is
 * needed here; auth.uid() + RLS in the Web App project's own database resolve the org.
 */

export interface Env {
  WEB_APP_ORIGIN: string // e.g. "https://bill2crm-web-app.netlify.app"
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const target = new URL(url.pathname + url.search, env.WEB_APP_ORIGIN)

    const proxied = new Request(target, request)
    proxied.headers.set('X-Forwarded-Host', url.hostname)

    return fetch(proxied)
  },
}
