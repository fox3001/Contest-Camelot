import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isOpen: boolean("is_open").notNull().default(true),
  // Se true, per registrarsi serve un codice votante generato dall'admin
  requireCode: boolean("require_code").notNull().default(false),
  // Se true, i partecipanti possono iscrivere il proprio costume con una foto
  entriesOpen: boolean("entries_open").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, createdAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
