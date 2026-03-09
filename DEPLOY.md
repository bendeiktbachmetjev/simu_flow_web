# Keys and configuration — where to get and where to put

## 1. Supabase keys (URL and anon key)

**What they are:** Your Supabase project URL and the public key for the frontend. The app uses them to talk to Supabase (auth, database).

**Where to get them (easiest — all in one place):**

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project (e.g. simu_flow).
2. Click **Connect** (top right of the dashboard).
3. In the “Connect to your project” dialog, open the **API Keys** tab.
4. You’ll see:
   - **Project URL** — copy it (e.g. `https://lwszdwguarzowduzthbz.supabase.co`).
   - **Publishable Key** — copy it (starts with `sb_publishable_...`). Use this as `VITE_SUPABASE_ANON_KEY`.
   - **Anon Key (Legacy)** — optional; you can use this JWT instead of the Publishable key if you prefer. Either Publishable or Legacy anon is fine for the app.

**Alternative (via Settings):**

- **Project URL:** Project Settings → **General** → **Project ID** (e.g. `lwszdwguarzowduzthbz`). URL = `https://<Project ID>.supabase.co`.
- **Key:** Project Settings → **API Keys** → tab “Publishable and secret API keys” → copy **Publishable key** (or use **Anon** from “Legacy anon, service_role API keys” if that tab exists).

**Where to put them:**

| Place | Variable name | Value |
|-------|----------------|-------|
| **Local dev** — file `web_special/.env` | `VITE_SUPABASE_URL` | Project URL from Supabase |
| **Local dev** — file `web_special/.env` | `VITE_SUPABASE_ANON_KEY` | Publishable key (or Legacy anon) from API Keys |
| **Railway** — Service → Variables | `VITE_SUPABASE_URL` | Same Project URL |
| **Railway** — Service → Variables | `VITE_SUPABASE_ANON_KEY` | Same key |

Example `.env` (do not commit this file if it has real keys):

```
VITE_SUPABASE_URL=https://lwszdwguarzowduzthbz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxx...
```

---

## 2. Google OAuth (Client ID and Client Secret)

**What they are:** Credentials so Supabase can run “Sign in with Google” for you. They live in Google Cloud Console; you paste them into Supabase, not into the app code.

**Where to get them:**

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select the right project (the one you use for SimuFlow).
3. Left menu → **APIs & Services** → **Credentials**.
4. In **OAuth 2.0 Client IDs** find the **Web client** (e.g. “Web client” with type “Web application”).  
   Use the one that is already connected to Supabase (in your case the one with ID starting with `740522763072-i1f4...`).
5. Click the client name (or the pencil icon).
6. Copy:
   - **Client ID** (long string ending in `.apps.googleusercontent.com`).
   - **Client secret** (click “Show” if needed and copy).

**Where to put them:**

| Place | What | Value |
|-------|------|-------|
| **Supabase Dashboard** | Google Client ID | Paste the Client ID from Google |
| **Supabase Dashboard** | Google Client Secret | Paste the Client Secret from Google |

**How to paste in Supabase:**

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Left sidebar → **Authentication** → **Providers**.
3. Find **Google** and turn it **Enabled**.
4. In the fields that appear, paste **Client ID** and **Client secret** from the Google Web client.
5. Save.

The app (and Railway) do **not** need the Google Client ID or Secret — only Supabase does.

---

## 3. Redirect URLs and origins (so login works)

After login, Google sends the user back to Supabase, and Supabase sends the user back to your app. For that to work, both Supabase and Google must “allow” your app’s URL.

### 3.1 Supabase — Site URL and Redirect URLs

**Where:** Supabase Dashboard → **Authentication** → **URL Configuration**.

**What to set:**

| Field | Local development | Production (Railway) |
|-------|-------------------|----------------------|
| **Site URL** | `http://localhost:5173` | Your Railway URL, e.g. `https://your-app.up.railway.app` |
| **Redirect URLs** | Add `http://localhost:5173` and `http://localhost:5173/**` | Add your Railway URL and `https://your-app.up.railway.app/**` |

You can have several lines in Redirect URLs (both local and production).

### 3.2 Google Console — Authorized origins and redirect URIs

**Where:** [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → open your **Web client** (the same one whose Client ID/Secret are in Supabase).

**What to set:**

| Field | What to add |
|-------|-------------|
| **Authorized JavaScript origins** | `http://localhost:5173` (dev) and your Railway URL, e.g. `https://your-app.up.railway.app` (prod). No path, no trailing slash. |
| **Authorized redirect URIs** | Exactly one redirect for Supabase: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` (replace `YOUR_PROJECT_REF` with your Supabase project ref from the URL, e.g. `lwszdwguarzowduzthbz`). So full URL is like: `https://lwszdwguarzowduzthbz.supabase.co/auth/v1/callback`. |

Do **not** put your app URL (localhost or Railway) in “Authorized redirect URIs” — that’s for Supabase’s callback URL only. Your app URL goes only in “Authorized JavaScript origins” and in Supabase’s Redirect URLs.

---

## 4. Summary checklist

**Local development**

- [ ] `.env` in `web_special/` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- [ ] Supabase → URL Configuration: Site URL = `http://localhost:5173`, Redirect URLs include `http://localhost:5173` and `http://localhost:5173/**`.
- [ ] Google Web client: Authorized JavaScript origins includes `http://localhost:5173`; Authorized redirect URIs includes `https://YOUR_PROJECT.supabase.co/auth/v1/callback`.

**Railway (production)**

- [ ] Railway service Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as in Supabase API settings).
- [ ] Supabase → URL Configuration: Site URL = Railway URL; Redirect URLs include Railway URL and `https://your-app.up.railway.app/**`.
- [ ] Google Web client: Authorized JavaScript origins includes your Railway URL.
- [ ] Rebuild/redeploy on Railway after changing env vars (Vite bakes them at build time).

**Build & run on Railway**

- **Build command:** `npm run build`
- **Start command:** `npm run start`

After first deploy, take the generated Railway URL and add it to Supabase and Google as above; then Google sign-in will work on the deployed app.
