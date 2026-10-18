import { Router } from "express";
import { db, costumesTable, huntCatchesTable, sessionsTable, votersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

/**
 * Modalità caccia ("Photo Hunters"): il votante scansiona il QR di un costume
 * (o ne scrive il codice) e lo "cattura"; solo dopo può votarlo.
 */
const router = Router();

async function voterFromToken(token: unknown) {
  if (typeof token !== "string" || !token) return null;
  const [voter] = await db.select().from(votersTable).where(eq(votersTable.token, token)).limit(1);
  return voter ?? null;
}

router.post("/catch", async (req, res) => {
  try {
    const voter = await voterFromToken(req.body?.voterToken);
    if (!voter) {
      res.status(401).json({ error: "not_registered" });
      return;
    }
    const raw = typeof req.body?.code === "string" ? req.body.code : "";
    // Accetta sia il codice sia il link completo del QR
    const code = (raw.match(/caccia\/([A-Za-z0-9]{5})/)?.[1] ?? raw).trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }
    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, voter.sessionId)).limit(1);
    if (!session?.huntEnabled) {
      res.status(403).json({ error: "hunt_off" });
      return;
    }
    const [costume] = await db
      .select()
      .from(costumesTable)
      .where(and(eq(costumesTable.sessionId, voter.sessionId), eq(costumesTable.huntCode, code)))
      .limit(1);
    if (!costume || costume.status !== "approved") {
      res.status(404).json({ error: "unknown_code" });
      return;
    }
    if (voter.deviceId && costume.deviceId === voter.deviceId) {
      res.status(403).json({ error: "own_costume", costumeId: costume.id, name: costume.name });
      return;
    }
    const inserted = await db
      .insert(huntCatchesTable)
      .values({ sessionId: voter.sessionId, voterId: voter.id, costumeId: costume.id })
      .onConflictDoNothing()
      .returning({ id: huntCatchesTable.id });
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(huntCatchesTable)
      .where(eq(huntCatchesTable.voterId, voter.id));
    res.json({ costumeId: costume.id, name: costume.name, imagePath: costume.imagePath, already: inserted.length === 0, count });
  } catch (err) {
    req.log.error({ err }, "Failed to record catch");
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const voter = await voterFromToken(req.query.token);
    if (!voter) {
      res.status(401).json({ error: "not_registered" });
      return;
    }
    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, voter.sessionId)).limit(1);
    const caught = await db
      .select({ costumeId: huntCatchesTable.costumeId })
      .from(huntCatchesTable)
      .where(eq(huntCatchesTable.voterId, voter.id));
    // La classifica dei cacciatori la vede solo l'admin: al votante solo i suoi progressi
    res.json({
      enabled: !!session?.huntEnabled,
      name: session?.huntName ?? "Photo Hunters",
      caught: caught.map((c) => c.costumeId),
      count: caught.length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to read hunt status");
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
