import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const votersTable = pgTable("voters", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  nickname: text("nickname").notNull(),
  token: text("token").notNull().unique(),
  // Identificativo casuale del dispositivo (localStorage): un votante per dispositivo per sessione
  deviceId: text("device_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVoterSchema = createInsertSchema(votersTable).omit({ id: true, createdAt: true });
export type InsertVoter = z.infer<typeof insertVoterSchema>;
export type Voter = typeof votersTable.$inferSelect;
