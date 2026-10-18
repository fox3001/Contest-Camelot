import { randomBytes, randomInt } from "crypto";
import { db, costumesTable, votersTable, votesTable, huntCatchesTable } from "@workspace/db";
import { and, eq, like } from "drizzle-orm";
import { makeHuntCode } from "./hunt";

/**
 * Utenti di prova: 5 persone finte che si sono iscritte con un costume e hanno votato.
 * Sono riconoscibili dal dispositivo "demo-…", così si cancellano tutte insieme.
 * Al posto della foto c'è una casella con scritto "Costume di <nome>" (nessun credito Cloudinary).
 */
const PEOPLE = [
  { nickname: "Giulia R.", first: "Giulia", costume: "Regina dei Ghiacci" },
  { nickname: "marco_87", first: "Marco", costume: "Cavaliere Nero" },
  { nickname: "Fra", first: "Francesca", costume: "Fata dei Boschi" },
  { nickname: "Luca B", first: "Luca", costume: "Druido Errante" },
  { nickname: "Chiaretta", first: "Chiara", costume: "Strega del Nord" },
];

export const DEMO_PREFIX = "demo-";

export function demoImagePath(first: string) {
  return `/api/demo-image/${encodeURIComponent(first)}.svg`;
}

/** Casella vuota con il nome: 4:5 come le foto dei costumi. */
export function demoImageSvg(first: string) {
  const name = first.replace(/[^\p{L} ]/gu, "").slice(0, 20) || "?";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<rect width="800" height="1000" fill="#2a2a2e"/>
<rect x="30" y="30" width="740" height="940" rx="36" fill="none" stroke="#6b6b73" stroke-width="6" stroke-dasharray="28 20"/>
<text x="400" y="470" text-anchor="middle" font-family="sans-serif" font-size="54" fill="#a9a9b2">Costume di</text>
<text x="400" y="560" text-anchor="middle" font-family="sans-serif" font-size="78" font-weight="700" fill="#e6e6ea">${name}</text>
</svg>`;
}

export async function countDemo(sessionId: number) {
  const rows = await db
    .select({ id: votersTable.id })
    .from(votersTable)
    .where(and(eq(votersTable.sessionId, sessionId), like(votersTable.deviceId, `${DEMO_PREFIX}%`)));
  return rows.length;
}

export async function removeDemo(sessionId: number) {
  // voti e catture si cancellano a cascata con votanti e costumi
  await db.delete(votersTable).where(and(eq(votersTable.sessionId, sessionId), like(votersTable.deviceId, `${DEMO_PREFIX}%`)));
  await db.delete(costumesTable).where(and(eq(costumesTable.sessionId, sessionId), like(costumesTable.deviceId, `${DEMO_PREFIX}%`)));
}

export async function createDemo(sessionId: number, huntEnabled: boolean) {
  await removeDemo(sessionId);
  await db.transaction(async (tx) => {
    const created: { voterId: number; costumeId: number }[] = [];
    for (const [i, p] of PEOPLE.entries()) {
      const deviceId = `${DEMO_PREFIX}${i + 1}-${randomBytes(4).toString("hex")}`;
      const [voter] = await tx
        .insert(votersTable)
        .values({ sessionId, nickname: p.nickname, token: randomBytes(32).toString("hex"), deviceId })
        .returning();
      const [costume] = await tx
        .insert(costumesTable)
        .values({
          sessionId,
          name: p.costume,
          imagePath: demoImagePath(p.first),
          status: "approved",
          deviceId,
          submittedBy: p.nickname,
          huntCode: makeHuntCode(),
        })
        .returning();
      created.push({ voterId: voter.id, costumeId: costume.id });
    }
    // Ognuno vota tutti i costumi in gara tranne il proprio (anche quelli veri già presenti)
    const inGara = await tx
      .select({ id: costumesTable.id })
      .from(costumesTable)
      .where(and(eq(costumesTable.sessionId, sessionId), eq(costumesTable.status, "approved")));
    for (const c of created) {
      const targets = inGara.filter((x) => x.id !== c.costumeId);
      if (!targets.length) continue;
      await tx.insert(votesTable).values(targets.map((t) => ({ voterId: c.voterId, costumeId: t.id, score: randomInt(2, 6) })));
      // Con la caccia attiva i voti valgono solo per i costumi "catturati"
      if (huntEnabled) {
        await tx
          .insert(huntCatchesTable)
          .values(targets.map((t) => ({ sessionId, voterId: c.voterId, costumeId: t.id })))
          .onConflictDoNothing();
      }
    }
  });
  return countDemo(sessionId);
}

