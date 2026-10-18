import { Router } from "express";
import { db, costumesTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentSession } from "../lib/sessions";
import { cloudinaryEnabled, destroyImage, isOwnUpload, uploadSignature } from "../lib/cloudinary";
import { ensureHuntCodes, makeHuntCode } from "../lib/hunt";

/**
 * Iscrizioni dei partecipanti: ogni telefono iscrive un costume per sessione.
 * Il costume entra "in attesa" e compare nel voto solo dopo l'approvazione dell'admin.
 * Finché non è approvato, il partecipante può cambiare nome e foto.
 */

const router = Router();

const NAME_MAX = 60;
const AUTHOR_MAX = 40;
const MAX_COSTUMES = 180;

function readDevice(value: unknown): string | null {
  const d = typeof value === "string" ? value.trim() : "";
  return d.length >= 16 && d.length <= 128 ? d : null;
}

function serializeEntry(c: typeof costumesTable.$inferSelect, huntEnabled = false) {
  return {
    id: c.id,
    name: c.name,
    submittedBy: c.submittedBy,
    imagePath: c.imagePath,
    status: c.status,
    // Il QR serve solo quando il costume è in gara e la modalità caccia è attiva
    huntCode: huntEnabled && c.status === "approved" ? c.huntCode : null,
  };
}

async function openSessionForEntries(res: any) {
  if (!cloudinaryEnabled()) {
    res.status(503).json({ error: "entries_unavailable", message: "Iscrizioni con foto non configurate" });
    return null;
  }
  const session = await getCurrentSession();
  if (!session) {
    res.status(404).json({ error: "no_session", message: "Nessuna serata attiva" });
    return null;
  }
  if (!session.entriesOpen) {
    res.status(403).json({ error: "entries_closed", message: "Le iscrizioni sono chiuse" });
    return null;
  }
  return session;
}

async function findEntry(sessionId: number, deviceId: string) {
  const [entry] = await db
    .select()
    .from(costumesTable)
    .where(and(eq(costumesTable.sessionId, sessionId), eq(costumesTable.deviceId, deviceId)))
    .limit(1);
  return entry;
}

// La mia iscrizione nella serata corrente
router.get("/mine", async (req, res) => {
  try {
    const deviceId = readDevice(req.query.deviceId);
    if (!deviceId) {
      res.status(400).json({ error: "invalid_device" });
      return;
    }
    const session = await getCurrentSession();
    if (!session) {
      res.json({ entry: null });
      return;
    }
    if (session.huntEnabled) await ensureHuntCodes(session.id);
    const entry = await findEntry(session.id, deviceId);
    res.json({ entry: entry ? serializeEntry(entry, session.huntEnabled) : null, huntEnabled: session.huntEnabled, huntName: session.huntName });
  } catch (err) {
    req.log.error({ err }, "Failed to get entry");
    res.status(500).json({ error: "server_error" });
  }
});

// Firma per caricare UNA foto su Cloudinary
router.post("/sign", async (req, res) => {
  try {
    const deviceId = readDevice((req.body ?? {}).deviceId);
    if (!deviceId) {
      res.status(400).json({ error: "invalid_device" });
      return;
    }
    const session = await openSessionForEntries(res);
    if (!session) return;
    const existing = await findEntry(session.id, deviceId);
    if (existing?.status === "approved") {
      res.status(409).json({ error: "already_approved", message: "Il tuo costume è già in gara" });
      return;
    }
    res.json(uploadSignature(session.id));
  } catch (err) {
    req.log.error({ err }, "Failed to sign upload");
    res.status(500).json({ error: "server_error" });
  }
});

// Crea o aggiorna l'iscrizione dopo l'upload
router.post("/", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const deviceId = readDevice(body.deviceId);
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    const submittedBy = typeof body.submittedBy === "string" ? body.submittedBy.trim().replace(/\s+/g, " ") : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    const publicId = typeof body.publicId === "string" ? body.publicId.trim() : "";

    if (!deviceId) {
      res.status(400).json({ error: "invalid_device" });
      return;
    }
    if (!name || name.length > NAME_MAX || submittedBy.length > AUTHOR_MAX) {
      res.status(400).json({ error: "invalid_name", message: "Nome del costume non valido" });
      return;
    }
    const session = await openSessionForEntries(res);
    if (!session) return;
    if (!isOwnUpload(imageUrl, publicId, session.id)) {
      res.status(400).json({ error: "invalid_image", message: "Foto non valida, caricala di nuovo" });
      return;
    }

    const existing = await findEntry(session.id, deviceId);
    if (existing?.status === "approved") {
      res.status(409).json({ error: "already_approved", message: "Il tuo costume è già in gara" });
      return;
    }

    if (existing) {
      const [updated] = await db
        .update(costumesTable)
        .set({ name, submittedBy: submittedBy || null, imagePath: imageUrl, imagePublicId: publicId, status: "pending" })
        .where(eq(costumesTable.id, existing.id))
        .returning();
      if (existing.imagePublicId && existing.imagePublicId !== publicId) await destroyImage(existing.imagePublicId);
      res.json({ entry: serializeEntry(updated) });
      return;
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(costumesTable)
      .where(eq(costumesTable.sessionId, session.id));
    if (count >= MAX_COSTUMES) {
      res.status(422).json({ error: "full", message: "Raggiunto il numero massimo di costumi" });
      return;
    }

    const [created] = await db
      .insert(costumesTable)
      .values({
        sessionId: session.id,
        name,
        submittedBy: submittedBy || null,
        imagePath: imageUrl,
        imagePublicId: publicId,
        deviceId,
        status: "pending",
        displayOrder: 1000 + count,
        huntCode: makeHuntCode(),
      })
      .returning();
    res.status(201).json({ entry: serializeEntry(created) });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "retry", message: "Riprova" });
      return;
    }
    req.log.error({ err }, "Failed to save entry");
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
