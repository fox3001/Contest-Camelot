import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { sessionsTable } from "./sessions";
import { votersTable } from "./voters";

// Codici votante monouso (da stampare su biglietti/braccialetti)
export const voterCodesTable = pgTable(
  "voter_codes",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    voterId: integer("voter_id").references(() => votersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("voter_codes_session_code_unique").on(t.sessionId, t.code)],
);

export type VoterCode = typeof voterCodesTable.$inferSelect;
