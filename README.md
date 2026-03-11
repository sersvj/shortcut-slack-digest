# T/G Daily Digest

Internal tool that pulls open tasks from Shortcut (by Team) and sends formatted daily digests to mapped Slack channels.

**Live:** `https://YOUR-APP.vercel.app`
**Repo:** `https://github.com/YOUR-USERNAME/shortcut-slack-digest`

---

## Features

- **Dashboard** — two-column Active/Inactive layout, live search, story count summary
- **Per-team digest previews** — collapsible preview showing all 5 due-date buckets before sending
- **Slack Block Kit messages** — clean formatted digests with sections for Overdue, Due Today, Due This Week, Due Later, No Due Date
- **Slack channel mapping** — assign any Slack channel to any Shortcut Team
- **Manual send** — send all active digests with one click, or send individual teams
- **Auth** — Slack OAuth login, restricted to specified workspace only
- **Persistence** — Upstash Redis on Vercel; local filesystem fallback for dev
- **Caching** — story data cached in `localStorage`, only refreshed on manual refresh

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Auth | NextAuth.js v5 (Slack OAuth) |
| Storage | Upstash Redis (Vercel) / JSON file (local) |
| Slack API | `@slack/web-api` |
| Shortcut API | REST v3 |

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/sersvj/shortcut-slack-digest.git
cd shortcut-slack-digest
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
SHORTCUT_API_TOKEN=      # shortcut.com → Settings → API Tokens
SLACK_BOT_TOKEN=         # api.slack.com → OAuth & Permissions → Bot User OAuth Token (xoxb-...)
SLACK_CLIENT_ID=         # api.slack.com → Basic Information → Client ID
SLACK_CLIENT_SECRET=     # api.slack.com → Basic Information → Client Secret
SLACK_WORKSPACE_ID=      # your workspace ID e.g. T26KY6927 (from app.slack.com/client/T...)
NEXTAUTH_SECRET=         # run: openssl rand -base64 32
NEXTAUTH_URL=https://localhost:3000
```

> No `UPSTASH_REDIS_*` vars needed locally — the app uses the local filesystem automatically.

### 3. Start the dev server

```bash
npm run dev
```

The server runs on **HTTPS** (`https://localhost:3000`). Your browser will show a self-signed cert warning — click **Advanced → Proceed** once and it won't ask again.

---

## Slack Bot Setup

In your Slack app at [api.slack.com](https://api.slack.com):

**Bot Token Scopes** (OAuth & Permissions → Bot Token Scopes):
- `chat:write`
- `channels:read`
- `groups:read`

**User Token Scopes** (OAuth & Permissions → User Token Scopes):
- `identity.basic`
- `identity.email`
- `identity.avatar`
- `identity.team`

**Redirect URLs** (OAuth & Permissions → Redirect URLs):
- `https://localhost:3000/api/auth/callback/slack`
- `https://YOUR-APP.vercel.app/api/auth/callback/slack`

> The bot must be invited to each Slack channel it posts to: `/invite @your-bot-name`

---

## Deploying to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "your message"
git push origin main
```

### 2. Create Vercel project

- [vercel.com/new](https://vercel.com/new) → Import `sersvj/shortcut-slack-digest`
- Framework auto-detected as Next.js

### 3. Add environment variables

In Vercel project → **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `SHORTCUT_API_TOKEN` | Shortcut API token |
| `SLACK_BOT_TOKEN` | `xoxb-...` bot token |
| `SLACK_CLIENT_ID` | Slack app Client ID |
| `SLACK_CLIENT_SECRET` | Slack app Client Secret |
| `SLACK_WORKSPACE_ID` | e.g. `T0XXXXXXX` |
| `NEXTAUTH_SECRET` | output of `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://YOUR-APP.vercel.app` |
| `UPSTASH_REDIS_REST_URL` | added automatically by Vercel KV |
| `UPSTASH_REDIS_REST_TOKEN` | added automatically by Vercel KV |

### 4. Add Upstash Redis

In Vercel project → **Storage → Add → Upstash Redis** (free tier).  
Vercel adds the `UPSTASH_REDIS_*` env vars automatically.

---

## Environment Variables Reference

| Variable | Required | Local | Vercel | Description |
|---|---|---|---|---|
| `SHORTCUT_API_TOKEN` | ✅ | ✅ | ✅ | Shortcut personal API token |
| `SLACK_BOT_TOKEN` | ✅ | ✅ | ✅ | Slack bot OAuth token |
| `SLACK_CLIENT_ID` | ✅ | ✅ | ✅ | Slack OAuth app client ID |
| `SLACK_CLIENT_SECRET` | ✅ | ✅ | ✅ | Slack OAuth app client secret |
| `SLACK_WORKSPACE_ID` | ✅ | ✅ | ✅ | Slack workspace ID (e.g. `T26KY6927`) |
| `NEXTAUTH_SECRET` | ✅ | ✅ | ✅ | Random secret for JWT signing |
| `NEXTAUTH_URL` | ✅ | ✅ | ✅ | Base URL (`https://localhost:3000` or Vercel URL) |
| `UPSTASH_REDIS_REST_URL` | ⬜ | — | ✅ | Auto-added by Vercel KV |
| `UPSTASH_REDIS_REST_TOKEN` | ⬜ | — | ✅ | Auto-added by Vercel KV |
