export const MOVIE_FORMATS = ['Blu-ray', '4K UHD', 'DVD', 'Digital', 'Other'] as const;

export type MovieFormat = (typeof MOVIE_FORMATS)[number];

export interface TmdbMovieSearchResult {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  overview: string;
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
}

export interface Movie {
  id: string;
  tmdbId: number;
  title: string;
  year: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  runtime: number | null;
  genres: string[];
  format: MovieFormat;
  addedAt: string;
  updatedAt: string;
}

export type MovieRow = {
  id: string;
  tmdb_id: number;
  title: string;
  year: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  runtime: number | null;
  genres: string;
  format: string;
  added_at: string;
  updated_at: string;
};
