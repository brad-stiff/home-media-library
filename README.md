# Home Media Library

A mobile app to keep track of your home's media collection. Starting with movies — more media types coming later.

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Create a [Supabase](https://supabase.com) project, then run SQL:

- **New project:** run [`supabase/schema.sql`](./supabase/schema.sql) (Phases 1–2)
- **Already ran Phase 1:** also run [`supabase/phase2.sql`](./supabase/phase2.sql)

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

## Features (Phases 1–2)

- Email/password accounts (Supabase Auth)
- Households with admin / member roles
- Short invite code — share so a spouse can join as a member
- Search TMDb and add movies to your shared cloud library
- Ownership: Blu-ray / 4K / Digital toggles + optional platform (Amazon, etc.)
- Grid view, detail screen, in-library search
- Admin-only movie delete (RLS)
- Light and dark mode

## Tech stack

- Expo (React Native) + TypeScript — SDK 57
- Expo Router for navigation
- Supabase (Auth + Postgres + RLS)
- TMDb API for movie metadata
