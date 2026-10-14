import { Router } from "express";
import { db, costumesTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
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
      .where(and(eq(costumesTable.sessionId, session.id), eq(costumesTable.status, "approved")))
      .orderBy(asc(costumesTable.displayOrder), asc(costumesTable.id));
    // Dati pubblici: niente dispositivo, nome di chi ha iscritto o id interni della foto
    res.json(
      costumes.map((c) => ({
        id: c.id,
        sessionId: c.sessionId,
        name: c.name,
        imagePath: c.imagePath,
        displayOrder: c.displayOrder,
        status: c.status,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list costumes");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
