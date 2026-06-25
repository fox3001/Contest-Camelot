# Costume Vote

App di votazione per concorso costumi: i partecipanti entrano via QR code, scelgono un nickname e votano da 1 a 5 le foto dei costumi in gara. L'admin vede i risultati live e gestisce le sessioni.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — avvia l'API server (porta 8080)
- `pnpm --filter @workspace/costume-vote run dev` — avvia il frontend (porta 22828)
- `pnpm run typecheck` — typecheck completo
- `pnpm run build` — typecheck + build
- `pnpm --filter @workspace/api-spec run codegen` — rigenera hook e schema Zod dall'OpenAPI spec
- `pnpm --filter @workspace/db run push` — applica migrazioni DB (solo dev)
- Env richiesti: `DATABASE_URL`, `ADMIN_PASSWORD` (default: `admin1234`), `ADMIN_TOKEN` (default: `super-secret-admin-token`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Frontend: React + Vite, Tailwind, Framer Motion, Wouter
- API codegen: Orval (da spec OpenAPI)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — contratto API (source of truth)
- `lib/db/src/schema/` — schema DB (sessions, costumes, voters, votes)
- `artifacts/api-server/src/routes/` — route Express
- `artifacts/costume-vote/src/pages/` — pagine React
- `attached_assets/grafiche/` — cartella per PNG Photoshop personalizzati

## Architecture decisions

- Auth admin via token fisso in header `x-admin-token` (semplice, no JWT)
- Voter identificato da token random 64 char in localStorage, nessun account
- Exit poll: percentuale calcolata su somma totale dei punteggi (non numero di voti)
- Una sola sessione attiva alla volta; creare nuova sessione chiude la precedente
- Password e token admin configurabili via env `ADMIN_PASSWORD` / `ADMIN_TOKEN`

## Product

- **Votanti**: nickname → vota 1-5 ogni costume → grazie. Se votazioni chiuse → schermata "attendi l'araldo"
- **Admin**: login con password → dashboard live (top 5, %, n.voti, somma) → chiudi votazioni → gestisci costumi

## User preferences

_Populate as you build._

## Gotchas

- Il token admin di default è `super-secret-admin-token` — cambiarlo in produzione via env `ADMIN_TOKEN`
- Password admin di default: `admin1234` — cambiare via env `ADMIN_PASSWORD`
- Le grafiche PNG vanno in `attached_assets/grafiche/` e sono servite tramite il proxy

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
