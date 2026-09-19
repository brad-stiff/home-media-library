# Home Media Library

A mobile app to keep track of your home's media collection. Starting with movies and books — more media types coming later.

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Create a [Supabase](https://supabase.com) project, then run SQL:

- **New project:** run [`supabase/schema.sql`](./supabase/schema.sql) (Phases 1–4)
- **Already on Phase 3:** run [`supabase/phase4.sql`](./supabase/phase4.sql)

3. For local testing, disable email confirmation:

- **Authentication → Providers → Email** → turn off **Confirm email**

4. Copy the environment file and add your keys:

```bash
cp .env.example .env
```

- `EXPO_PUBLIC_TMDB_API_KEY` — free key from [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` — from Supabase **Project Settings → API**

5. Start the app:

```bash
npm run ios
```

Or scan the QR code with Expo Go after running `npm start`.

## Features (Phases 1–4)

- Email/password accounts (Supabase Auth)
- Households with admin / member roles + short invite code
- Movies: TMDb search, ownership toggles (Blu-ray / 4K / Digital + platform)
- Books: ISBN barcode → Open Library
- Barcode scan for discs (UPC → TMDb) and books (ISBN)
- Checkout / lending with free-text borrower names
- Library filters: All / Available / Checked out
- Admin-only delete (RLS)
- Light and dark mode

## Database setup

1. **New project:** run [`supabase/schema.sql`](./supabase/schema.sql)
2. **Incremental:** run `phase2.sql` → `phase3.sql` → [`phase4.sql`](./supabase/phase4.sql) as needed
3. Disable email confirmation under **Authentication → Providers → Email** for local testing

## Tech stack

- Expo (React Native) + TypeScript — SDK 57
- Expo Router + expo-camera (barcode)
- Supabase (Auth + Postgres + RLS)
- TMDb, Open Library, UPCitemdb (trial) for lookups
