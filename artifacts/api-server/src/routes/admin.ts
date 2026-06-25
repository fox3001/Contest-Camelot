import { Router } from "express";
import { db } from "@workspace/db";
import {
  sessionsTable,
  costumesTable,
  votersTable,
  votesTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Malacontest";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "super-secret-admin-token";

function requireAdmin(req: any, res: any, next: any) {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const router = Router();

router.post("/login", async (req, res) => {
  const { password } = req.body as { password: string };
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Wrong password" });
    return;
  }
  res.json({ token: ADMIN_TOKEN });
});

router.get("/results", requireAdmin, async (req, res) => {
  try {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .orderBy(desc(sessionsTable.createdAt))
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "No session found" });
      return;
    }

    const totalVotersResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(votersTable)
      .where(eq(votersTable.sessionId, session.id));

    const totalVoters = totalVotersResult[0]?.count ?? 0;

    const costumeStats = await db
      .select({
        id: costumesTable.id,
        name: costumesTable.name,
        imagePath: costumesTable.imagePath,
        totalVotes: sql<number>`count(${votesTable.id})::int`,
        sumScores: sql<number>`coalesce(sum(${votesTable.score}), 0)::int`,
      })
      .from(costumesTable)
      .leftJoin(votesTable, eq(votesTable.costumeId, costumesTable.id))
      .where(eq(costumesTable.sessionId, session.id))
      .groupBy(costumesTable.id, costumesTable.name, costumesTable.imagePath)
      .orderBy(desc(sql`coalesce(sum(${votesTable.score}), 0)`));

    const totalSum = costumeStats.reduce((acc, c) => acc + (c.sumScores ?? 0), 0);

    const allCostumes = costumeStats.map((c, i) => ({
      id: c.id,
      name: c.name,
      imagePath: c.imagePath,
      totalVotes: c.totalVotes ?? 0,
      sumScores: c.sumScores ?? 0,
      percentage: totalSum > 0 ? Math.round(((c.sumScores ?? 0) / totalSum) * 1000) / 10 : 0,
      rank: i + 1,
    }));

    const top5 = allCostumes.slice(0, 5);

    res.json({
      sessionId: session.id,
      sessionName: session.name,
      isOpen: session.isOpen,
      totalVoters,
      top5,
      allCostumes,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get results");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/sessions", requireAdmin, async (req, res) => {
  try {
    const { name } = req.body as { name: string };
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    await db.update(sessionsTable).set({ isOpen: false });
    const [session] = await db
      .insert(sessionsTable)
      .values({ name, isOpen: true })
      .returning();
    res.status(201).json({
      id: session.id,
      name: session.name,
      isOpen: session.isOpen,
      createdAt: session.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/sessions/:id/close", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [session] = await db
      .update(sessionsTable)
      .set({ isOpen: false })
      .where(eq(sessionsTable.id, id))
      .returning();

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json({
      id: session.id,
      name: session.name,
      isOpen: session.isOpen,
      createdAt: session.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to close session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/costumes", requireAdmin, async (req, res) => {
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
    req.log.error({ err }, "Failed to list costumes (admin)");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/costumes", requireAdmin, async (req, res) => {
  try {
    const { name, imagePath, displayOrder } = req.body as {
      name: string;
      imagePath: string;
      displayOrder: number;
    };

    if (!name || !imagePath) {
      res.status(400).json({ error: "name and imagePath are required" });
      return;
    }

    const [session] = await db
      .select()
      .from(sessionsTable)
      .orderBy(desc(sessionsTable.createdAt))
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "No session found" });
      return;
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(costumesTable)
      .where(eq(costumesTable.sessionId, session.id));

    if (count >= 180) {
      res.status(422).json({ error: "Limite massimo di 180 costumi raggiunto" });
      return;
    }

    const [costume] = await db
      .insert(costumesTable)
      .values({
        sessionId: session.id,
        name,
        imagePath,
        displayOrder: displayOrder ?? 0,
      })
      .returning();

    res.status(201).json(costume);
  } catch (err) {
    req.log.error({ err }, "Failed to create costume");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/votes", requireAdmin, async (req, res) => {
  try {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .orderBy(desc(sessionsTable.createdAt))
      .limit(1);
    if (!session) {
      res.status(404).json({ error: "No session found" });
      return;
    }
    // Deleting voters cascades to votes automatically
    await db.delete(votersTable).where(eq(votersTable.sessionId, session.id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to reset votes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/costumes", requireAdmin, async (req, res) => {
  try {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .orderBy(desc(sessionsTable.createdAt))
      .limit(1);
    if (!session) {
      res.status(404).json({ error: "No session found" });
      return;
    }
    // Deleting costumes cascades to votes; then clean up voters too
    await db.delete(costumesTable).where(eq(costumesTable.sessionId, session.id));
    await db.delete(votersTable).where(eq(votersTable.sessionId, session.id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to reset costumes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reset", requireAdmin, async (req, res) => {
  try {
    const { name } = req.body as { name: string };
    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    await db.delete(votesTable);
    await db.delete(votersTable);
    await db.delete(costumesTable);
    await db.delete(sessionsTable);
    const [session] = await db
      .insert(sessionsTable)
      .values({ name: name.trim(), isOpen: true })
      .returning();
    res.status(201).json({
      id: session.id,
      name: session.name,
      isOpen: session.isOpen,
      createdAt: session.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to reset all data");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/costumes/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(costumesTable).where(eq(costumesTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete costume");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
