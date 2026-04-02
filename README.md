# Slash Invoices

A multi-user web app for creating contacts and sending invoices via the [Slash API](https://docs.slash.com). Built with Next.js 15, deployed on Vercel.

## Features

- **Multi-user auth** — Email/password signup and login (NextAuth)
- **Per-user Slash API keys** — Each user connects their own Slash account
- **Create contacts** — Add customers with name, legal name, and email
- **Create invoices** — Line items, discount/tax percentages, live total preview
- **Invoice management** — Filter by status (All, Unpaid, Paid, Overdue, Void)
- **Dark mode** fintech UI

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Auth**: NextAuth v4 (Credentials provider)
- **Database**: PostgreSQL via Prisma ORM
- **UI**: Tailwind CSS, Radix UI, Lucide icons
- **Fonts**: General Sans (Fontshare)

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/slash-invoices.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Add a **Postgres database**:
   - Go to your project → Storage → Create Database → Neon Postgres
   - Vercel auto-sets `DATABASE_URL`

### 3. Set Environment Variables

In your Vercel project settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Auto-set by Vercel Postgres |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` and paste the result |
| `NEXTAUTH_URL` | Your Vercel URL, e.g. `https://slash-invoices.vercel.app` |

### 4. Push the database schema

After the first deploy, run:

```bash
npx prisma db push
```

Or add this to your build command in Vercel:

```
prisma generate && prisma db push && next build
```

### 5. Done

Visit your Vercel URL → Create an account → Go to Settings → Paste your Slash API key → Start invoicing.

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL (local Postgres or Neon)

# Push schema to database
npx prisma db push

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Key Security

Each user's Slash API key is stored in the database (per-user row). All Slash API calls are proxied through Next.js API routes — the key never reaches the browser. For production, consider adding encryption at rest (e.g., using `@47ng/cloak` or Vercel's encrypted environment variables).

## Slash API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/legal-entity` | List legal entities |
| GET | `/account` | List accounts |
| GET | `/contact` | List contacts |
| POST | `/contact` | Create contact |
| GET | `/invoice` | List invoices |
| POST | `/invoice` | Create invoice |
| GET | `/invoice/:id` | Get invoice details |
| GET | `/invoice/settings` | Get invoice settings |
