import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { sessionsTable } from "./sessions";
import { votersTable } from "./voters";
import { costumesTable } from "./costumes";

// Modalità caccia: un votante ha "catturato" un costume scansionandone il QR
export const huntCatchesTable = pgTable(
  "hunt_catches",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
    voterId: integer("voter_id").notNull().references(() => votersTable.id, { onDelete: "cascade" }),
    costumeId: integer("costume_id").notNull().references(() => costumesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("hunt_catches_voter_costume_unique").on(t.voterId, t.costumeId)],
);
