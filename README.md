# Home Media Library

A mobile app to keep track of your home's media collection. Starting with movies — more media types coming later.

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file and add your TMDb API key:

```bash
cp .env.example .env
```

Get a free API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).

3. Start the app:

```bash
npm run ios
```

Or scan the QR code with Expo Go after running `npm start`.

## v1 features

- Search TMDb and add movies to your library
- Grid view with poster art
- Movie detail screen (overview, genres, runtime, format)
- Search and filter within your library
- Format tags (Blu-ray, 4K UHD, DVD, Digital, Other)
- Local SQLite storage (designed for future cloud sync)
- Light and dark mode

## Tech stack

- Expo (React Native) + TypeScript — SDK 54 (compatible with App Store Expo Go)
- Expo Router for navigation
- Expo SQLite for local storage
- TMDb API for movie metadata
