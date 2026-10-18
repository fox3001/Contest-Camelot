import type { Pool } from "pg";

/**
 * Porta il database allo schema atteso, in modo idempotente.
 * Viene eseguito a ogni avvio del server: su Railway lo schema non viene
 * aggiornato dal deploy, quindi le nuove colonne/tabelle le crea il server.
 * Ogni istruzione è sicura da ripetere e non cancella dati.
 */
const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS sessions (
     id serial PRIMARY KEY,
     name text NOT NULL,
     is_open boolean NOT NULL DEFAULT true,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS costumes (
     id serial PRIMARY KEY,
     session_id integer NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
     name text NOT NULL,
     image_path text NOT NULL,
     display_order integer NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS voters (
     id serial PRIMARY KEY,
     session_id integer NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
     nickname text NOT NULL,
     token text NOT NULL UNIQUE,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS votes (
     id serial PRIMARY KEY,
     voter_id integer NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
     costume_id integer NOT NULL REFERENCES costumes(id) ON DELETE CASCADE,
     score integer NOT NULL,
     created_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT votes_voter_costume_unique UNIQUE (voter_id, costume_id)
   )`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS require_code boolean NOT NULL DEFAULT false`,
  `ALTER TABLE voters ADD COLUMN IF NOT EXISTS device_id text`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS entries_open boolean NOT NULL DEFAULT false`,
  `ALTER TABLE costumes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'`,
  `ALTER TABLE costumes ADD COLUMN IF NOT EXISTS device_id text`,
  `ALTER TABLE costumes ADD COLUMN IF NOT EXISTS submitted_by text`,
  `ALTER TABLE costumes ADD COLUMN IF NOT EXISTS image_public_id text`,
  `ALTER TABLE costumes ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now()`,
  `CREATE TABLE IF NOT EXISTS voter_codes (
     id serial PRIMARY KEY,
     session_id integer NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
     code text NOT NULL,
     voter_id integer REFERENCES voters(id) ON DELETE SET NULL,
     created_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT voter_codes_session_code_unique UNIQUE (session_id, code)
   )`,
  `ALTER TABLE sessions ALTER COLUMN entries_open SET DEFAULT true`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS hunt_enabled boolean NOT NULL DEFAULT false`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS hunt_name text NOT NULL DEFAULT 'Photo Hunters'`,
  `ALTER TABLE costumes ADD COLUMN IF NOT EXISTS hunt_code text`,
  `CREATE TABLE IF NOT EXISTS targets (
     id serial PRIMARY KEY,
     session_id integer NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
     costume_id integer NOT NULL REFERENCES costumes(id) ON DELETE CASCADE,
     title text NOT NULL DEFAULT 'Target Hunt',
     riddle text NOT NULL,
     prize text NOT NULL,
     status text NOT NULL DEFAULT 'active',
     winner_voter_id integer REFERENCES voters(id) ON DELETE SET NULL,
     claim_code text,
     created_at timestamp NOT NULL DEFAULT now(),
     won_at timestamp
   )`,
  `CREATE TABLE IF NOT EXISTS hunt_catches (
     id serial PRIMARY KEY,
     session_id integer NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
     voter_id integer NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
     costume_id integer NOT NULL REFERENCES costumes(id) ON DELETE CASCADE,
     created_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT hunt_catches_voter_costume_unique UNIQUE (voter_id, costume_id)
   )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
     key text PRIMARY KEY,
     value jsonb NOT NULL,
     updated_at timestamp NOT NULL DEFAULT now()
   )`,
];

// Indici "di sicurezza": se i dati esistenti li violano non blocchiamo l'avvio.
const OPTIONAL_STATEMENTS: string[] = [
  `CREATE UNIQUE INDEX IF NOT EXISTS voters_session_device_unique
     ON voters (session_id, device_id) WHERE device_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS voters_session_nickname_idx ON voters (session_id, lower(nickname))`,
  `CREATE INDEX IF NOT EXISTS votes_costume_idx ON votes (costume_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS costumes_session_hunt_code_unique
     ON costumes (session_id, hunt_code) WHERE hunt_code IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS hunt_catches_session_idx ON hunt_catches (session_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS costumes_session_device_unique
     ON costumes (session_id, device_id) WHERE device_id IS NOT NULL`,
];

// Aggiornamenti dei dati da eseguire una sola volta (segnati in app_settings)
const ONE_TIME: { key: string; sql: string }[] = [
  // Le iscrizioni con foto diventano aperte di base: le apro anche nelle serate esistenti
  { key: "migr_entries_open_default", sql: `UPDATE sessions SET entries_open = true` },
];

export async function ensureSchema(
  pool: Pool,
  log: (msg: string, err?: unknown) => void = () => {},
): Promise<void> {
  for (const sql of STATEMENTS) {
    await pool.query(sql);
  }
  for (const m of ONE_TIME) {
    const done = await pool.query(`SELECT 1 FROM app_settings WHERE key = $1`, [m.key]);
    if (done.rowCount === 0) {
      await pool.query(m.sql);
      await pool.query(`INSERT INTO app_settings (key, value) VALUES ($1, 'true'::jsonb) ON CONFLICT DO NOTHING`, [m.key]);
    }
  }
  for (const sql of OPTIONAL_STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (err) {
      log("Indice opzionale non creato", err);
    }
  }
}
