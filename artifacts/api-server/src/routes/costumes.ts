import { Router } from "express";
import { db } from "@workspace/db";
import { costumesTable, sessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .orderBy(desc(sessionsTable.createdAt))
      .limit(1);

    if (!session) {
      res.json([]);
      return;
    }

    const costumes = await db
      .select()
      .from(costumesTable)
      .where(eq(costumesTable.sessionId, session.id))
      .orderBy(costumesTable.displayOrder);

    res.json(costumes);
  } catch (err) {
    req.log.error({ err }, "Failed to list costumes");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
