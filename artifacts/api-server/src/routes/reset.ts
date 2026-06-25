import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable, costumesTable, votersTable, votesTable } from "@workspace/db";

const RESET_PASSWORD = process.env.RESET_PASSWORD ?? "malareset";

const router = Router();

router.post("/", async (req, res) => {
  const { password, sessionName } = req.body as {
    password: string;
    sessionName: string;
  };

  if (password !== RESET_PASSWORD) {
    res.status(401).json({ error: "Password errata" });
    return;
  }

  if (!sessionName?.trim()) {
    res.status(400).json({ error: "sessionName is required" });
    return;
  }

  try {
    await db.delete(votesTable);
    await db.delete(votersTable);
    await db.delete(costumesTable);
    await db.delete(sessionsTable);

    const [session] = await db
      .insert(sessionsTable)
      .values({ name: sessionName.trim(), isOpen: true })
      .returning();

    res.status(201).json({
      id: session.id,
      name: session.name,
      isOpen: session.isOpen,
      createdAt: session.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to reset everything");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
