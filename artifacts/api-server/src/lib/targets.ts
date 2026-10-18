import { randomInt } from "crypto";
import { db, targetsTable, votersTable, costumesTable } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";

export async function activeTarget(sessionId: number) {
  const [t] = await db
    .select()
    .from(targetsTable)
    .where(and(eq(targetsTable.sessionId, sessionId), eq(targetsTable.status, "active")))
    .orderBy(desc(targetsTable.id))
    .limit(1);
  return t ?? null;
}

/**
 * Prova ad assegnare la vittoria: l'aggiornamento è atomico, quindi anche
 * se due persone scansionano nello stesso istante vince una sola.
 */
export async function tryWinTarget(sessionId: number, costumeId: number, voterId: number) {
  const t = await activeTarget(sessionId);
  if (!t || t.costumeId !== costumeId) return null;
  const claimCode = String(randomInt(1000, 10000));
  const [won] = await db
    .update(targetsTable)
    .set({ status: "won", winnerVoterId: voterId, claimCode, wonAt: new Date() })
    .where(and(eq(targetsTable.id, t.id), eq(targetsTable.status, "active"), isNull(targetsTable.winnerVoterId)))
    .returning();
  if (!won) return null;
  return { targetId: won.id, title: won.title, prize: won.prize, claimCode };
}

/** Target della serata, dal più recente, con il nome del vincitore. */
export async function latestTargets(sessionId: number, limit = 20) {
  return db
    .select({
      id: targetsTable.id,
      costumeId: targetsTable.costumeId,
      costumeName: costumesTable.name,
      costumeImage: costumesTable.imagePath,
      title: targetsTable.title,
      riddle: targetsTable.riddle,
      prize: targetsTable.prize,
      status: targetsTable.status,
      winnerVoterId: targetsTable.winnerVoterId,
      winnerNickname: votersTable.nickname,
      claimCode: targetsTable.claimCode,
      createdAt: targetsTable.createdAt,
      wonAt: targetsTable.wonAt,
    })
    .from(targetsTable)
    .innerJoin(costumesTable, eq(costumesTable.id, targetsTable.costumeId))
    .leftJoin(votersTable, eq(votersTable.id, targetsTable.winnerVoterId))
    .where(eq(targetsTable.sessionId, sessionId))
    .orderBy(desc(targetsTable.id))
    .limit(limit);
}
