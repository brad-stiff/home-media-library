import * as SQLite from 'expo-sqlite';

import { MOVIE_FORMATS, Movie, MovieFormat, MovieRow, TmdbMovieDetails } from './types';
import { extractYear } from './theme';

const DB_NAME = 'media-library.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function rowToMovie(row: MovieRow): Movie {
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    title: row.title,
    year: row.year,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    overview: row.overview,
    runtime: row.runtime,
    genres: row.genres ? JSON.parse(row.genres) : [],
    format: row.format as MovieFormat,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
  };
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS movies (
          id TEXT PRIMARY KEY NOT NULL,
          tmdb_id INTEGER NOT NULL UNIQUE,
          title TEXT NOT NULL,
          year TEXT,
          poster_path TEXT,
          backdrop_path TEXT,
          overview TEXT,
          runtime INTEGER,
          genres TEXT NOT NULL DEFAULT '[]',
          format TEXT NOT NULL,
          added_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
        CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON movies(tmdb_id);
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function getAllMovies(): Promise<Movie[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MovieRow>('SELECT * FROM movies ORDER BY title COLLATE NOCASE ASC');
  return rows.map(rowToMovie);
}

export async function searchMoviesInLibrary(query: string): Promise<Movie[]> {
  const trimmed = query.trim();
  if (!trimmed) return getAllMovies();

  const db = await getDb();
  const pattern = `%${trimmed}%`;
  const rows = await db.getAllAsync<MovieRow>(
    `SELECT * FROM movies
     WHERE title LIKE ? COLLATE NOCASE
        OR year LIKE ?
        OR format LIKE ? COLLATE NOCASE
     ORDER BY title COLLATE NOCASE ASC`,
    pattern,
    pattern,
    pattern,
  );
  return rows.map(rowToMovie);
}

export async function getMovieById(id: string): Promise<Movie | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MovieRow>('SELECT * FROM movies WHERE id = ?', id);
  return row ? rowToMovie(row) : null;
}

export async function getMovieByTmdbId(tmdbId: number): Promise<Movie | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MovieRow>('SELECT * FROM movies WHERE tmdb_id = ?', tmdbId);
  return row ? rowToMovie(row) : null;
}

export async function addMovie(details: TmdbMovieDetails, format: MovieFormat): Promise<Movie> {
  if (!MOVIE_FORMATS.includes(format)) {
    throw new Error(`Invalid format: ${format}`);
  }

  const existing = await getMovieByTmdbId(details.id);
  if (existing) {
    throw new Error('This movie is already in your library.');
  }

  const now = new Date().toISOString();
  const movie: Movie = {
    id: generateId(),
    tmdbId: details.id,
    title: details.title,
    year: extractYear(details.release_date),
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
    overview: details.overview,
    runtime: details.runtime,
    genres: details.genres.map((genre) => genre.name),
    format,
    addedAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  await db.runAsync(
    `INSERT INTO movies (
      id, tmdb_id, title, year, poster_path, backdrop_path,
      overview, runtime, genres, format, added_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    movie.id,
    movie.tmdbId,
    movie.title,
    movie.year,
    movie.posterPath,
    movie.backdropPath,
    movie.overview,
    movie.runtime,
    JSON.stringify(movie.genres),
    movie.format,
    movie.addedAt,
    movie.updatedAt,
  );

  return movie;
}

export async function deleteMovie(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM movies WHERE id = ?', id);
}
