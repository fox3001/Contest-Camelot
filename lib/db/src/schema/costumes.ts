import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const costumesTable = pgTable("costumes", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  imagePath: text("image_path").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
});

export const insertCostumeSchema = createInsertSchema(costumesTable).omit({ id: true });
export type InsertCostume = z.infer<typeof insertCostumeSchema>;
export type Costume = typeof costumesTable.$inferSelect;
