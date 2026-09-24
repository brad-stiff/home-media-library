import { extractYear } from './theme';
import { getMovieDetails } from './tmdb';
import { getMyHousehold } from './household';
import { supabase } from './supabase';
import { Movie, MovieOwnership, MovieRow, TmdbMovieDetails } from './types';

function rowToMovie(row: MovieRow): Movie {
  return {
    id: row.id,
    householdId: row.household_id,
    tmdbId: row.tmdb_id,
    title: row.title,
    year: row.year,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    overview: row.overview,
    runtime: row.runtime,
    genres: row.genres ?? [],
    hasBluray: row.has_bluray,
    has4k: row.has_4k,
    hasDigital: row.has_digital,
    platform: row.platform,
    addedBy: row.added_by,
    addedAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertOwnership(ownership: MovieOwnership) {
  if (!ownership.hasBluray && !ownership.has4k && !ownership.hasDigital) {
    throw new Error('Select at least one of Blu-ray, 4K, or Digital.');
  }
}

export async function getAllMovies(): Promise<Movie[]> {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .order('title', { ascending: true });

  if (error) throw error;
  return (data as MovieRow[]).map(rowToMovie);
}

export async function searchMoviesInLibrary(query: string): Promise<Movie[]> {
  const movies = await getAllMovies();
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return movies;

  return movies.filter((movie) => {
    const haystack = [
      movie.title,
      movie.year ?? '',
      movie.platform ?? '',
      movie.hasBluray ? 'blu-ray bluray' : '',
      movie.has4k ? '4k uhd' : '',
      movie.hasDigital ? 'digital' : '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(trimmed);
  });
}

export async function getMovieById(id: string): Promise<Movie | null> {
  const { data, error } = await supabase.from('movies').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToMovie(data as MovieRow) : null;
}

export async function getMovieByTmdbId(tmdbId: number): Promise<Movie | null> {
  const household = await getMyHousehold();
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .eq('household_id', household.householdId)
    .eq('tmdb_id', tmdbId)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToMovie(data as MovieRow) : null;
}

export async function addMovie(
  details: TmdbMovieDetails,
  ownership: MovieOwnership,
  options?: { barcode?: string | null },
): Promise<Movie> {
  assertOwnership(ownership);

  const existing = await getMovieByTmdbId(details.id);
  if (existing) {
    throw new Error('This movie is already in your library.');
  }

  const household = await getMyHousehold();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const platform = ownership.platform?.trim() || null;
  const barcode = options?.barcode?.replace(/\D/g, '') || null;

  const { data, error } = await supabase
    .from('movies')
    .insert({
      household_id: household.householdId,
      tmdb_id: details.id,
      title: details.title,
      year: extractYear(details.release_date),
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      overview: details.overview,
      runtime: details.runtime,
      genres: details.genres.map((genre) => genre.name),
      has_bluray: ownership.hasBluray,
      has_4k: ownership.has4k,
      has_digital: ownership.hasDigital,
      platform,
      barcode,
      added_by: user?.id ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('This movie is already in your library.');
    }
    throw error;
  }

  return rowToMovie(data as MovieRow);
}

export async function updateMovieOwnership(id: string, ownership: MovieOwnership): Promise<void> {
  assertOwnership(ownership);
  const { data, error } = await supabase
    .from('movies')
    .update({
      has_bluray: ownership.hasBluray,
      has_4k: ownership.has4k,
      has_digital: ownership.hasDigital,
      platform: ownership.platform?.trim() || null,
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new Error('You cannot edit this movie.');
    }
    throw error;
  }
  if (!data) {
    throw new Error('You cannot edit this movie.');
  }
}

export async function refreshMovieFromTmdb(movie: Movie): Promise<Movie> {
  const details = await getMovieDetails(movie.tmdbId);
  const { data, error } = await supabase
    .from('movies')
    .update({
      title: details.title,
      year: extractYear(details.release_date),
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      overview: details.overview,
      runtime: details.runtime,
      genres: details.genres.map((genre) => genre.name),
    })
    .eq('id', movie.id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new Error('You cannot refresh this movie.');
    }
    throw error;
  }

  return rowToMovie(data as MovieRow);
}

export async function deleteMovie(id: string): Promise<void> {
  const { data, error } = await supabase.from('movies').delete().eq('id', id).select('id');
  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new Error('You can only remove movies you added. Admins can remove any movie.');
    }
    throw error;
  }
  if (!data?.length) {
    throw new Error('You can only remove movies you added. Admins can remove any movie.');
  }
}
