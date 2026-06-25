import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { votersTable } from "./voters";
import { costumesTable } from "./costumes";

export const votesTable = pgTable("votes", {
  id: serial("id").primaryKey(),
  voterId: integer("voter_id").notNull().references(() => votersTable.id, { onDelete: "cascade" }),
  costumeId: integer("costume_id").notNull().references(() => costumesTable.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique("votes_voter_costume_unique").on(t.voterId, t.costumeId)]);

export const insertVoteSchema = createInsertSchema(votesTable).omit({ id: true, createdAt: true });
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votesTable.$inferSelect;
