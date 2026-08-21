import { supabase } from '@/lib/supabase'

interface LaunchAppResponse {
  url: string
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
    return { url: null, error: error.message }
  }
  if (!data?.url) {
    return { url: null, error: 'No launch link returned' }
  }
  return { url: data.url, error: null }
}
