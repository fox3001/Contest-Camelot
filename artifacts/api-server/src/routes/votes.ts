import { Router } from "express";
import { db, votesTable, votersTable, sessionsTable, costumesTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";

const router = Router();

const MAX_VOTES_PER_REQUEST = 200;

router.get("/", async (req, res) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) {
      res.status(400).json({ error: "token query param is required" });
      return;
    }
    const [voter] = await db.select().from(votersTable).where(eq(votersTable.token, token)).limit(1);
    if (!voter) {
      res.status(404).json({ error: "Voter not found" });
      return;
    }
    const votes = await db
      .select({ costumeId: votesTable.costumeId, score: votesTable.score })
      .from(votesTable)
      .where(eq(votesTable.voterId, voter.id));
    res.json(votes);
  } catch (err) {
    req.log.error({ err }, "Failed to get votes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { voterToken, votes } = (req.body ?? {}) as {
      voterToken?: unknown;
      votes?: unknown;
    };
    if (typeof voterToken !== "string" || !Array.isArray(votes)) {
      res.status(400).json({ error: "voterToken and votes are required" });
      return;
    }
    if (votes.length > MAX_VOTES_PER_REQUEST) {
      res.status(400).json({ error: "Too many votes in one request" });
      return;
    }

    // Validazione: punteggi interi 1–5, un voto per costume
    const byCostume = new Map<number, number>();
    for (const v of votes as Array<{ costumeId?: unknown; score?: unknown }>) {
      const costumeId = Number(v?.costumeId);
      const score = Number(v?.score);
      if (!Number.isInteger(costumeId) || !Number.isInteger(score) || score < 1 || score > 5) {
        res.status(400).json({ error: "Score must be an integer between 1 and 5" });
        return;
      }
      byCostume.set(costumeId, score);
    }

    const [voter] = await db.select().from(votersTable).where(eq(votersTable.token, voterToken)).limit(1);
    if (!voter) {
      res.status(404).json({ error: "Voter not found" });
      return;
    }

    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, voter.sessionId)).limit(1);
    if (!session || !session.isOpen) {
      res.status(403).json({ error: "Voting is closed" });
      return;
    }

    if (byCostume.size === 0) {
      res.status(201).json({ success: true });
      return;
    }

    // Solo costumi della sessione del votante
    const ids = [...byCostume.keys()];
    const valid = await db
      .select({ id: costumesTable.id })
      .from(costumesTable)
      .where(and(eq(costumesTable.sessionId, voter.sessionId), eq(costumesTable.status, "approved"), inArray(costumesTable.id, ids)));
    if (valid.length !== ids.length) {
      res.status(400).json({ error: "Costume not in this session" });
      return;
    }

    // Non si vota il proprio costume (iscritto dallo stesso telefono)
    if (voter.deviceId) {
      const own = await db
        .select({ id: costumesTable.id })
        .from(costumesTable)
        .where(and(eq(costumesTable.deviceId, voter.deviceId), inArray(costumesTable.id, ids)));
      if (own.length > 0) {
        res.status(403).json({ error: "own_costume", message: "Non puoi votare il tuo costume" });
        return;
      }
    }

    await db
      .insert(votesTable)
      .values(ids.map((costumeId) => ({ voterId: voter.id, costumeId, score: byCostume.get(costumeId)! })))
      .onConflictDoUpdate({
        target: [votesTable.voterId, votesTable.costumeId],
        set: { score: sql`excluded.score` },
      });

    res.status(201).json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to submit votes");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
