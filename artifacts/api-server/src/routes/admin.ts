import { Router } from "express";
import { randomInt } from "crypto";
import {
  db,
  sessionsTable,
  costumesTable,
  votersTable,
  votesTable,
  voterCodesTable,
} from "@workspace/db";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import {
  checkPassword,
  clearFailedLogins,
  isLoginConfigured,
  issueToken,
  loginBlocked,
  recordFailedLogin,
  requireAdmin,
  getCurrentPassword,
  useAdminPassword,
  issueToken as newToken,
} from "../lib/adminAuth";
import { getCurrentSession, serializeSession } from "../lib/sessions";
import { rankCostumes } from "../lib/ranking";
import { checkConnection, cloudinaryEnabled, cloudinaryParseError, destroyImage, signedUpload, uploadPrivateText } from "../lib/cloudinary";
import { sanitizeTheme } from "../lib/theme";
import { ensureHuntCodes, huntLeaderboard, makeHuntCode } from "../lib/hunt";
import { latestTargets } from "../lib/targets";
import { targetsTable } from "@workspace/db";
import { settingsTable } from "@workspace/db";

const router = Router();

const MAX_COSTUMES = 180;
const MAX_CODES_PER_REQUEST = 500;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // niente 0/O, 1/I
const CODE_LENGTH = 5;

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

router.post("/login", async (req, res) => {
  const ip = req.ip ?? "unknown";
  if (!isLoginConfigured()) {
    res.status(503).json({ error: "ADMIN_PASSWORD non configurata sul server" });
    return;
  }
  if (loginBlocked(ip)) {
    res.status(429).json({ error: "Troppi tentativi, riprova tra qualche minuto" });
    return;
  }
  const { password } = (req.body ?? {}) as { password?: unknown };
  if (!checkPassword(password)) {
    recordFailedLogin(ip);
    res.status(401).json({ error: "Wrong password" });
    return;
  }
  clearFailedLogins(ip);
  res.json({ token: issueToken() });
});

router.use(requireAdmin);

// ---------------------------------------------------------------------------
// Risultati
// ---------------------------------------------------------------------------

