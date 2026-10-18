import { randomInt } from "crypto";
import { db, costumesTable, huntCatchesTable, votersTable } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // niente 0/O, 1/I

export function makeHuntCode(): string {
  let s = "";
  for (let i = 0; i < 5; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** Assegna un codice QR ai costumi della serata che non lo hanno ancora. */
export async function ensureHuntCodes(sessionId: number) {
  const missing = await db
    .select({ id: costumesTable.id })
    .from(costumesTable)
    .where(and(eq(costumesTable.sessionId, sessionId), isNull(costumesTable.huntCode)));
  if (missing.length === 0) return;
  const used = new Set(
    (
      await db.select({ c: costumesTable.huntCode }).from(costumesTable).where(eq(costumesTable.sessionId, sessionId))
    ).map((r) => r.c),
  );
  for (const { id } of missing) {
    let code = makeHuntCode();
    while (used.has(code)) code = makeHuntCode();
    used.add(code);
    await db.update(costumesTable).set({ huntCode: code }).where(eq(costumesTable.id, id));
  }
}

export type HunterRow = { voterId: number; nickname: string; count: number; minutes: number; rank: number };

/**
 * Classifica dei cacciatori: più catture; a parità, meno tempo
 * tra la prima e l'ultima cattura; poi chi ha finito prima.
 */
export async function huntLeaderboard(sessionId: number): Promise<HunterRow[]> {
  const rows = await db
    .select({
      voterId: huntCatchesTable.voterId,
      nickname: votersTable.nickname,
      count: sql<number>`count(*)::int`,
      seconds: sql<number>`coalesce(extract(epoch from max(${huntCatchesTable.createdAt}) - min(${huntCatchesTable.createdAt})), 0)::float`,
      last: sql<string>`max(${huntCatchesTable.createdAt})`,
    })
    .from(huntCatchesTable)
    .innerJoin(votersTable, eq(votersTable.id, huntCatchesTable.voterId))
    .where(eq(huntCatchesTable.sessionId, sessionId))
    .groupBy(huntCatchesTable.voterId, votersTable.nickname);
  rows.sort((a, b) => b.count - a.count || a.seconds - b.seconds || String(a.last).localeCompare(String(b.last)));
  return rows.map((r, i) => ({ voterId: r.voterId, nickname: r.nickname, count: r.count, minutes: Math.round(r.seconds / 60), rank: i + 1 }));
}
