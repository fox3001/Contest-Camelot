import { Router } from "express";
import { db } from "@workspace/db";
import { votesTable, votersTable, sessionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { token } = req.query as { token?: string };

    if (!token) {
      res.status(400).json({ error: "token query param is required" });
      return;
    }

    const [voter] = await db
      .select()
      .from(votersTable)
      .where(eq(votersTable.token, token))
      .limit(1);

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
    const { voterToken, votes } = req.body as {
      voterToken: string;
      votes: Array<{ costumeId: number; score: number }>;
    };

    if (!voterToken || !votes || !Array.isArray(votes)) {
      res.status(400).json({ error: "voterToken and votes are required" });
      return;
    }

    const [voter] = await db
      .select()
      .from(votersTable)
      .where(eq(votersTable.token, voterToken))
      .limit(1);

    if (!voter) {
      res.status(404).json({ error: "Voter not found" });
      return;
    }

    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, voter.sessionId))
      .limit(1);

    if (!session || !session.isOpen) {
      res.status(403).json({ error: "Voting is closed" });
      return;
    }

    for (const vote of votes) {
      if (vote.score < 1 || vote.score > 5) {
        res.status(400).json({ error: "Score must be between 1 and 5" });
        return;
      }
    }

    const rows = votes.map((v) => ({
      voterId: voter.id,
      costumeId: v.costumeId,
      score: v.score,
    }));

    if (rows.length > 0) {
      await db
        .insert(votesTable)
        .values(rows)
        .onConflictDoUpdate({
          target: [votesTable.voterId, votesTable.costumeId],
          set: { score: sql`excluded.score` },
        });
    }

    res.status(201).json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to submit votes");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
