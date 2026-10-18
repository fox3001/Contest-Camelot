import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sanitizeTheme } from "../lib/theme";

const router = Router();

// Aspetto grafico pubblico: lo leggono tutte le pagine all'avvio
router.get("/", async (req, res) => {
  try {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "theme")).limit(1);
    res.set("Cache-Control", "no-cache");
    res.json({ theme: sanitizeTheme(row?.value ?? {}), updatedAt: row?.updatedAt?.toISOString() ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to read theme");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
