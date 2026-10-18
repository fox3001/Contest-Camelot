import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// Impostazioni generali dell'app (es. "theme" = aspetto grafico), una riga per chiave
export const settingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Setting = typeof settingsTable.$inferSelect;
