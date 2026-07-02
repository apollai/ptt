# Personal Project Time Tracker

A mobile-first time tracking app for personal project work. It shows a monthly calendar, lets you log project hours per day, tracks vacation and sick leave days, calculates overtime above 8 hours, and keeps archived projects available for historical entries.

The app is protected with Supabase Auth and an allowed-email check. It is also installable as a lightweight PWA named **PTT Capstone**.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Supabase Auth
- PWA manifest and icons
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
ALLOWED_EMAIL=
```

You can find both values in Supabase under **Project Settings > API**:

- `NEXT_PUBLIC_SUPABASE_URL`: Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon public key
- `ALLOWED_EMAIL`: the single company email address allowed to use the app

## Database Setup

Create a Supabase project, open **SQL Editor**, and run the script in:

```text
supabase/schema.sql
```

The schema uses owner-based Row Level Security. Rows in `projects`, `day_records`, and `time_entries` include `user_id`, and policies only allow access when `auth.uid() = user_id`.

Existing data should be migrated with the SQL in `supabase/schema.sql` or the migration SQL used during setup.

## Supabase Auth Setup

In the Supabase dashboard:

1. Go to **Authentication > Providers**.
2. Enable **Google**.
3. Add the Google OAuth **Client ID** and **Client Secret**.
4. In Google Cloud Console, configure the OAuth client with this authorized redirect URI:

   ```text
   https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback
   ```

5. Go to **Authentication > URL Configuration** in Supabase.
6. Add your local site URL:

   ```text
   http://localhost:3000
   ```

7. Add your Vercel production URL after deployment:

   ```text
   https://your-vercel-app.vercel.app
   ```

8. Add matching redirect URLs if required by your Supabase project settings:

   ```text
   http://localhost:3000/**
   https://your-vercel-app.vercel.app/**
   ```

## Vercel Deployment

1. Push this project to GitHub.
2. Import the GitHub repository in Vercel.
3. Add the required environment variables in **Vercel Project Settings > Environment Variables**:

   ```env
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   ALLOWED_EMAIL
   ```

4. Deploy with the default Next.js settings.

Vercel should use:

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: Next.js default

## Useful Files

- `src/components/time-tracker.tsx`: main app UI and Supabase CRUD logic
- `src/components/auth-gate.tsx`: session and allowed-email gate
- `src/components/login-form.tsx`: Google OAuth login
- `src/app/api/auth/allowed/route.ts`: server-side allowed email check
- `src/lib/supabase.ts`: Supabase client setup
- `src/lib/types.ts`: shared TypeScript types
- `supabase/schema.sql`: database schema and policies
- `public/manifest.webmanifest`: PWA manifest
- `public/icons/`: PWA icons
