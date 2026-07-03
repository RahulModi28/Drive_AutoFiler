# Drive Auto-Filer

AI-powered Google Drive document organiser. Drop a file → Gemini reads it → it lands in the right folder automatically. Full dashboard included.

## Stack

- **Next.js 14** (App Router) — frontend + API routes
- **Google OAuth** via NextAuth — no service account needed
- **Gemini 2.0 Flash** — free AI classification
- **Vercel Postgres** — filing log + stats
- **Vercel** — hosting

---

## Setup (one-time, ~15 minutes)

### 1. Google Cloud — OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Google Drive API**: APIs & Services → Enable APIs → search "Drive API" → Enable
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorised redirect URIs — add:
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
   - `https://your-app.vercel.app/api/auth/callback/google` (replace with your Vercel URL)
7. Copy the **Client ID** and **Client Secret**

> **OAuth consent screen**: You'll need to configure it. For personal use, set to "External" and add your own email as a test user.

### 2. Gemini API key (free)

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **Get API key** → **Create API key**
3. Copy the key — no billing needed for the free tier

### 3. Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

During deployment Vercel will ask for environment variables. Add:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | From step 1 |
| `GOOGLE_CLIENT_SECRET` | From step 1 |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` and paste result |
| `NEXTAUTH_URL` | Your Vercel URL e.g. `https://drive-filer.vercel.app` |
| `GEMINI_API_KEY` | From step 2 |

### 4. Add Vercel Postgres

1. In the Vercel dashboard → your project → **Storage** tab
2. Click **Create Database** → **Postgres**
3. Click **Connect** — Vercel auto-fills all `POSTGRES_*` env vars

The database tables are created automatically on first use.

### 5. Update OAuth redirect URI

Once Vercel gives you a URL, go back to Google Cloud Console and add:
`https://your-actual-url.vercel.app/api/auth/callback/google`

---

## Local development

```bash
# Copy env template
cp .env.example .env.local
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GEMINI_API_KEY, NEXTAUTH_SECRET
# For POSTGRES_*, run: vercel env pull .env.local  (links to your Vercel Postgres)

npm install
npm run dev
# Open http://localhost:3000
```

---

## How it works

1. Sign in with Google — grants Drive access via OAuth
2. Pick a root Drive folder from the dropdown (e.g. "Documents")
3. Drop files onto the dashboard
4. The app:
   - Extracts text from PDF / DOCX / TXT
   - Lists all subfolders under your root folder
   - Asks Gemini to pick the best match
   - If confidence is high or medium → uploads directly to Drive
   - If confidence is low → logs as "needs review" for you to handle manually
5. Every decision is logged to Postgres and shown in the dashboard

---

## Supported file types

| Type | Text extraction |
|---|---|
| PDF | Full text via pdf-parse |
| DOCX | Full text via mammoth |
| TXT / MD / CSV | Direct read |
| Others (XLSX, images) | Filed by filename only |

---

## Adding more folder roots

The folder picker shows all top-level folders in your Drive. If you want to file into a subfolder, just select a more specific root — the app recursively maps everything below it.
