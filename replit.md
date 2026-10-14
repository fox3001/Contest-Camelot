# Costume Vote

App di votazione per concorso costumi: i partecipanti entrano via QR code, scelgono un nickname e votano da 1 a 5 le foto dei costumi in gara. L'admin vede i risultati live e gestisce le sessioni.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — avvia l'API server (porta 8080)
- `pnpm --filter @workspace/costume-vote run dev` — avvia il frontend (porta 22828)
- `pnpm run typecheck` — typecheck completo
- `pnpm run build` — typecheck + build
- `pnpm --filter @workspace/api-spec run codegen` — rigenera hook e schema Zod dall'OpenAPI spec
- `pnpm --filter @workspace/db run push` — applica migrazioni DB (solo dev)
- Env richiesti: `DATABASE_URL`, `ADMIN_PASSWORD` (obbligatoria, nessun default). Consigliata `ADMIN_TOKEN` (chiave di firma dei login admin)
- Lo schema DB si aggiorna da solo all'avvio (`lib/db/src/ensureSchema.ts`), anche su Railway

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

- Auth admin: login con `ADMIN_PASSWORD` → token firmato HMAC (chiave `ADMIN_TOKEN`) con scadenza 12 h, header `x-admin-token`; max 8 tentativi sbagliati per IP ogni 10 minuti
- Votante: token random in localStorage + id dispositivo casuale; un votante per dispositivo per sessione; nickname unici (senza distinzione maiuscole)
- Codici votante opzionali (monouso, 5 caratteri) attivabili per sessione da Gestione
- Classifica: media bayesiana (peso 5 voti alla media generale), non somma dei punti — vedi `artifacts/api-server/src/lib/ranking.ts`
- Ordine dei costumi mescolato per ogni votante (stabile per lo stesso votante)
- Una sola sessione aperta alla volta; nuova sessione chiude la precedente ma NON cancella nulla; una sessione chiusa si può riaprire
- Nessun reset pubblico: la rotta `/api/reset` è stata rimossa

## Product

- **Votanti**: nickname (+ codice se richiesto) → vota 1-5 ogni costume, con ricerca → grazie. Se votazioni chiuse → schermata "attendi l'araldo"
- **Admin**: login con password → dashboard live (top 5, media, n.voti, punteggio) → chiudi/riapri votazioni → gestisci costumi (aggiungi, modifica, elimina con conferma) e codici votante (genera, stampa, CSV)

## User preferences

_Populate as you build._

## Gotchas

- Senza `ADMIN_PASSWORD` il login admin risponde 503
- Il pulsante "Admin" non è più visibile ai votanti: il pannello si apre da `/admin`
- Le grafiche PNG vanno in `attached_assets/grafiche/` e sono servite tramite il proxy

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
