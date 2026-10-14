import { db, sessionsTable, type Session } from "@workspace/db";
import { desc } from "drizzle-orm";

/** Sessione corrente = quella aperta più recente; se nessuna è aperta, la più recente. */
export async function getCurrentSession(): Promise<Session | undefined> {
  const [session] = await db
    .select()
    .from(sessionsTable)
    .orderBy(desc(sessionsTable.isOpen), desc(sessionsTable.createdAt), desc(sessionsTable.id))
    .limit(1);
  return session;
}

export function serializeSession(s: Session) {
  return {
    id: s.id,
    name: s.name,
    isOpen: s.isOpen,
    requireCode: s.requireCode,
    createdAt: s.createdAt.toISOString(),
  };
}
