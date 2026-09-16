import { supabase } from '@/lib/supabase'

interface LaunchAppResponse {
  url: string
  /** Where that link lands the user once consumed. Returned for diagnostics, not navigation. */
  redirectTo?: string
}

/** supabase-js wraps any non-2xx from an Edge Function in a FunctionsHttpError whose `message`
 *  is always the same placeholder — "Edge Function returned a non-2xx status code". The reason
 *  the function actually gave is in the untouched Response it carries on `context`, so read it
 *  back out; otherwise every distinct failure reaches the user as one unactionable sentence. */
async function describeInvokeError(error: Error): Promise<string> {
  const context = (error as { context?: unknown }).context
  if (!(context instanceof Response)) return error.message

  try {
    const body = await context.clone().text()
    if (!body) return error.message
    try {
      const parsed = JSON.parse(body) as { error?: unknown }
      if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error
    } catch {
      // Not JSON — a bare string body is still more useful than the placeholder.
    }
    return body.slice(0, 300)
  } catch {
    return error.message
  }
}

/**
 * Asks the `launch-app-link` Edge Function to mint a fresh, short-lived SSO link into the
 * tenant's Web App workspace and returns it. Generated fresh per call — never cache/store it.
 */
export async function requestAppLaunchUrl(): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<LaunchAppResponse>('launch-app-link', {
    method: 'POST',
  })

  if (error) {
    return { url: null, error: await describeInvokeError(error) }
  }
  if (!data?.url) {
    return { url: null, error: 'No launch link returned' }
  }
  return { url: data.url, error: null }
}
