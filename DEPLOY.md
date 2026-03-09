# Deploy on Railway

## Build & run

- **Build:** `npm run build`
- **Start:** `npm run start` (serves `dist` with SPA fallback; Railway sets `PORT`)

## Environment variables (Railway)

In Railway project → your service → Variables, add:

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon key

Rebuild after changing env vars (Vite bakes them in at build time).

## Auth redirect URLs (after first deploy)

When you have your Railway URL (e.g. `https://web-special-production.up.railway.app`):

1. **Supabase Dashboard** → Authentication → URL Configuration  
   - **Site URL:** your Railway URL  
   - **Redirect URLs:** add your Railway URL and `https://your-app.up.railway.app/**`

2. **Google Cloud Console** → Credentials → Web client (the one used in Supabase)  
   - **Authorized JavaScript origins:** add your Railway URL  
   - **Authorized redirect URIs:** keep `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

Then Google sign-in will work on the deployed app.
