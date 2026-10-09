# Alcove

A mobile app for a household's movies, books, and Magic: The Gathering. Games and Pokémon are not in yet.

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Create a [Supabase](https://supabase.com) project, then run [`supabase/schema.sql`](./supabase/schema.sql) once in the SQL Editor.

   The project already in use is on the older snapshot. Do not run that file there again. Apply each new file in [`supabase/migrations`](./supabase/migrations) once, in name order, in the SQL Editor.

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
npm start
```

Scan the QR code with Expo Go, or run `npm run ios`. `npm test` runs the unit tests. `npm run typecheck` checks types.

## Features

- Email and password accounts. After sign-in you create a household or join one with a code. Signup does not create a household.
- Roles are admin, member, and viewer. The person who creates the household is an admin. Joining with the code makes you a viewer. Only admins see and regenerate the invite code.
- Members add and edit. They can delete items they added. Admins can delete any item. Viewers can browse.
- Movies from TMDb, with Blu-ray, 4K, and digital flags, plus barcode lookup. Books from Open Library, by ISBN scan or title search. One row per title.
- MTG collection from Scryfall, with quantity and a separate row for foil. Decks are Commander or Standard. You can edit the list, see legality warnings, import from Archidekt, or start from an empty deck.
- Checkout for physical movies and books. Borrowers are household contacts, not typed names. Loans can be returned or cancelled, and both stay in history. An admin can hide checkout for the whole household.
- Settings: display name, light or dark appearance, which library tabs the household and you see, library layout, export, password, email, and account deletion.

## Where things are

- The library stays behind Create or Join until you are in a household.
- On the MTG tab, open **Filters** and choose **Decks**. **Import** is where you paste an Archidekt link or create an empty deck. Add cards from the deck screen.
- **Contacts** is on the household screen and in Settings. Checkout picks someone from that list. An email can link an account outside this household, or share an invite to create one. That invite does not join them to the home.

## Tech stack

- Expo (React Native) + TypeScript — SDK 57
- Expo Router + expo-camera (barcode)
- Supabase (Auth + Postgres + RLS)
- TMDb, Open Library, UPCitemdb, Scryfall, Archidekt
