import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const costumesTable = pgTable("costumes", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  imagePath: text("image_path").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  // "approved" = in gara; "pending" = iscritto da un partecipante, da approvare; "rejected" = non approvato
  status: text("status").notNull().default("approved"),
  // Iscrizioni dei partecipanti: dispositivo, nome di chi iscrive, id della foto su Cloudinary
  deviceId: text("device_id"),
  submittedBy: text("submitted_by"),
  imagePublicId: text("image_public_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const COSTUME_STATUSES = ["approved", "pending", "rejected"] as const;
export type CostumeStatus = (typeof COSTUME_STATUSES)[number];

export const insertCostumeSchema = createInsertSchema(costumesTable).omit({ id: true });
export type InsertCostume = z.infer<typeof insertCostumeSchema>;
export type Costume = typeof costumesTable.$inferSelect;