router.get("/results", async (req, res) => {
  try {
    const session = await getCurrentSession();
    if (!session) {
      res.status(404).json({ error: "No session found" });
      return;
    }

    const [{ count: totalVoters }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(votersTable)
      .where(eq(votersTable.sessionId, session.id));

    const [codes] = await db
      .select({
        total: sql<number>`count(*)::int`,
        used: sql<number>`count(${voterCodesTable.voterId})::int`,
      })
      .from(voterCodesTable)
      .where(eq(voterCodesTable.sessionId, session.id));

    const stats = await db
      .select({
        id: costumesTable.id,
        name: costumesTable.name,
        imagePath: costumesTable.imagePath,
        totalVotes: sql<number>`count(${votesTable.id})::int`,
        sumScores: sql<number>`coalesce(sum(${votesTable.score}), 0)::int`,
      })
      .from(costumesTable)
      .leftJoin(votesTable, eq(votesTable.costumeId, costumesTable.id))
      .where(and(eq(costumesTable.sessionId, session.id), eq(costumesTable.status, "approved")))
      .groupBy(costumesTable.id, costumesTable.name, costumesTable.imagePath);

    const [{ count: pendingEntries }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(costumesTable)
      .where(and(eq(costumesTable.sessionId, session.id), eq(costumesTable.status, "pending")));

    const allCostumes = rankCostumes(stats);

    res.json({
      sessionId: session.id,
      sessionName: session.name,
      isOpen: session.isOpen,
      requireCode: session.requireCode,
      entriesOpen: session.entriesOpen,
      pendingEntries,
      huntEnabled: session.huntEnabled,
      huntName: session.huntName,
      hunters: (await huntLeaderboard(session.id)).slice(0, 20).map(({ nickname, count, minutes, rank }) => ({ nickname, count, minutes, rank })),
      totalVoters,
      codesTotal: codes?.total ?? 0,
      codesUsed: codes?.used ?? 0,
      top5: allCostumes.slice(0, 5),
      allCostumes,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get results");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Sessioni (le vecchie restano in archivio: niente più cancellazione totale)
// ---------------------------------------------------------------------------

router.post("/sessions", async (req, res) => {
  try {
    const { name } = (req.body ?? {}) as { name?: unknown };
    const clean = typeof name === "string" ? name.trim() : "";
    if (!clean || clean.length > 80) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const session = await db.transaction(async (tx) => {
      await tx.update(sessionsTable).set({ isOpen: false });
      // Le iscrizioni con foto partono aperte se Cloudinary è configurato
      const [created] = await tx
        .insert(sessionsTable)
        .values({ name: clean, isOpen: true, entriesOpen: cloudinaryEnabled() })
        .returning();
      return created;
    });
    res.status(201).json(serializeSession(session));
  } catch (err) {
    req.log.error({ err }, "Failed to create session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/sessions/:id/close", async (req, res) => {
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
    res.json(serializeSession(session));
  } catch (err) {
    req.log.error({ err }, "Failed to close session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/sessions/:id/reopen", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const session = await db.transaction(async (tx) => {
      await tx.update(sessionsTable).set({ isOpen: false }).where(ne(sessionsTable.id, id));
      const [s] = await tx.update(sessionsTable).set({ isOpen: true }).where(eq(sessionsTable.id, id)).returning();
      return s;
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(serializeSession(session));
  } catch (err) {
    req.log.error({ err }, "Failed to reopen session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/sessions/:id/settings", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { requireCode, entriesOpen, huntEnabled, huntName } = (req.body ?? {}) as Record<string, unknown>;
    const patch: { requireCode?: boolean; entriesOpen?: boolean; huntEnabled?: boolean; huntName?: string } = {};
    if (typeof requireCode === "boolean") patch.requireCode = requireCode;
    if (typeof entriesOpen === "boolean") patch.entriesOpen = entriesOpen;
    if (typeof huntEnabled === "boolean") patch.huntEnabled = huntEnabled;
    if (typeof huntName === "string" && huntName.trim()) patch.huntName = huntName.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 40);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "nothing to update" });
      return;
    }
    const [session] = await db.update(sessionsTable).set(patch).where(eq(sessionsTable.id, id)).returning();
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (session.huntEnabled) await ensureHuntCodes(session.id);
    res.json(serializeSession(session));
  } catch (err) {
    req.log.error({ err }, "Failed to update session settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Costumi
// ---------------------------------------------------------------------------

router.get("/costumes", async (req, res) => {
  try {
    const session = await getCurrentSession();
    if (!session) {
      res.json([]);
      return;
    }
    await ensureHuntCodes(session.id);
    const costumes = await db
      .select()
      .from(costumesTable)
      .where(eq(costumesTable.sessionId, session.id))
      .orderBy(asc(costumesTable.displayOrder), asc(costumesTable.id));
    res.json(costumes.map(({ deviceId, ...c }) => c));
  } catch (err) {
    req.log.error({ err }, "Failed to list costumes (admin)");
    res.status(500).json({ error: "Internal server error" });
  }
});

function readCostumeInput(body: any) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const imagePath = typeof body?.imagePath === "string" ? body.imagePath.trim() : "";
  const displayOrder = Number.isFinite(Number(body?.displayOrder)) ? Math.trunc(Number(body.displayOrder)) : 0;
  return { name, imagePath, displayOrder };
}

router.post("/costumes", async (req, res) => {
  try {
    const { name, imagePath, displayOrder } = readCostumeInput(req.body);
    if (!name || !imagePath) {
      res.status(400).json({ error: "name and imagePath are required" });
      return;
    }
    const session = await getCurrentSession();
    if (!session) {
      res.status(404).json({ error: "No session found" });
      return;
    }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(costumesTable)
      .where(eq(costumesTable.sessionId, session.id));
    if (count >= MAX_COSTUMES) {
      res.status(422).json({ error: `Limite massimo di ${MAX_COSTUMES} costumi raggiunto` });
      return;
    }
    const [costume] = await db
      .insert(costumesTable)
      .values({ sessionId: session.id, name, imagePath, displayOrder, huntCode: makeHuntCode() })
      .returning();
    res.status(201).json(costume);
  } catch (err) {
    req.log.error({ err }, "Failed to create costume");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/costumes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, imagePath, displayOrder } = readCostumeInput(req.body);
    if (!name || !imagePath) {
      res.status(400).json({ error: "name and imagePath are required" });
      return;
    }
    const [costume] = await db
      .update(costumesTable)
      .set({ name, imagePath, displayOrder })
      .where(eq(costumesTable.id, id))
      .returning();
    if (!costume) {
      res.status(404).json({ error: "Costume not found" });
      return;
    }
    res.json(costume);
  } catch (err) {
    req.log.error({ err }, "Failed to update costume");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/costumes/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = (req.body ?? {}) as { status?: unknown };
    if (status !== "approved" && status !== "rejected" && status !== "pending") {
      res.status(400).json({ error: "status must be approved, rejected or pending" });
      return;
    }
    const [costume] = await db.update(costumesTable).set({ status }).where(eq(costumesTable.id, id)).returning();
    if (!costume) {
      res.status(404).json({ error: "Costume not found" });
      return;
    }
    const { deviceId, ...rest } = costume;
    res.json(rest);
  } catch (err) {
    req.log.error({ err }, "Failed to update costume status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/costumes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(costumesTable).where(eq(costumesTable.id, id)).returning();
    if (deleted) await destroyImage(deleted.imagePublicId);
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete costume");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Azzera voti/votanti o costumi della sola sessione corrente (non usati dalla UI)
router.delete("/votes", async (req, res) => {
  try {
    const session = await getCurrentSession();
    if (!session) {
      res.status(404).json({ error: "No session found" });
      return;
    }
    await db.delete(votersTable).where(eq(votersTable.sessionId, session.id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to reset votes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/costumes", async (req, res) => {
  try {
    const session = await getCurrentSession();
    if (!session) {
      res.status(404).json({ error: "No session found" });
      return;
    }
    await db.delete(costumesTable).where(eq(costumesTable.sessionId, session.id));
    await db.delete(votersTable).where(eq(votersTable.sessionId, session.id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to reset costumes");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Codici votante
// ---------------------------------------------------------------------------

function makeCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

router.get("/codes", async (req, res) => {
  try {
    const session = await getCurrentSession();
    if (!session) {
      res.json([]);
      return;
    }
    const rows = await db
      .select({
        code: voterCodesTable.code,
        nickname: votersTable.nickname,
      })
      .from(voterCodesTable)
      .leftJoin(votersTable, eq(votersTable.id, voterCodesTable.voterId))
      .where(eq(voterCodesTable.sessionId, session.id))
      .orderBy(asc(voterCodesTable.id));
    res.json(rows.map((r) => ({ code: r.code, used: r.nickname !== null, nickname: r.nickname ?? null })));
  } catch (err) {
    req.log.error({ err }, "Failed to list codes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/codes", async (req, res) => {
  try {
    const count = Math.trunc(Number((req.body ?? {}).count));
    if (!Number.isInteger(count) || count < 1 || count > MAX_CODES_PER_REQUEST) {
      res.status(400).json({ error: `count deve essere tra 1 e ${MAX_CODES_PER_REQUEST}` });
      return;
    }
    const session = await getCurrentSession();
    if (!session) {
      res.status(404).json({ error: "No session found" });
      return;
    }
    const existing = await db
      .select({ code: voterCodesTable.code })
      .from(voterCodesTable)
      .where(eq(voterCodesTable.sessionId, session.id));
    const used = new Set(existing.map((r) => r.code));
    const fresh: string[] = [];
    while (fresh.length < count) {
      const c = makeCode();
      if (!used.has(c)) {
        used.add(c);
        fresh.push(c);
      }
    }
    await db
      .insert(voterCodesTable)
      .values(fresh.map((code) => ({ sessionId: session.id, code })))
      .onConflictDoNothing();
    res.status(201).json({ created: fresh.length });
  } catch (err) {
    req.log.error({ err }, "Failed to create codes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/codes/unused", async (req, res) => {
  try {
    const session = await getCurrentSession();
    if (!session) {
      res.status(404).json({ error: "No session found" });
      return;
    }
    await db
      .delete(voterCodesTable)
      .where(and(eq(voterCodesTable.sessionId, session.id), sql`${voterCodesTable.voterId} is null`));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete unused codes");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Aspetto grafico
// ---------------------------------------------------------------------------

router.put("/theme", async (req, res) => {
  try {
    const theme = sanitizeTheme((req.body ?? {}).theme);
    const [row] = await db
      .insert(settingsTable)
      .values({ key: "theme", value: theme })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: theme, updatedAt: new Date() } })
      .returning();
    res.json({ theme: sanitizeTheme(row.value), updatedAt: row.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to save theme");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Temi salvati dall'admin per riusarli in altri eventi
type SavedTheme = { name: string; theme: ReturnType<typeof sanitizeTheme>; savedAt: string };

async function readSavedThemes(): Promise<SavedTheme[]> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "saved_themes"));
  const list = Array.isArray(row?.value) ? (row!.value as any[]) : [];
  return list
    .filter((t) => t && typeof t.name === "string")
    .map((t) => ({ name: t.name, theme: sanitizeTheme(t.theme), savedAt: String(t.savedAt ?? "") }));
}

async function writeSavedThemes(list: SavedTheme[]) {
  await db
    .insert(settingsTable)
    .values({ key: "saved_themes", value: list })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: list, updatedAt: new Date() } });
}

router.get("/themes", async (req, res) => {
  try {
    res.json({ themes: await readSavedThemes() });
  } catch (err) {
    req.log.error({ err }, "Failed to read saved themes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/themes", async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 40) : "";
    if (!name) {
      res.status(400).json({ error: "Nome del tema mancante" });
      return;
    }
    const list = (await readSavedThemes()).filter((t) => t.name.toLowerCase() !== name.toLowerCase());
    if (list.length >= 30) {
      res.status(400).json({ error: "Troppi temi salvati: eliminane qualcuno" });
      return;
    }
    list.unshift({ name, theme: sanitizeTheme(req.body?.theme), savedAt: new Date().toISOString() });
    await writeSavedThemes(list);
    res.json({ themes: list });
  } catch (err) {
    req.log.error({ err }, "Failed to save theme preset");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/themes", async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    const list = (await readSavedThemes()).filter((t) => t.name !== name);
    await writeSavedThemes(list);
    res.json({ themes: list });
  } catch (err) {
    req.log.error({ err }, "Failed to delete theme preset");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Target Hunt
// ---------------------------------------------------------------------------

router.get("/targets", async (req, res) => {
  try {
    const session = await getCurrentSession();
    if (!session) {
      res.json([]);
      return;
    }
    const rows = await latestTargets(session.id, 50);
    res.json(rows.map((t) => ({ ...t, createdAt: t.createdAt.toISOString(), wonAt: t.wonAt?.toISOString() ?? null })));
  } catch (err) {
    req.log.error({ err }, "Failed to list targets");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/targets", async (req, res) => {
  try {
    const session = await getCurrentSession();
    if (!session) {
      res.status(404).json({ error: "No session found" });
      return;
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0009\u000b-\u001f]/g, " ").trim().slice(0, max) : "");
    const costumeId = Number(b.costumeId);
    const riddle = clean(b.riddle, 400);
    const prize = clean(b.prize, 80);
    const prizeInfo = clean(b.prizeInfo, 300);
    const title = clean(b.title, 40) || "Target Hunt";
    if (!Number.isInteger(costumeId) || !riddle || !prize) {
      res.status(400).json({ error: "Servono costume, indovinello e premio" });
      return;
    }
    const [costume] = await db
      .select()
      .from(costumesTable)
      .where(and(eq(costumesTable.id, costumeId), eq(costumesTable.sessionId, session.id), eq(costumesTable.status, "approved")))
      .limit(1);
    if (!costume) {
      res.status(400).json({ error: "Costume non in gara" });
      return;
    }
    await ensureHuntCodes(session.id);
    const target = await db.transaction(async (tx) => {
      // Un solo target attivo alla volta: quello precedente viene annullato
      await tx
        .update(targetsTable)
        .set({ status: "cancelled" })
        .where(and(eq(targetsTable.sessionId, session.id), eq(targetsTable.status, "active")));
      const [t] = await tx.insert(targetsTable).values({ sessionId: session.id, costumeId, riddle, prize, prizeInfo, title }).returning();
      return t;
    });
    res.status(201).json({ id: target.id });
  } catch (err) {
    req.log.error({ err }, "Failed to create target");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/targets/:id/cancel", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.update(targetsTable).set({ status: "cancelled" }).where(and(eq(targetsTable.id, id), eq(targetsTable.status, "active")));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to cancel target");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Password admin
// ---------------------------------------------------------------------------

router.get("/password", (_req, res) => {
  res.json({ password: getCurrentPassword() });
});

router.put("/password", async (req, res) => {
  try {
    const next = typeof req.body?.password === "string" ? req.body.password.trim() : "";
    if (next.length < 4 || next.length > 100) {
      res.status(400).json({ error: "La password deve avere da 4 a 100 caratteri" });
      return;
    }
    await db
      .insert(settingsTable)
      .values({ key: "admin_password", value: { password: next } })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: { password: next }, updatedAt: new Date() } });
    useAdminPassword(next);
    // Copia di recupero privata su Cloudinary (si aggiorna a ogni cambio)
    const when = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
    const backup = await uploadPrivateText(
      "password-admin.txt",
      `Password del pannello admin di Contest Camelot\n\n${next}\n\nAggiornata il ${when}\n`,
    );
    // Gli altri accessi scadono; chi l'ha cambiata riceve un nuovo accesso valido
    res.json({ ok: true, backup, token: newToken() });
  } catch (err) {
    req.log.error({ err }, "Failed to change admin password");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Diagnostica: la chiave Cloudinary è giusta?
router.get("/cloudinary/check", async (_req, res) => {
  if (cloudinaryParseError) {
    res.json({ ok: false, problem: "format" });
    return;
  }
  res.json(await checkConnection());
});

// Firma per caricare logo e sfondi su Cloudinary
router.post("/uploads/sign", async (req, res) => {
  if (!cloudinaryEnabled()) {
    res.status(503).json({ error: "cloudinary_unavailable" });
    return;
  }
  try {
    res.json(signedUpload("contest-camelot/aspetto"));
  } catch (err) {
    req.log.error({ err }, "Failed to sign admin upload");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
