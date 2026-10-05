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

export type HouseholdRole = 'admin' | 'member' | 'viewer';

export interface MovieOwnership {
  hasBluray: boolean;
  has4k: boolean;
  hasDigital: boolean;
  platform: string | null;
}

export interface Movie extends MovieOwnership {
  id: string;
  householdId: string;
  tmdbId: number;
  title: string;
  year: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  runtime: number | null;
  genres: string[];
  barcode: string | null;
  addedBy: string | null;
  addedByName: string | null;
  addedAt: string;
  updatedAt: string;
}

export function formatOwnershipLabel(movie: MovieOwnership): string {
  const parts: string[] = [];
  if (movie.hasBluray) parts.push('Blu-ray');
  if (movie.has4k) parts.push('4K');
  if (movie.hasDigital) parts.push('Digital');
  if (movie.platform?.trim()) parts.push(movie.platform.trim());
  return parts.join(' · ') || 'Owned';
}
