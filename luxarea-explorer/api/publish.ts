// POST /api/publish: rebuilds the site after the team publishes home-page changes.
// Needs these Vercel environment variables:
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (to check the caller is on the team)
//   VERCEL_DEPLOY_HOOK_URL                         (Project → Settings → Git → Deploy Hooks)
// Not yet tested against a live Supabase project.
export async function POST(request: Request): Promise<Response> {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL
  const url = process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!hook || !url || !service) return new Response('Publishing is not configured yet', { status: 501 })

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return new Response('Sign in first', { status: 401 })

  // Who is calling?
  const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: service, Authorization: `Bearer ${token}` } })
  if (!userRes.ok) return new Response('Sign in again', { status: 401 })
  const user = (await userRes.json()) as { id: string }

  // Are they on the team?
  const teamRes = await fetch(`${url}/rest/v1/team_members?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  })
  const rows = teamRes.ok ? ((await teamRes.json()) as unknown[]) : []
  if (!rows.length) return new Response('Not on the Luxarea team', { status: 403 })

  const res = await fetch(hook, { method: 'POST' })
  return new Response(res.ok ? 'Rebuild started' : 'Could not start the rebuild', { status: res.ok ? 202 : 502 })
}
