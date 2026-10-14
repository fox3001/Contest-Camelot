import { Router } from "express";
import { db, costumesTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { getCurrentSession } from "../lib/sessions";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const session = await getCurrentSession();
    if (!session) {
      res.json([]);
      return;
    }
    const costumes = await db
      .select()
      .from(costumesTable)
      .where(eq(costumesTable.sessionId, session.id))
      .orderBy(asc(costumesTable.displayOrder), asc(costumesTable.id));
    res.json(costumes);
  } catch (err) {
    req.log.error({ err }, "Failed to list costumes");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
