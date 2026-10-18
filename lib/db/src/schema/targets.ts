import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { sessionsTable } from "./sessions";
import { costumesTable } from "./costumes";
import { votersTable } from "./voters";

// Target Hunt: l'admin sceglie un costume, manda un indovinello a tutti; vince il primo che ne scansiona il QR
export const targetsTable = pgTable("targets", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  costumeId: integer("costume_id").notNull().references(() => costumesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Target Hunt"),
  riddle: text("riddle").notNull(),
  prize: text("prize").notNull(),
  // Informazioni libere sul premio: dove ritirarlo, fino a quando, ecc.
  prizeInfo: text("prize_info").notNull().default(""),
  // "active" | "won" | "cancelled"
  status: text("status").notNull().default("active"),
  winnerVoterId: integer("winner_voter_id").references(() => votersTable.id, { onDelete: "set null" }),
  claimCode: text("claim_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  wonAt: timestamp("won_at"),
});

export type Target = typeof targetsTable.$inferSelect;
