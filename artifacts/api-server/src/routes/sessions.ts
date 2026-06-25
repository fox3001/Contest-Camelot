import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.get("/active", async (req, res) => {
  try {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.isOpen, true))
      .orderBy(desc(sessionsTable.createdAt))
      .limit(1);

    if (!session) {
      const [lastClosed] = await db
        .select()
        .from(sessionsTable)
        .orderBy(desc(sessionsTable.createdAt))
        .limit(1);

      if (!lastClosed) {
        res.status(404).json({ error: "No session found" });
        return;
      }
      res.json({
        id: lastClosed.id,
        name: lastClosed.name,
        isOpen: lastClosed.isOpen,
        createdAt: lastClosed.createdAt.toISOString(),
      });
      return;
    }

    res.json({
      id: session.id,
      name: session.name,
      isOpen: session.isOpen,
      createdAt: session.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get active session");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
