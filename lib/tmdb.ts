import { TmdbMovieDetails, TmdbMovieSearchResult } from './types';
import { extractYear } from './theme';

const API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

function assertApiKey(): string {
  if (!API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_TMDB_API_KEY. Copy .env.example to .env and add your key.');
  }
  return API_KEY;
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('api_key', assertApiKey());
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TMDb request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function searchMovies(query: string): Promise<TmdbMovieSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const data = await tmdbFetch<{ results: TmdbMovieSearchResult[] }>('/search/movie', {
    query: trimmed,
    include_adult: 'false',
  });

  return data.results;
}

export async function getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
  return tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`);
}

export function movieSearchSubtitle(movie: TmdbMovieSearchResult): string {
  const year = extractYear(movie.release_date);
  return year ?? 'Unknown year';
}
