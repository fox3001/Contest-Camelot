import { Router } from "express";
import { db, votersTable, sessionsTable, voterCodesTable } from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

const router = Router();

const NICKNAME_MAX = 30;

function fail(res: any, status: number, error: string, message: string) {
  res.status(status).json({ error, message });
}

function serializeVoter(v: typeof votersTable.$inferSelect) {
  return { id: v.id, nickname: v.nickname, sessionId: v.sessionId, token: v.token };
}

/**
 * Registrazione votante.
 * - Un solo votante per dispositivo per sessione: se il dispositivo è già
 *   registrato si riottiene lo stesso votante (non se ne crea uno nuovo).
 * - Un nickname già usato da un altro dispositivo viene rifiutato (prima
 *   veniva restituito il token dell'altro, permettendo di cambiarne i voti).
 * - Se la sessione richiede i codici, serve un codice valido e non usato.
 */
router.post("/", async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      nickname?: unknown;
      sessionId?: unknown;
      deviceId?: unknown;
      code?: unknown;
    };
    const nickname = typeof body.nickname === "string" ? body.nickname.trim().replace(/\s+/g, " ") : "";
    const sessionId = Number(body.sessionId);
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

    if (!nickname || nickname.length > NICKNAME_MAX || !Number.isInteger(sessionId)) {
      fail(res, 400, "invalid_input", "Nickname non valido");
      return;
    }
    if (deviceId.length < 16 || deviceId.length > 128) {
      fail(res, 400, "invalid_device", "Dispositivo non riconosciuto, ricarica la pagina");
      return;
    }

    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId)).limit(1);
    if (!session) {
      fail(res, 404, "session_not_found", "Sessione non trovata");
      return;
    }
    if (!session.isOpen) {
      fail(res, 403, "voting_closed", "Le votazioni sono chiuse");
      return;
    }

    // Stesso dispositivo già registrato in questa sessione → stesso votante
    const [sameDevice] = await db
      .select()
      .from(votersTable)
      .where(and(eq(votersTable.sessionId, sessionId), eq(votersTable.deviceId, deviceId)))
      .limit(1);
    if (sameDevice) {
      res.status(200).json(serializeVoter(sameDevice));
      return;
    }

    // Codice votante, se richiesto
    let codeRow: typeof voterCodesTable.$inferSelect | undefined;
    if (session.requireCode) {
      if (!code) {
        fail(res, 403, "code_required", "Serve il codice votante");
        return;
      }
      [codeRow] = await db
        .select()
        .from(voterCodesTable)
        .where(and(eq(voterCodesTable.sessionId, sessionId), eq(voterCodesTable.code, code)))
        .limit(1);
      if (!codeRow) {
        fail(res, 403, "code_invalid", "Codice non valido");
        return;
      }
      if (codeRow.voterId !== null) {
        fail(res, 409, "code_used", "Questo codice è già stato usato");
        return;
      }
    }

    // Nickname già preso (senza distinguere maiuscole/minuscole)
    const [taken] = await db
      .select({ id: votersTable.id })
      .from(votersTable)
      .where(and(eq(votersTable.sessionId, sessionId), sql`lower(${votersTable.nickname}) = lower(${nickname})`))
      .limit(1);
    if (taken) {
      fail(res, 409, "nickname_taken", "Nickname già in uso, scegline un altro");
      return;
    }

    const token = randomBytes(32).toString("hex");
    const voter = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(votersTable)
        .values({ sessionId, nickname, token, deviceId })
        .returning();
      if (codeRow) {
        const claimed = await tx
          .update(voterCodesTable)
          .set({ voterId: created.id })
          .where(and(eq(voterCodesTable.id, codeRow.id), isNull(voterCodesTable.voterId)))
          .returning({ id: voterCodesTable.id });
        if (claimed.length === 0) throw new CodeRaceError();
      }
      return created;
    });

    res.status(201).json(serializeVoter(voter));
  } catch (err: any) {
    if (err instanceof CodeRaceError) {
      fail(res, 409, "code_used", "Questo codice è già stato usato");
      return;
    }
    if (err?.code === "23505") {
      // Doppio invio simultaneo dallo stesso dispositivo: restituisco quello creato
      fail(res, 409, "retry", "Riprova");
      return;
    }
    req.log.error({ err }, "Failed to register voter");
    fail(res, 500, "server_error", "Errore del server");
  }
});

class CodeRaceError extends Error {}

export default router;
