# Personal Project Time Tracker

A mobile-first time tracking app for personal project work. It shows a monthly calendar, lets you log project hours per day, tracks vacation and sick leave days, calculates overtime above 8 hours, and keeps archived projects available for historical entries.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Vercel-ready deployment

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Start the production server locally after building:

```bash
npm run start
```

## Environment Variables

Create `.env.local` for local development. Do not commit this file.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

You can find both values in Supabase under **Project Settings > API**:

- `NEXT_PUBLIC_SUPABASE_URL`: Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon public key

## Database Setup

Create a Supabase project, open **SQL Editor**, and run the script in:

```text
supabase/schema.sql
```

The app intentionally has no authentication. The schema includes public Row Level Security policies for the anon key, so use this for a private/personal deployment or tighten policies before sharing broadly.

## Vercel Deployment

1. Push this project to GitHub.
2. Import the GitHub repository in Vercel.
3. Add the required environment variables in **Vercel Project Settings > Environment Variables**:

   ```env
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

4. Deploy with the default Next.js settings.

Vercel should use:

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: Next.js default

## Useful Files

- `src/components/time-tracker.tsx`: main app UI and Supabase CRUD logic
- `src/lib/supabase.ts`: Supabase client setup
- `src/lib/types.ts`: shared TypeScript types
- `supabase/schema.sql`: database schema and policies
