import { Router } from "express";
import { db } from "@workspace/db";
import { votersTable, sessionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { nickname, sessionId } = req.body as { nickname: string; sessionId: number };

    if (!nickname || !sessionId) {
      res.status(400).json({ error: "nickname and sessionId are required" });
      return;
    }

    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (!session.isOpen) {
      res.status(403).json({ error: "Voting is closed" });
      return;
    }

    const [existing] = await db
      .select()
      .from(votersTable)
      .where(and(eq(votersTable.sessionId, sessionId), eq(votersTable.nickname, nickname.trim())))
      .limit(1);

    if (existing) {
      res.status(200).json({
        id: existing.id,
        nickname: existing.nickname,
        sessionId: existing.sessionId,
        token: existing.token,
      });
      return;
    }

    const token = randomBytes(32).toString("hex");

    const [voter] = await db
      .insert(votersTable)
      .values({ sessionId, nickname: nickname.trim(), token })
      .returning();

    res.status(201).json({
      id: voter.id,
      nickname: voter.nickname,
      sessionId: voter.sessionId,
      token: voter.token,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to register voter");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
