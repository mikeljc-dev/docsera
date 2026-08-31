# Deployment Guide: Supabase + Render

This document explains how to deploy Docsera to production using **Supabase** for the database and **Render** for the server.

## Architecture

- **Database**: [Supabase](https://supabase.com) — Postgres + pgvector (managed)
- **Server**: [Render](https://render.com) — Node.js server (auto-deploy from Git)
- **Landing/Docs**: [Vercel](https://vercel.com) — Static sites (optional, separate from API)

## Prerequisites

- GitHub account (for connecting your repo to Render)
- [Supabase account](https://supabase.com) (free tier available)
- [Render account](https://render.com) (free tier available)
- This repository cloned and pushed to GitHub

## Step 1: Set up Supabase (Database)

### 1.1 Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in / create account
2. Click "New Project" → fill in name (e.g., `docsera-prod`)
3. Choose region close to your users (e.g., `us-east-1`)
4. Set a secure database password — **save it**, you'll need it
5. Click "Create new project" — wait ~2 minutes

### 1.2 Get your database connection string

1. In Supabase dashboard, go to **Settings** → **Database**
2. Under "Connection Pooling", copy the **"Connection string"**
   - Format: `postgresql://postgres:[password]@[host]:[port]/postgres`
3. This is your `DATABASE_URL` for the next step

### 1.3 (Optional) Restore existing data

If you're migrating from another Postgres instance:

```bash
# From your old DB
pg_dump --data-only -h old-host -U old-user old-db | \
  psql "postgresql://postgres:PASSWORD@new-host/postgres"
```

## Step 2: Deploy to Render (Server)

### 2.1 Connect your GitHub repository

1. Push your code to GitHub (if not already)
2. Go to [render.com](https://render.com) and sign in
3. Click "New" → "Web Service"
4. Select "Connect your GitHub account" or paste the repo URL
5. Choose your repo

### 2.2 Configure the service

| Field | Value |
|---|---|
| **Name** | `docsera` (or your preferred name) |
| **Runtime** | Node |
| **Build Command** | `pnpm install --frozen-lockfile && pnpm build` |
| **Start Command** | `node dist/server/index.js` |
| **Plan** | Free or Starter (free tier has limited resources) |

### 2.3 Add environment variables

Under "Environment Variables", add **all** variables from `.env.example`:

Critical variables:
- `DATABASE_URL` — from step 1.2 (Supabase connection string)
- `LLM_PROVIDER` — `anthropic`, `openai`, or `ollama`
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — your API key
- `EMBEDDING_PROVIDER` — `openai` or `ollama`
- `EMBEDDING_MODEL` — model name (optional, has defaults)
- `ADMIN_TOKEN` — generate: `openssl rand -hex 32`
- `ALLOWED_ORIGINS` — your domain(s), e.g., `https://docs.yoursite.com`
- `CHAT_RATE_LIMIT` — e.g., `20` (requests per minute per IP)

Optional but recommended:
- `GITHUB_TOKEN` — for GitHub repo ingestion (60 req/hour without it)
- `DISCORD_PUBLIC_KEY` — if using Discord bot
- `PUBLIC_STATS` — `true` if you want public analytics

### 2.4 Add custom domain (optional)

If you want `api.yourdomain.com` instead of the Render auto-generated URL:

1. In Render dashboard, go to your service → **Settings** → **Custom Domain**
2. Add your domain (e.g., `api.yourdomain.com`)
3. In your DNS provider, add an `A` record pointing to Render's IP
   - Render will show you the exact instructions
4. Takes ~5-10 min to propagate

### 2.5 Deploy

1. Click "Create Web Service"
2. Render will:
   - Clone your repo
   - Run `pnpm install --frozen-lockfile && pnpm build`
   - Run `node dist/server/index.js` (which includes DB migrations)
   - Start serving on `https://[your-service].onrender.com`

**First deploy takes ~3-5 minutes.** Check the logs if something fails.

## Step 3: Ingest your documentation

### Via the CLI

```bash
npx docsera@latest
```

Then choose:
- Server URL: `https://[your-service].onrender.com` (or your custom domain)
- Admin token: the `ADMIN_TOKEN` from Render env vars
- Source type: URL, sitemap, markdown file, PDF, or GitHub repo

### Via curl

```bash
curl -X POST https://[your-service].onrender.com/ingest \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url",
    "source": "https://docs.yoursite.com"
  }'
```

## Step 4: Embed the widget

Once docs are indexed, add the widget to your site:

```html
<script
  src="https://api.yourdomain.com/widget.js"
  data-server="https://api.yourdomain.com"
  data-allowed-origins="https://yoursite.com"
></script>
```

Replace:
- `https://api.yourdomain.com` — your Render server URL or custom domain
- `https://yoursite.com` — your website's origin (added to `ALLOWED_ORIGINS` in Render)

## Monitoring & Maintenance

### View logs

In Render dashboard → your service → **Logs**. Shows real-time server output.

### Check database

1. Supabase dashboard → **SQL Editor** or **Table Editor**
2. Tables: `documents`, `chunks`, `conversations`

### Re-index docs

```bash
npx docsera ingest
```

Or use the dashboard admin panel at `/dashboard`.

### Update environment variables

1. Render dashboard → your service → **Settings** → **Environment Variables**
2. Change any variable
3. Render auto-redeploys

### Redeploy manually

If you need to trigger a redeploy without code changes:

```bash
git commit --allow-empty -m "Trigger redeploy" && git push
```

## Troubleshooting

### "Database connection failed"
- Check `DATABASE_URL` in Render env vars
- Verify Supabase project is active (Supabase dashboard → Project → Overview)
- If behind a VPN/firewall, ensure Supabase allows your IP (usually does for free tier)

### "Migration failed" in logs
- Render applies migrations on startup (the `db/migrate.js` part of the start command)
- If you see errors, check that `DATABASE_URL` is correct
- You can also run migrations manually in Supabase SQL editor

### "API key missing" 
- Check that `LLM_PROVIDER` and corresponding API key are set
- Valid providers: `anthropic`, `openai`, `ollama`
- Render will NOT start if the provider is invalid or key is missing

### Widget shows "I don't know" for everything
- Docs may not be indexed: check `/admin/stats` in Render logs
- Try re-ingesting with `npx docsera ingest`
- Check `EMBEDDING_DIMENSIONS` matches your model (default 1536 for OpenAI)

### Slow responses
- Free tier on Render has limited resources — upgrade to Starter plan for better performance
- High latency may come from Gemini free tier — consider using a paid LLM provider
- If `RERANKER_ENABLED=true`, first query downloads the model (~24 MB): subsequent queries are faster

## Costs

### Supabase
- **Free tier**: 500 MB database, enough for ~50K chunks (~500-1000 pages of docs)
- **Pay as you go**: $0.12 per GB after 500 MB

### Render
- **Free tier**: 750 hours/month, auto-pauses after 15 min inactivity
- **Starter**: $7/month, always running, more resources

### LLM Provider
- **Anthropic**: ~$0.003-0.03 per 1K tokens (depends on model)
- **OpenAI**: ~$0.0005-0.003 per 1K tokens
- **Gemini** (free): Daily usage caps
- **Ollama** (local): free, runs on your Render instance

## Next Steps

- [Read the README](./README.md) for more configuration options
- [Check ARCHITECTURE.md](./ARCHITECTURE.md) for design decisions
- [Visit docs.docsera.dev](https://docs.docsera.dev) to see it in action
